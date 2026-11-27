import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  createConcept,
  createDatabase,
  createGoal,
  createSession,
  createTopic,
  listGoals,
  setGoalBookmark,
  setGoalObjective,
} from "../src/db/database.js";
import { CURRENT_SCHEMA_VERSION } from "../src/db/schema.js";
import { parsePersistedRow, serializeOperationError } from "../src/errors.js";
import {
  compareTeacherHarnesses,
  summarizeHarnessTrace,
} from "../src/evaluation/harness-comparison.js";
import {
  inspectTeacherScenario,
  prepareTeacherScenario,
  teacherScenarios,
} from "../src/evaluation/teacher-scenarios.js";
import {
  activateQuestionBankItem,
  materializeQuestionBank,
} from "../src/ingest/question-bank.js";
import {
  createClaim,
  createMisconception,
  getWeaknessProjections,
  recordAssessment,
  reviseEvidence,
} from "../src/kernel/evidence.js";
import {
  completeSessionFeedback,
  createLearningObjective,
  openAttempt,
  recordTeachingRequest,
  registerChallenge,
  submitAttempt,
} from "../src/kernel/foundation.js";
import { openAttemptSubquestion } from "../src/kernel/questions.js";
import { handleJsonRpcMessage, loadPackagedSkillInstructions } from "../src/mcp-server.js";
import { callLearningOsTool, MCP_TOOLS } from "../src/mcp/tools.js";
import { getObjectiveReviewCard } from "../src/scheduler/index.js";
import Database from "better-sqlite3";
import { getGoalSummary, getTopicSummary } from "../src/state.js";
import { endSession, startSession } from "../src/session/engine.js";
import { getStudyContinuation } from "../src/study/continuation.js";
import { createTeacherWorkspace } from "../src/workspace.js";
import { createKernelFixture, GOAL_ID, OBJECTIVE_ID } from "./helpers/kernel-fixture.js";
import { runSync } from "./helpers/spawn.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const knowledgeRoot = join(repoRoot, "knowledge");
const tsxBin = join(repoRoot, "node_modules", ".bin", "tsx");
const kernelCliPath = join(repoRoot, "src", "kernel-cli.ts");
const evalCliPath = join(repoRoot, "src", "evaluation", "cli.ts");

const dirs: string[] = [];
afterEach(() => {
  vi.useRealTimers();
  while (dirs.length > 0) {
    rmSync(dirs.pop()!, { recursive: true, force: true });
  }
});

describe("v24 architectural upgrades & adversarial regressions", () => {
  it("enforces explicit claim-to-criterion linkage across same-label collisions, renamed labels, revisions, and auto-retest", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-01T10:00:00.000Z"));
    const fixture = createKernelFixture();
    const { db } = fixture;
    try {
      const claimId = "saturation-boundary-not-modeled";
      createClaim(db, {
        id: claimId,
        conceptId: "concept",
        kind: "error_claim",
        description: "Assumes larger queues solve sustained overload.",
      });

      // Challenge 1: records saturation error against criterion 'mechanism'
      registerChallenge(db, {
        id: "sat-diag-1",
        version: 1,
        publicPrompt: "Analyze queue saturation and ordering under sustained load.",
        taskForm: "runtime_trace",
        deliveryContext: "practice",
        targets: [{ objectiveId: OBJECTIVE_ID, novelty: "same", criterionIds: ["ordering", "mechanism"] }],
        rubric: {
          id: "sat-diag-1-rubric",
          version: 1,
          criteria: [
            { id: "ordering", objectiveId: OBJECTIVE_ID, required: true, description: "Orders I/O issuance." },
            {
              id: "mechanism",
              objectiveId: OBJECTIVE_ID,
              required: true,
              description: "Models saturation boundary.",
              claimIds: [claimId],
            },
          ],
        },
        verification: { required: false, basis: "frozen_rubric" },
      });

      const s1 = createSession(db, { goalId: GOAL_ID, mode: "practice" });
      const a1 = openAttempt(db, "sat-diag-1", 1, s1.id).attempt;
      vi.setSystemTime(new Date("2026-09-01T10:05:00.000Z"));
      submitAttempt(db, a1.id, { responseText: "Ordering is ok, bigger queue fixes overload." });
      recordAssessment(db, a1.id, {
        evaluatorType: "agent",
        assessmentBasis: "frozen_rubric",
        objectiveResults: [
          {
            objectiveId: OBJECTIVE_ID,
            result: "partially_correct",
            criteriaMet: ["ordering"],
            criteriaUnmet: ["mechanism"],
            rationale: "Ordering met; saturation boundary unmet.",
          },
        ],
      });
      completeSessionFeedback(db, s1.id);
      expect(getWeaknessProjections(db, OBJECTIVE_ID)).toMatchObject([
        { category: `claim:${claimId}`, lifecycle: "new" },
      ]);

      // Challenge 2: DIFFERENT topic reusing criterion ID 'mechanism' WITHOUT claim linkage must NOT clear saturation
      registerChallenge(db, {
        id: "unrelated-callback-same-label",
        version: 1,
        publicPrompt: "Trace unrelated callback execution.",
        taskForm: "runtime_trace",
        deliveryContext: "practice",
        targets: [{ objectiveId: OBJECTIVE_ID, novelty: "variant", criterionIds: ["mechanism"] }],
        rubric: {
          id: "unrelated-rubric",
          version: 1,
          criteria: [
            { id: "mechanism", objectiveId: OBJECTIVE_ID, required: true, description: "Callback runs after stack." },
          ],
        },
        verification: { required: false, basis: "frozen_rubric" },
      });

      vi.setSystemTime(new Date("2026-09-02T10:00:00.000Z"));
      const s2 = createSession(db, { goalId: GOAL_ID, mode: "practice" });
      const a2 = openAttempt(db, "unrelated-callback-same-label", 1, s2.id).attempt;
      submitAttempt(db, a2.id, { responseText: "Callback waits for call stack." });
      recordAssessment(db, a2.id, {
        evaluatorType: "agent",
        assessmentBasis: "frozen_rubric",
        objectiveResults: [
          {
            objectiveId: OBJECTIVE_ID,
            result: "correct",
            criteriaMet: ["mechanism"],
            criteriaUnmet: [],
            rationale: "Unrelated callback mechanism explained.",
          },
        ],
      });
      completeSessionFeedback(db, s2.id);

      // Must STILL be 'new' — same criterion label without claim link cannot clear saturation!
      expect(getWeaknessProjections(db, OBJECTIVE_ID)).toMatchObject([
        { category: `claim:${claimId}`, lifecycle: "new" },
      ]);

      // Challenge 3: RENAMED criterion ID 'sustained-load' explicitly linked to claimId DOES resolve it
      registerChallenge(db, {
        id: "sat-renamed-criterion",
        version: 1,
        publicPrompt: "Arrival rate exceeds service rate over 10 minutes.",
        taskForm: "runtime_trace",
        deliveryContext: "practice",
        targets: [{ objectiveId: OBJECTIVE_ID, novelty: "variant", criterionIds: ["sustained-load"] }],
        rubric: {
          id: "sat-renamed-rubric",
          version: 1,
          criteria: [
            {
              id: "sustained-load",
              objectiveId: OBJECTIVE_ID,
              required: true,
              description: "Explains unbounded queue growth when arrival > service rate.",
              claimIds: [claimId],
            },
          ],
        },
        verification: { required: false, basis: "frozen_rubric" },
      });

      vi.setSystemTime(new Date("2026-09-03T10:00:00.000Z"));
      const s3 = createSession(db, { goalId: GOAL_ID, mode: "practice" });
      const a3 = openAttempt(db, "sat-renamed-criterion", 1, s3.id).attempt;
      submitAttempt(db, a3.id, { responseText: "Queue grows without bound; must shed load." });
      const cleared = recordAssessment(db, a3.id, {
        evaluatorType: "agent",
        assessmentBasis: "frozen_rubric",
        objectiveResults: [
          {
            objectiveId: OBJECTIVE_ID,
            result: "correct",
            criteriaMet: ["sustained-load"],
            criteriaUnmet: [],
            rationale: "Saturation boundary modeled accurately.",
          },
        ],
      });
      completeSessionFeedback(db, s3.id);
      expect(getWeaknessProjections(db, OBJECTIVE_ID)).toMatchObject([
        { category: `claim:${claimId}`, lifecycle: "resolved" },
      ]);

      // Invalidating the clearing evidence restores 'new'; restoring returns 'resolved'
      const clearingEventId = cleared.evidenceEvents[0]!.id;
      reviseEvidence(db, clearingEventId, { action: "invalidate", reason: "Check replay." });
      expect(getWeaknessProjections(db, OBJECTIVE_ID)).toMatchObject([
        { category: `claim:${claimId}`, lifecycle: "new" },
      ]);
      reviseEvidence(db, clearingEventId, { action: "restore", reason: "Restore verified clearance." });
      completeSessionFeedback(db, s3.id);
      expect(getWeaknessProjections(db, OBJECTIVE_ID)).toMatchObject([
        { category: `claim:${claimId}`, lifecycle: "resolved" },
      ]);

      // Another UNRELATED correct answer does NOT graduate auto-retest for claimId!
      registerChallenge(db, {
        id: "unrelated-third-surface",
        version: 1,
        publicPrompt: "Another unrelated mechanism check.",
        taskForm: "runtime_trace",
        deliveryContext: "practice",
        targets: [{ objectiveId: OBJECTIVE_ID, novelty: "variant", criterionIds: ["other"] }],
        rubric: {
          id: "other-rubric",
          version: 1,
          criteria: [{ id: "other", objectiveId: OBJECTIVE_ID, required: true, description: "Other check." }],
        },
        verification: { required: false, basis: "frozen_rubric" },
      });
      vi.setSystemTime(new Date("2026-09-04T10:00:00.000Z"));
      const s4 = createSession(db, { goalId: GOAL_ID, mode: "practice" });
      const a4 = openAttempt(db, "unrelated-third-surface", 1, s4.id).attempt;
      submitAttempt(db, a4.id, { responseText: "Other mechanism." });
      recordAssessment(db, a4.id, {
        evaluatorType: "agent",
        assessmentBasis: "frozen_rubric",
        objectiveResults: [
          { objectiveId: OBJECTIVE_ID, result: "correct", criteriaMet: ["other"], criteriaUnmet: [], rationale: "OK." },
        ],
      });
      completeSessionFeedback(db, s4.id);

      const card = getObjectiveReviewCard(db, OBJECTIVE_ID)!;
      const retestTime = new Date(
        Math.max(Date.parse(card.due_at), Date.parse("2026-09-15T10:00:00.000Z")),
      ).toISOString();
      const next = getStudyContinuation(db, { goalId: GOAL_ID, now: retestTime, oneEpisode: true });
      expect(next).toMatchObject({
        kind: "recommend",
        item: {
          intent: {
            reasonKind: "resolved_weakness_retest",
            weakness: { category: `claim:${claimId}`, isRetest: true },
          },
        },
      });
    } finally {
      db.close();
    }
  });

  it("handles teach_first explicitly without grading as failed retrieval and preserves assisted provenance", () => {
    const dir = mkdtempSync(join(tmpdir(), "learning-os-teach-first-"));
    dirs.push(dir);
    const dbPath = join(dir, "tutor.db");
    const fixture = createKernelFixture(dbPath);
    const { sessionId, attemptId } = fixture.openPracticeAttempt();
    const seq = openAttemptSubquestion(fixture.db, attemptId, {
      promptText: "Explain how it works.",
      questionChunking: "default",
    }).seq;
    fixture.db.close();

    const teach = callLearningOsTool("study_submit", {
      dbPath,
      action: "teach_first",
      sessionId,
      attemptId,
      learnerRequestText: "Please teach me first, I don't know this yet.",
      content: "Here is the core mechanism from first principles.",
    });
    expect(teach).toMatchObject({
      action: "teach_first",
      assisted: true,
      evidenceCreated: 0,
      reviewEventsCreated: 0,
    });

    const db = createDatabase(dbPath);
    try {
      expect(db.prepare("SELECT COUNT(*) AS c FROM evidence_events").get()).toEqual({ c: 0 });
      expect(db.prepare("SELECT COUNT(*) AS c FROM review_cards").get()).toEqual({ c: 0 });
    } finally {
      db.close();
    }

    // Subsequent answer on the same attempt retains assisted provenance (retrieval_valid = false)
    const assessed = callLearningOsTool("study_submit", {
      dbPath,
      action: "assess",
      attemptId,
      questionSeq: seq,
      responseText: "Now I see: the input triggers the mechanism.",
      assessment: {
        evaluatorType: "agent",
        assessmentBasis: "frozen_rubric",
        objectiveResults: [
          {
            objectiveId: OBJECTIVE_ID,
            result: "correct",
            criteriaMet: ["mechanism"],
            criteriaUnmet: [],
            rationale: "Explained after teaching.",
          },
        ],
      },
    });
    expect(assessed).toMatchObject({
      feedbackClosed: true,
      evidenceEvents: [{ retrieval_valid: false }],
      relianceSummary: { cleanIndependentCorrect: 0, assistedOrHinted: 1 },
    });
  });

  it("completes answer -> disconnect -> resume -> assess_submitted and park -> voice -> resumeParked via MCP", () => {
    const dir = mkdtempSync(join(tmpdir(), "learning-os-mcp-lifecycle-"));
    dirs.push(dir);
    const dbPath = join(dir, "tutor.db");
    const fixture = createKernelFixture(dbPath);
    const { sessionId, attemptId } = fixture.openPracticeAttempt();
    openAttemptSubquestion(fixture.db, attemptId, {
      promptText: "Explain the transition.",
      questionChunking: "default",
    });
    fixture.db.close();

    // 1. Park the active desk session for a voice interruption
    const parked = callLearningOsTool("study_submit", {
      dbPath,
      action: "park",
      goalId: GOAL_ID,
      sessionId,
      note: "Switching to voice between meetings",
      nextMove: "Return to desk exercise tonight",
    });
    expect(parked).toMatchObject({
      action: "park",
      bookmark: { parkedSessionId: sessionId, note: "Switching to voice between meetings" },
    });

    // Normal study_next now bypasses parked desk session and surfaces bookmark + unpark
    const bypassed = callLearningOsTool("study_next", { dbPath, goalId: GOAL_ID });
    expect(bypassed).toMatchObject({
      continuation: {
        kind: "needs_budget",
        bookmark: { parkedSessionId: sessionId },
        allowedActions: ["set_budget_or_one_episode", "unpark"],
      },
    });

    // Explicitly resuming parked recovers the exact saved question & commitment
    const resumedParked = callLearningOsTool("study_next", {
      dbPath,
      goalId: GOAL_ID,
      resumeParked: true,
    });
    expect(resumedParked).toMatchObject({
      continuation: {
        kind: "resume",
        commitment: { sessionId, attemptId, pendingAction: "collect_response" },
        presentation: { kind: "question", promptText: "Explain the transition." },
      },
    });

    // Unpark before submitting
    callLearningOsTool("study_submit", { dbPath, action: "unpark", goalId: GOAL_ID });

    // 2. Simulate disconnect AFTER submission but BEFORE assessment
    const db = createDatabase(dbPath);
    const pendingSeq = (
      db
        .prepare("SELECT seq FROM attempt_subquestions WHERE attempt_id = ?")
        .get(attemptId) as { seq: number }
    ).seq;
    const submittedText = "Unique submitted learner answer before disconnect.";
    submitAttempt(db, attemptId, { questionSeq: pendingSeq, responseText: submittedText });
    db.close();

    // Fresh teacher resumes via study_next: sees exact submittedWork + alreadySubmitted + callable 'assess' action
    const afterDisconnect = callLearningOsTool("study_next", { dbPath, goalId: GOAL_ID });
    expect(afterDisconnect).toMatchObject({
      continuation: {
        kind: "resume",
        commitment: {
          sessionId,
          attemptId,
          pendingAction: "assess_response",
          alreadySubmitted: true,
          submittedWork: { attemptId, responseText: submittedText },
        },
        allowedActions: ["assess"],
      },
    });

    // Fresh teacher completes assessment through MCP study_submit(action='assess') without error!
    const finished = callLearningOsTool("study_submit", {
      dbPath,
      action: "assess",
      attemptId,
      assessment: {
        evaluatorType: "agent",
        assessmentBasis: "frozen_rubric",
        objectiveResults: [
          {
            objectiveId: OBJECTIVE_ID,
            result: "correct",
            criteriaMet: ["mechanism"],
            criteriaUnmet: [],
            rationale: "Assessed after disconnect.",
          },
        ],
      },
    });
    expect(finished).toMatchObject({
      action: "assess",
      feedbackClosed: true,
    });

    // 3. Partial invalidation -> resume surfaces correctionTargets + revise_evidence -> MCP revise fixes it
    const evId = ((finished.evidenceEvents as Array<{ id: string }>)[0]!).id;
    callLearningOsTool("study_submit", {
      dbPath,
      action: "revise",
      evidenceEventId: evId,
      revisionAction: "invalidate",
      reason: "Re-evaluate.",
    });
    const afterInvalidation = callLearningOsTool("study_next", { dbPath, goalId: GOAL_ID });
    expect(afterInvalidation).toMatchObject({
      continuation: {
        kind: "resume",
        commitment: {
          alreadySubmitted: true,
          correctionTargets: [{ objectiveId: OBJECTIVE_ID, latestEvidenceEventId: evId }],
        },
        allowedActions: ["revise"],
      },
    });
    const restored = callLearningOsTool("study_submit", {
      dbPath,
      action: "revise",
      evidenceEventId: evId,
      revisionAction: "restore",
      reason: "Original grade confirmed.",
    });
    expect(restored).toMatchObject({ action: "revise", revision: { action: "restore" } });
  });

  it("enforces privacy-safe allowlisted validation errors, discriminator union branches, and schema parity", () => {
    const submitTool = MCP_TOOLS.find((t) => t.name === "study_submit")!;
    expect(submitTool.inputSchema).toHaveProperty("allOf");
    expect((submitTool.inputSchema.allOf as unknown[]).length).toBe(9);
    expect(submitTool.inputSchema).toMatchObject({ additionalProperties: false });

    const dir = mkdtempSync(join(tmpdir(), "learning-os-err-"));
    dirs.push(dir);
    const dbPath = join(dir, "tutor.db");
    const fixture = createKernelFixture(dbPath);
    const { attemptId, sessionId } = fixture.openPracticeAttempt();
    const seq = openAttemptSubquestion(fixture.db, attemptId, {
      promptText: "What happens next?",
      questionChunking: "default",
    }).seq;
    fixture.db.close();

    // 1. Unknown nested key & invalid discriminator must NEVER echo privateLearnerText
    const secret = "privateLearnerText";
    const unknownKeyResp = handleJsonRpcMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "study_submit",
        arguments: {
          dbPath,
          action: "clarify",
          attemptId,
          seq,
          responseText: "Some answer",
          followUpQuestion: { promptText: "Clarify?", [secret]: "leaked" },
        },
      },
    });
    const unknownPayload = JSON.parse(
      ((unknownKeyResp?.result as { content: Array<{ text: string }> }).content[0]!).text,
    );
    expect(unknownPayload.code).toBe("INVALID_REQUEST");
    expect(JSON.stringify(unknownPayload)).not.toContain(secret);

    const badActionResp = handleJsonRpcMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "study_submit",
        arguments: { dbPath, action: secret },
      },
    });
    const badActionPayload = JSON.parse(
      ((badActionResp?.result as { content: Array<{ text: string }> }).content[0]!).text,
    );
    expect(badActionPayload.action).toBeUndefined();
    expect(badActionPayload.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "action", code: "invalid_value" })]),
    );
    expect(JSON.stringify(badActionPayload)).not.toContain(secret);

    // 2. Incomplete atomic followUpQuestion identifies scopeCriterionId & scopeNote (not questionChunking='default')
    const atomicResp = handleJsonRpcMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "study_submit",
        arguments: {
          dbPath,
          action: "clarify",
          attemptId,
          seq,
          responseText: "Vague",
          followUpQuestion: { promptText: "One step?", questionChunking: "atomic" },
        },
      },
    });
    const atomicPayload = JSON.parse(
      ((atomicResp?.result as { content: Array<{ text: string }> }).content[0]!).text,
    );
    expect(atomicPayload.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "followUpQuestion.scopeCriterionId" }),
        expect.objectContaining({ path: "followUpQuestion.scopeNote" }),
      ]),
    );

    // 3. Exclusive bound attemptId: 0 reports '> 0' (not '>= 0')
    const zeroResp = handleJsonRpcMessage({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "study_submit",
        arguments: {
          dbPath,
          action: "clarify",
          attemptId: 0,
          seq,
          responseText: "Vague",
          followUpQuestion: { promptText: "Clarify?" },
        },
      },
    });
    const zeroPayload = JSON.parse(
      ((zeroResp?.result as { content: Array<{ text: string }> }).content[0]!).text,
    );
    expect(zeroPayload.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "attemptId", expected: expect.stringContaining("> 0") }),
      ]),
    );

    // 4. reconstruct(completed) without responseText is rejected as INVALID_REQUEST
    const reconMissing = handleJsonRpcMessage({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "study_submit",
        arguments: { dbPath, action: "reconstruct", sessionId, outcome: "completed" },
      },
    });
    expect(
      JSON.parse(((reconMissing?.result as { content: Array<{ text: string }> }).content[0]!).text),
    ).toMatchObject({
      code: "INVALID_REQUEST",
      action: "reconstruct",
      issues: expect.arrayContaining([expect.objectContaining({ path: "responseText" })]),
    });

    // 5. CLI registerChallenge '{}' reports INVALID_REQUEST (request), NOT persisted_state!
    const badReg = runSync(tsxBin, [kernelCliPath, "--db", ":memory:", "registerChallenge", "{}"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(badReg.status).toBe(1);
    expect(JSON.parse(badReg.stderr)).toMatchObject({
      code: "INVALID_REQUEST",
      source: "request",
    });

    // 6. Explicit parsePersistedRow produces persisted_state VALIDATION_FAILED
    expect(() => parsePersistedRow(z.object({ id: z.string() }), { id: 123 })).toThrow();
    try {
      parsePersistedRow(z.object({ id: z.string() }), { id: 123 });
    } catch (err) {
      expect(serializeOperationError(err, "kernel")).toMatchObject({
        code: "VALIDATION_FAILED",
        source: "persisted_state",
      });
    }
  });

  it("executes the actual frozen promise-chain source and passes all inspectTeacherScenario checks with mixed basis", () => {
    const dir = mkdtempSync(join(tmpdir(), "learning-os-mixed-real-"));
    dirs.push(dir);
    const dbPath = join(dir, "tutor.db");
    const prepared = prepareTeacherScenario("calibrated_promises_missing_return_answer", dbPath);
    const scenario = teacherScenarios.find((s) => s.id === "calibrated_promises_missing_return_answer")!;

    // Execute the real frozen source file instead of fabricating stdout
    const sourceFile = join(
      knowledgeRoot,
      "frontend-revision",
      "challenges",
      "js-promises-predict",
      "baseline.mjs",
    );
    const execRes = runSync(process.execPath, [sourceFile], { encoding: "utf8" });
    expect(execRes.status).toBe(0);
    const stdoutLines = execRes.stdout
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);
    expect(stdoutLines).toEqual(["next got undefined", "saved draft"]);

    const contRes = runSync(tsxBin, [kernelCliPath, "--db", dbPath, "getStudyContinuation", "{}"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(contRes.status).toBe(0);
    const cont = JSON.parse(contRes.stdout);
    expect(cont.commitment).toMatchObject({
      verificationRequired: true,
      verificationBasis: "deterministic_execution",
      gradingBasis: "mixed",
    });

    const payload = {
      closeIfComplete: true,
      response: {
        questionSeq: cont.presentation.seq,
        responseText: scenario.learnerMessage,
      },
      assessment: {
        evaluatorType: "agent",
        assessmentBasis: "mixed",
        verificationOutput: {
          outcome: "passed",
          basis: "deterministic_execution",
          summary: "Ran js-promises-predict/baseline.mjs",
          details: { stdout: stdoutLines },
        },
        objectiveResults: [
          {
            objectiveId: prepared.objectiveId,
            result: "correct",
            criteriaMet: cont.commitment.criteria.map((c: { id: string }) => c.id),
            criteriaUnmet: [],
            rationale: "Predicted exact output order and explained missing return settlement.",
          },
        ],
      },
    };
    const assessRes = runSync(
      tsxBin,
      [kernelCliPath, "--db", dbPath, "submitAndAssess", String(prepared.attemptId), JSON.stringify(payload)],
      { cwd: repoRoot, encoding: "utf8" },
    );
    expect(assessRes.status).toBe(0);
    expect(JSON.parse(assessRes.stdout)).toMatchObject({ feedbackClosed: true });

    const checks = inspectTeacherScenario(dbPath, prepared);
    expect(checks.every((check) => check.passed)).toBe(true);
  });

  it("isolates question_bank_items, rejects identity conflicts, and activates cleanly via MCP", () => {
    const dir = mkdtempSync(join(tmpdir(), "learning-os-qbank-"));
    dirs.push(dir);
    const dbPath = join(dir, "tutor.db");
    const db = createDatabase(dbPath);
    createGoal(db, { id: "goal-js", name: "JS Prep", purpose: "interview" });

    const imported = materializeQuestionBank(db, {
      topic: { id: "js-bank", name: "JS Bank" },
      items: [
        {
          id: "q-closures-1",
          prompt: "What does a closure retain?",
          concept: { id: "js-closures", title: "Closures" },
          capability: "explain",
          taskForm: "explanation",
          source: "javascript-corpus",
          externalId: "ext-1",
          criterion: "Retains lexical bindings, not a frozen copy.",
        },
      ],
    });
    expect(imported).toEqual({ itemsCreated: 1, itemsExisting: 0 });
    expect(db.prepare("SELECT COUNT(*) AS c FROM concepts").get()).toEqual({ c: 0 });
    expect(db.prepare("SELECT COUNT(*) AS c FROM learning_objectives").get()).toEqual({ c: 0 });

    // Conflicting reimport with same ID under a different concept must throw!
    expect(() =>
      materializeQuestionBank(db, {
        topic: { id: "js-bank", name: "JS Bank" },
        items: [
          {
            id: "q-closures-1",
            prompt: "What does a closure retain?",
            concept: { id: "js-other", title: "Other" },
            capability: "explain",
            taskForm: "explanation",
            source: "javascript-corpus",
            externalId: "ext-1",
            criterion: "Retains lexical bindings, not a frozen copy.",
          },
        ],
      }),
    ).toThrow(/identity or grading specification conflict/i);
    db.close();

    // Activate via public MCP study_next
    const activated = callLearningOsTool("study_next", {
      dbPath,
      goalId: "goal-js",
      activateBankItemId: "q-closures-1",
    });
    expect(activated).toMatchObject({
      kind: "bank_item_activated",
      activated: {
        itemId: "q-closures-1",
        conceptId: "js-closures",
        objectiveId: "js-closures:explain",
        challengeId: "challenge:q-closures-1",
        conceptCreated: true,
        objectiveCreated: true,
        challengeCreated: true,
        goalAttached: true,
      },
    });

    // Idempotent second activation returns identical matching target
    const db2 = createDatabase(dbPath);
    try {
      expect(activateQuestionBankItem(db2, { itemId: "q-closures-1", goalId: "goal-js" })).toMatchObject({
        conceptCreated: false,
        objectiveCreated: false,
        challengeCreated: false,
        goalAttached: false,
      });
    } finally {
      db2.close();
    }
  });

  it("reports goals and content topics independently in getGoalSummary and getTopicSummary", () => {
    const db = createDatabase(":memory:");
    try {
      createTopic(db, { id: "js-content", name: "JavaScript" });
      createConcept(db, { id: "js-closures", topicId: "js-content", title: "Closures" });
      createLearningObjective(db, { id: "js-closures:explain", conceptId: "js-closures", capabilityId: "explain" });

      createTopic(db, { id: "react-content", name: "React" });
      createConcept(db, { id: "react-state", topicId: "react-content", title: "State" });
      createLearningObjective(db, { id: "react-state:explain", conceptId: "react-state", capabilityId: "explain" });

      createGoal(db, { id: "goal-fe", name: "Frontend Readiness", purpose: "interview" });
      setGoalObjective(db, { goalId: "goal-fe", objectiveId: "js-closures:explain", importance: "core" });
      setGoalObjective(db, { goalId: "goal-fe", objectiveId: "react-state:explain", importance: "core" });

      expect(getGoalSummary(db, "goal-fe")).toMatchObject({
        goalId: "goal-fe",
        activeObjectives: 2,
        totalConfiguredObjectives: 2,
        unknown: 2,
      });
      expect(getTopicSummary(db, "js-content")).toMatchObject({
        topicId: "js-content",
        totalConcepts: 1,
        totalObjectives: 1,
      });
    } finally {
      db.close();
    }
  });

  it("summarizes harness traces honestly without inflating retries, missing reads, or elapsed durations", () => {
    // Absent trace reports null toolCalls/costs (not 0)
    expect(summarizeHarnessTrace(undefined)).toMatchObject({
      traceStatus: "unknown",
      coverage: "unknown",
      instructionAccess: { status: "unknown", observedPaths: [] },
      toolCalls: null,
      measuredCosts: null,
    });

    // Partial coverage with 0 reads stays unknown and does not fabricate missingExpectedPaths
    const partial = summarizeHarnessTrace({
      coverage: "partial",
      expectedInstructionPaths: ["AGENTS.md"],
      events: [{ kind: "tool_call", eventId: "c1", tool: "study_next", status: "ok", elapsedMs: 12 }],
    });
    expect(partial.instructionAccess).toEqual({
      status: "unknown",
      observedPaths: [],
      expectedPaths: ["AGENTS.md"],
    });
    expect(partial.instructionAccess.missingExpectedPaths).toBeUndefined();

    // Interleaved unrelated calls do NOT count as retry; explicit retryOf DOES; tool vs run durations stay separate
    const observed = summarizeHarnessTrace({
      coverage: "full",
      expectedInstructionPaths: ["AGENTS.md", "skills/learning-os-teacher/SKILL.md"],
      events: [
        { kind: "file_read", path: "/repo/AGENTS.md" },
        { kind: "tool_call", eventId: "t1", tool: "study_submit", action: "assess", status: "error", elapsedMs: 10 },
        { kind: "tool_call", eventId: "t2", tool: "study_next", status: "ok", elapsedMs: 5 },
        { kind: "tool_call", eventId: "t3", tool: "study_submit", action: "assess", status: "ok", elapsedMs: 10 },
        { kind: "tool_call", eventId: "t4", tool: "study_submit", action: "clarify", status: "error", elapsedMs: 8 },
        { kind: "tool_call", eventId: "t5", retryOf: "t4", tool: "study_submit", action: "clarify", status: "ok", elapsedMs: 7 },
        { kind: "cost", tokens: 1200, elapsedMs: 20 },
      ],
    });
    expect(observed).toMatchObject({
      traceStatus: "observed",
      instructionAccess: {
        status: "observed",
        missingExpectedPaths: ["skills/learning-os-teacher/SKILL.md"],
      },
      toolCalls: {
        total: 5,
        succeeded: 3,
        failed: 2,
        linkedRetries: 1,
        recoveredLinkedRetries: 1,
      },
      measuredCosts: {
        tokens: 1200,
        toolElapsedMs: 40,
        runElapsedMs: 20,
      },
    });

    // compareTeacherHarnesses omits traceEvidence when neither run provides a trace
    const quality = {
      accuracy: { verdict: "meets", evidence: "Verified." },
      causalClarity: { verdict: "meets", evidence: "Verified." },
      adaptation: { verdict: "meets", evidence: "Verified." },
      learnerAgency: { verdict: "meets", evidence: "Verified." },
      assessmentHonesty: { verdict: "meets", evidence: "Verified." },
    };
    const baseRun = {
      runId: "r1",
      harnessSha256: "a".repeat(64),
      replySha256: "b".repeat(64),
      conditions: {
        scenarioSha256: "c".repeat(64),
        initialStateSha256: null,
        model: "m",
        modelOptions: "o",
        toolPermissions: "p",
        sourceSnapshot: "s",
      },
      quality,
      integrity: { verdict: "pass", evidence: "OK" },
      costs: { toolCalls: 1 },
    };
    const candRun = { ...structuredClone(baseRun), runId: "r2", harnessSha256: "d".repeat(64) };
    const noTraceReport = compareTeacherHarnesses({
      caseId: "c1",
      split: "development",
      rubricRevision: "v1",
      reviewer: { id: "rev", blinded: true },
      baseline: baseRun,
      candidate: candRun,
    });
    expect("traceEvidence" in noTraceReport).toBe(false);

    // eval:teacher inspect --trace works end-to-end
    const dir = mkdtempSync(join(tmpdir(), "learning-os-trace-cli-"));
    dirs.push(dir);
    const prepDir = join(dir, "case");
    const prep = runSync(tsxBin, [evalCliPath, "prepare", "calibrated_promises_missing_return_answer", prepDir], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(prep.status).toBe(0);
    const traceFile = join(dir, "trace.json");
    writeFileSync(
      traceFile,
      JSON.stringify({
        coverage: "full",
        events: [{ kind: "file_read", path: "AGENTS.md" }],
      }),
    );
    const inspectRes = runSync(tsxBin, [evalCliPath, "inspect", prepDir, "--trace", traceFile], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    const parsed = JSON.parse(inspectRes.stdout);
    expect(parsed.traceEvidence).toMatchObject({
      traceStatus: "observed",
      instructionAccess: { status: "observed", observedPaths: ["AGENTS.md"] },
    });
  });

  it("seeds fresh v24 frontend and backend-systems profiles from knowledge courses with working study_next", () => {
    const dir = mkdtempSync(join(tmpdir(), "learning-os-fresh-seed-"));
    dirs.push(dir);
    const dataDir = join(dir, "data");
    const workspace = createTeacherWorkspace({ dataDir, knowledgeRoot });
    const now = "2026-11-27T00:00:00.000Z";

    const specs = [
      {
        profileId: "backend-systems",
        displayName: "Backend Systems",
        courseId: "backend-systems",
        purpose: "interview" as const,
        targetRole: "Backend Engineer",
        targetOutcome: "Backend systems revision and interview readiness",
      },
      {
        profileId: "frontend",
        displayName: "Frontend",
        courseId: "frontend-revision",
        purpose: "interview" as const,
        targetRole: "Frontend Engineer",
        targetOutcome: "Frontend JavaScript and browser core interview readiness",
      },
    ];

    for (const spec of specs) {
      const built = workspace.buildCourseOnboardingProposal({
        courseId: spec.courseId,
        intake: {
          purpose: spec.purpose,
          targetRole: spec.targetRole,
          targetOutcome: spec.targetOutcome,
          deadlineAt: null,
          availability: { minutesPerDay: 30, daysPerWeek: 5 },
          areas: [],
        },
        now,
      });
      const applied = workspace.applyConfirmedOnboarding({
        intake: built.intake,
        planningNow: built.planningNow,
        proposal: built.proposal,
        confirmed: true,
        confirmedAt: now,
        profile: { id: spec.profileId, displayName: spec.displayName },
      });
      expect(applied.activatedObjectives.length).toBeGreaterThan(0);

      // Verify schema v24, foreign keys, zero fabricated evidence/cards
      const dbPath = join(dataDir, "profiles", spec.profileId, "tutor.db");
      const db = createDatabase(dbPath);
      try {
        expect(db.pragma("user_version", { simple: true })).toBe(CURRENT_SCHEMA_VERSION);
        expect(db.pragma("foreign_key_check")).toEqual([]);
        expect(db.prepare("SELECT COUNT(*) AS c FROM evidence_events").get()).toEqual({ c: 0 });
        expect(db.prepare("SELECT COUNT(*) AS c FROM review_cards").get()).toEqual({ c: 0 });
      } finally {
        db.close();
      }

      // Verify study_next works cleanly from the seeded profile
      const next = callLearningOsTool(
        "study_next",
        { profile: spec.profileId, oneEpisode: true },
        { dataDir, knowledgeRoot },
      );
      expect(next).toMatchObject({
        profile: spec.profileId,
        continuation: {
          kind: "recommend",
          item: { objectiveId: expect.any(String) },
        },
      });
    }
  });

  it("enforces stdout and frozen gradingBasis identically on reconnect and rejects conflicting artifacts", () => {
    const dir = mkdtempSync(join(tmpdir(), "learning-os-reconnect-verif-"));
    dirs.push(dir);
    const dbPath = join(dir, "tutor.db");
    const prepared = prepareTeacherScenario("calibrated_promises_missing_return_answer", dbPath);

    // Submit learner answer with artifact A, simulating disconnect before assessment
    const db = createDatabase(dbPath);
    submitAttempt(db, prepared.attemptId, {
      questionSeq: prepared.initialQuestionSeq!,
      responseText: "next got undefined; saved draft.",
      artifactRef: { file: "a.mjs", sha: "aaa" },
    });
    db.close();

    // Reconnect via study_next: must surface publicPrompt + submittedWork + alreadySubmitted + callable 'assess'
    const resumed = callLearningOsTool("study_next", { dbPath, goalId: prepared.goalId }, { knowledgeRoot });
    expect(resumed).toMatchObject({
      continuation: {
        kind: "resume",
        commitment: {
          publicPrompt: expect.stringContaining("Promise"),
          gradingBasis: "mixed",
          alreadySubmitted: true,
          submittedWork: {
            attemptId: prepared.attemptId,
            responseText: "next got undefined; saved draft.",
            artifactRef: { file: "a.mjs", sha: "aaa" },
          },
        },
        allowedActions: ["verify", "assess"],
      },
    });

    // 1. Reconnected assess with empty details: {} must be rejected
    expect(() =>
      callLearningOsTool(
        "study_submit",
        {
          dbPath,
          action: "assess",
          attemptId: prepared.attemptId,
          assessment: {
            evaluatorType: "agent",
            assessmentBasis: "mixed",
            verificationOutput: { outcome: "passed", basis: "node", summary: "ok", details: {} },
            objectiveResults: [
              {
                objectiveId: prepared.objectiveId,
                result: "correct",
                criteriaMet: ["output_order", "settlement_link"],
                criteriaUnmet: [],
                rationale: "ok",
              },
            ],
          },
        },
        { knowledgeRoot },
      ),
    ).toThrow(/details\.stdout/);

    // 2. Reconnected assess with wrong gradingBasis ('deterministic_execution' vs frozen 'mixed') must be rejected
    expect(() =>
      callLearningOsTool(
        "study_submit",
        {
          dbPath,
          action: "assess",
          attemptId: prepared.attemptId,
          assessment: {
            evaluatorType: "agent",
            assessmentBasis: "deterministic_execution",
            verificationOutput: {
              outcome: "passed",
              basis: "node",
              summary: "ok",
              details: { stdout: ["next got undefined", "saved draft"] },
            },
            objectiveResults: [
              {
                objectiveId: prepared.objectiveId,
                result: "correct",
                criteriaMet: ["output_order", "settlement_link"],
                criteriaUnmet: [],
                rationale: "ok",
              },
            ],
          },
        },
        { knowledgeRoot },
      ),
    ).toThrow(/requires assessmentBasis 'mixed'/);

    // 3. Reconnected assess with conflicting artifactRef B must be rejected
    expect(() =>
      callLearningOsTool(
        "study_submit",
        {
          dbPath,
          action: "assess",
          attemptId: prepared.attemptId,
          artifactRef: { file: "b.mjs", sha: "bbb" },
          assessment: {
            evaluatorType: "agent",
            assessmentBasis: "mixed",
            verificationOutput: {
              outcome: "passed",
              basis: "node",
              summary: "ok",
              details: { stdout: ["next got undefined", "saved draft"] },
            },
            objectiveResults: [
              {
                objectiveId: prepared.objectiveId,
                result: "correct",
                criteriaMet: ["output_order", "settlement_link"],
                criteriaUnmet: [],
                rationale: "ok",
              },
            ],
          },
        },
        { knowledgeRoot },
      ),
    ).toThrow(/artifactRef/);

    // 4. Matching frozen basis + recorded stdout succeeds cleanly
    const ok = callLearningOsTool(
      "study_submit",
      {
        dbPath,
        action: "assess",
        attemptId: prepared.attemptId,
        assessment: {
          evaluatorType: "agent",
          assessmentBasis: "mixed",
          verificationOutput: {
            outcome: "passed",
            basis: "node",
            summary: "ok",
            details: { stdout: ["next got undefined", "saved draft"] },
          },
          objectiveResults: [
            {
              objectiveId: prepared.objectiveId,
              result: "correct",
              criteriaMet: ["output_order", "settlement_link"],
              criteriaUnmet: [],
              rationale: "ok",
            },
          ],
        },
      },
      { knowledgeRoot },
    );
    expect(ok).toMatchObject({ action: "assess", feedbackClosed: true });
  });

  it("blocks clearing a misconception on zero met criteria and keeps dual-criterion claim resolution independent of rubric order", () => {
    const fixture = createKernelFixture();
    const { db } = fixture;
    try {
      const miscId = "misc-atomic-tx";
      createMisconception(db, {
        id: miscId,
        conceptId: "concept",
        description: "Assumes transaction implies serialization.",
        isBlocking: true,
      });

      // Record misconception on first attempt
      const s1 = createSession(db, { goalId: GOAL_ID, mode: "practice" });
      const a1 = openAttempt(db, "challenge", 1, s1.id).attempt;
      submitAttempt(db, a1.id, { responseText: "Wrong." });
      recordAssessment(db, a1.id, {
        evaluatorType: "agent",
        assessmentBasis: "frozen_rubric",
        objectiveResults: [
          {
            objectiveId: OBJECTIVE_ID,
            result: "incorrect",
            criteriaMet: [],
            criteriaUnmet: ["mechanism"],
            misconceptionsObserved: [miscId],
            rationale: "Observed misconception.",
          },
        ],
      });
      completeSessionFeedback(db, s1.id);

      // Next attempt: incorrect with 0 met criteria MUST reject misconceptionsCleared
      const s2 = createSession(db, { goalId: GOAL_ID, mode: "practice" });
      const a2 = openAttempt(db, "challenge", 1, s2.id).attempt;
      submitAttempt(db, a2.id, { responseText: "Still wrong." });
      expect(() =>
        recordAssessment(db, a2.id, {
          evaluatorType: "agent",
          assessmentBasis: "frozen_rubric",
          objectiveResults: [
            {
              objectiveId: OBJECTIVE_ID,
              result: "incorrect",
              criteriaMet: [],
              criteriaUnmet: ["mechanism"],
              misconceptionsCleared: [miscId],
              rationale: "Cannot clear without met linked criterion.",
            },
          ],
        }),
      ).toThrow(/without meeting a frozen criterion linked to it/);
      db.prepare("DELETE FROM attempts WHERE id = ?").run(a2.id);
      db.prepare("DELETE FROM sessions WHERE id = ?").run(s2.id);

      // Unrelated CORRECT answer whose rubric has NO link to miscId MUST ALSO reject misconceptionsCleared
      registerChallenge(db, {
        id: "unrelated-correct-no-link",
        version: 1,
        publicPrompt: "Explain an unrelated callback ordering rule.",
        taskForm: "explanation",
        deliveryContext: "practice",
        targets: [{ objectiveId: OBJECTIVE_ID, novelty: "variant", criterionIds: ["callback-order"] }],
        rubric: {
          id: "unrelated-correct-rubric",
          version: 1,
          criteria: [
            { id: "callback-order", objectiveId: OBJECTIVE_ID, required: true, description: "Callback order." },
          ],
        },
        verification: { required: false, basis: "frozen_rubric" },
      });
      const s2b = createSession(db, { goalId: GOAL_ID, mode: "practice" });
      const a2b = openAttempt(db, "unrelated-correct-no-link", 1, s2b.id).attempt;
      submitAttempt(db, a2b.id, { responseText: "Microtasks drain before timers." });
      expect(() =>
        recordAssessment(db, a2b.id, {
          evaluatorType: "agent",
          assessmentBasis: "frozen_rubric",
          objectiveResults: [
            {
              objectiveId: OBJECTIVE_ID,
              result: "correct",
              criteriaMet: ["callback-order"],
              criteriaUnmet: [],
              misconceptionsCleared: [miscId],
              rationale: "Unrelated correct answer must not clear saturation misconception.",
            },
          ],
        }),
      ).toThrow(/without meeting a frozen criterion linked to it/);
      expect(
        getWeaknessProjections(db, OBJECTIVE_ID).find(
          (row) => row.category === `misconception:${miscId}`,
        )?.lifecycle,
      ).toBe("new");
      db.prepare("DELETE FROM attempts WHERE id = ?").run(a2b.id);
      db.prepare("DELETE FROM sessions WHERE id = ?").run(s2b.id);

      // Dual-criterion rubric-order independence: both [A, B] and [B, A] with A unmet & B met must keep claim unresolved
      const claimId = "dual-criterion-claim";
      createClaim(db, { id: claimId, conceptId: "concept", description: "Needs both A and B." });
      for (const order of [["crit-a", "crit-b"], ["crit-b", "crit-a"]] as const) {
        const chId = `dual-${order.join("-")}`;
        registerChallenge(db, {
          id: chId,
          version: 1,
          publicPrompt: "Test both A and B.",
          taskForm: "explanation",
          deliveryContext: "practice",
          targets: [{ objectiveId: OBJECTIVE_ID, novelty: "variant", criterionIds: [...order] }],
          rubric: {
            id: `${chId}-rubric`,
            version: 1,
            criteria: order.map((id) => ({
              id,
              objectiveId: OBJECTIVE_ID,
              required: true,
              description: `Criterion ${id}`,
              claimIds: [claimId],
            })),
          },
          verification: { required: false, basis: "frozen_rubric" },
        });
        const sess = createSession(db, { goalId: GOAL_ID, mode: "practice" });
        const att = openAttempt(db, chId, 1, sess.id).attempt;
        submitAttempt(db, att.id, { responseText: "Met B only, missed A." });
        recordAssessment(db, att.id, {
          evaluatorType: "agent",
          assessmentBasis: "frozen_rubric",
          objectiveResults: [
            {
              objectiveId: OBJECTIVE_ID,
              result: "partially_correct",
              criteriaMet: ["crit-b"],
              criteriaUnmet: ["crit-a"],
              rationale: "A failed, B passed.",
            },
          ],
        });
        completeSessionFeedback(db, sess.id);
        const w = getWeaknessProjections(db, OBJECTIVE_ID).find(
          (row) => row.category === `claim:${claimId}`,
        );
        expect(w?.lifecycle).not.toBe("resolved");
      }
    } finally {
      db.close();
    }
  });

  it("preserves clarify answers in handoff, blocks parking submitted work, exposes MCP abandon, and fixes partial-invalidation actions", () => {
    const dir = mkdtempSync(join(tmpdir(), "learning-os-handoff-p2-"));
    dirs.push(dir);
    const dbPath = join(dir, "tutor.db");
    const fixture = createKernelFixture(dbPath);
    const db = fixture.db;
    const secondObj = "concept:predict";
    createLearningObjective(db, { id: secondObj, conceptId: "concept", capabilityId: "predict" });
    setGoalObjective(db, { goalId: GOAL_ID, objectiveId: secondObj, importance: "core" });
    registerChallenge(db, {
      id: "two-target-ch",
      version: 1,
      publicPrompt: "Explain AND predict the transition.",
      taskForm: "explanation",
      deliveryContext: "practice",
      targets: [
        { objectiveId: OBJECTIVE_ID, novelty: "same", criterionIds: ["c1"] },
        { objectiveId: secondObj, novelty: "same", criterionIds: ["c2"] },
      ],
      rubric: {
        id: "two-target-rubric",
        version: 1,
        criteria: [
          { id: "c1", objectiveId: OBJECTIVE_ID, required: true, description: "Explain." },
          { id: "c2", objectiveId: secondObj, required: true, description: "Predict." },
        ],
      },
      verification: { required: false, basis: "frozen_rubric" },
    });

    const s1 = createSession(db, { goalId: GOAL_ID, mode: "practice" });
    const a1 = openAttempt(db, "two-target-ch", 1, s1.id).attempt;
    const q1 = openAttemptSubquestion(db, a1.id, { promptText: "Explain and predict.", questionChunking: "default" });
    db.close();

    // Clarify saves part 1 -> fresh study_next must return part 1 in answeredSubquestions
    const clarified = callLearningOsTool("study_submit", {
      dbPath,
      action: "clarify",
      attemptId: a1.id,
      seq: q1.seq,
      responseText: "Part 1 partial claim.",
      followUpQuestion: { promptText: "What exact value prints?" },
    });
    const q2Seq = (clarified.subquestion as { seq: number }).seq;
    const afterClarify = callLearningOsTool("study_next", { dbPath, goalId: GOAL_ID });
    expect(afterClarify).toMatchObject({
      continuation: {
        kind: "resume",
        commitment: {
          publicPrompt: "Explain AND predict the transition.",
          answeredSubquestions: [{ seq: q1.seq, responseText: "Part 1 partial claim." }],
        },
      },
    });

    // Submit attempt without assessing -> parking submitted session must be REJECTED
    const db2 = createDatabase(dbPath);
    submitAttempt(db2, a1.id, { questionSeq: q2Seq, responseText: "Final answer." });
    expect(() => setGoalBookmark(db2, GOAL_ID, { parkedSessionId: s1.id })).toThrow(/Cannot park/);

    // Assess both targets, then invalidate ONLY one -> allowedActions must be ['revise_evidence'] (not assess_submitted)
    const committed = recordAssessment(db2, a1.id, {
      evaluatorType: "agent",
      assessmentBasis: "frozen_rubric",
      objectiveResults: [
        { objectiveId: OBJECTIVE_ID, result: "correct", criteriaMet: ["c1"], criteriaUnmet: [], rationale: "OK" },
        { objectiveId: secondObj, result: "correct", criteriaMet: ["c2"], criteriaUnmet: [], rationale: "OK" },
      ],
    });
    reviseEvidence(db2, committed.evidenceEvents[0]!.id, { action: "invalidate", reason: "Recheck c1." });
    const partialResume = getStudyContinuation(db2, { goalId: GOAL_ID });
    expect(partialResume).toMatchObject({
      kind: "resume",
      commitment: { alreadySubmitted: true },
      allowedActions: ["revise"],
    });
    reviseEvidence(db2, committed.evidenceEvents[0]!.id, { action: "restore", reason: "OK" });
    completeSessionFeedback(db2, s1.id);

    // Open another unsubmitted session and abandon it via MCP study_submit(action='abandon')
    const s2 = createSession(db2, { goalId: GOAL_ID, mode: "practice" });
    openAttempt(db2, "two-target-ch", 1, s2.id);
    db2.close();

    const abandoned = callLearningOsTool("study_submit", { dbPath, action: "abandon", sessionId: s2.id });
    expect(abandoned).toMatchObject({ action: "abandon", session: { id: s2.id, phase: "complete" } });
  });

  it("prevents silent goal creation in startSession/setGoalObjective, rejects strengthened bank reimport, and defaults trace coverage to unknown", () => {
    const db = createDatabase(":memory:");
    try {
      createTopic(db, { id: "backend-systems", name: "Backend Systems" });
      createConcept(db, { id: "tx", topicId: "backend-systems", title: "Transactions" });
      createLearningObjective(db, { id: "tx:explain", conceptId: "tx", capabilityId: "explain" });
      createGoal(db, { id: "goal-backend-systems", name: "Backend Goal", purpose: "interview" });
      setGoalObjective(db, { goalId: "goal-backend-systems", objectiveId: "tx:explain", importance: "core" });

      // Failed setGoalObjective must NOT leave behind any phantom goal
      expect(() =>
        setGoalObjective(db, { goalId: "backend-systems", objectiveId: "tx:explain" }),
      ).toThrow(/Goal not found/);
      expect(() =>
        setGoalObjective(db, { goalId: "goal-backend-systems", objectiveId: "missing:explain" }),
      ).toThrow(/Learning objective not found/);
      expect(listGoals(db).map((g) => g.id)).toEqual(["goal-backend-systems"]);

      // Offline startSession for content topic reuses existing goal-backend-systems (no duplicate goal)
      // and endSession returns goalId separately without mislabeling it as topicId
      const started = startSession(db, { topicId: "backend-systems", mode: "learn" });
      expect(started.sessionId).toBeGreaterThan(0);
      expect(started.topicId).toBe("backend-systems");
      expect(started.goalId).toBe("goal-backend-systems");
      expect(listGoals(db).map((g) => g.id)).toEqual(["goal-backend-systems"]);

      const endedWithTopic = endSession(db, started.sessionId, started.topicId);
      expect(endedWithTopic).toMatchObject({
        sessionId: started.sessionId,
        goalId: "goal-backend-systems",
        topicId: "backend-systems",
      });

      const started2 = startSession(db, { topicId: "backend-systems", mode: "learn" });
      const endedWithoutTopic = endSession(db, started2.sessionId);
      expect(endedWithoutTopic.goalId).toBe("goal-backend-systems");
      expect(endedWithoutTopic.topicId).toBeUndefined();

      // Reimporting question bank item with strengthened verification.required must throw
      materializeQuestionBank(db, {
        topic: { id: "bank-topic", name: "Bank" },
        items: [
          {
            id: "q-verif-1",
            prompt: "Predict output.",
            concept: { id: "c-v", title: "CV" },
            capability: "predict",
            taskForm: "runtime_trace",
            source: "bank",
            externalId: "e-1",
            criterion: "Matches output.",
            verification: { required: false, basis: "frozen_rubric" },
          },
        ],
      });
      expect(() =>
        materializeQuestionBank(db, {
          topic: { id: "bank-topic", name: "Bank" },
          items: [
            {
              id: "q-verif-1",
              prompt: "Predict output.",
              concept: { id: "c-v", title: "CV" },
              capability: "predict",
              taskForm: "runtime_trace",
              source: "bank",
              externalId: "e-1",
              criterion: "Matches output.",
              verification: { required: true, basis: "deterministic_execution" },
            },
          ],
        }),
      ).toThrow(/grading specification conflict/i);

      // Empty trace with no declared coverage defaults to unknown and does not fabricate missing reads
      const undeclared = summarizeHarnessTrace({
        expectedInstructionPaths: ["AGENTS.md"],
        events: [],
      });
      expect(undeclared).toMatchObject({
        traceStatus: "unknown",
        coverage: "unknown",
        instructionAccess: { status: "unknown", observedPaths: [] },
      });
      expect(undeclared.instructionAccess.missingExpectedPaths).toBeUndefined();
    } finally {
      db.close();
    }
  });

  it("captures uncheckpointed WAL goals when backing up a live profile via SQLite backup API", async () => {
    const dir = mkdtempSync(join(tmpdir(), "learning-os-wal-backup-"));
    dirs.push(dir);
    const livePath = join(dir, "live.db");
    const copyPath = join(dir, "smoke.db");
    const live = createDatabase(livePath);
    try {
      createTopic(live, { id: "t-wal", name: "WAL Topic" });
      createConcept(live, { id: "c-wal", topicId: "t-wal", title: "WAL Concept" });
      createLearningObjective(live, { id: "c-wal:explain", conceptId: "c-wal", capabilityId: "explain" });
      createGoal(live, { id: "goal-wal", name: "WAL Goal", purpose: "interview" });
      setGoalObjective(live, { goalId: "goal-wal", objectiveId: "c-wal:explain", importance: "core" });

      // Keep `live` open so committed rows remain in the WAL, then back up via readonly handle
      const reader = new Database(livePath, { readonly: true });
      try {
        await reader.backup(copyPath);
      } finally {
        reader.close();
      }

      const next = callLearningOsTool(
        "study_next",
        { dbPath: copyPath, goalId: "goal-wal", oneEpisode: true },
        { knowledgeRoot },
      );
      expect(next).toMatchObject({
        continuation: { kind: "recommend", item: { objectiveId: "c-wal:explain" } },
      });
    } finally {
      live.close();
    }
  });

  it("verifies packaged prediction cases via MCP action='verify' (new & already-submitted), rejects unmatched custom cases, and serves packaged SKILL.md via MCP + CLI study", () => {
    // 1. MCP initialize.instructions matches packaged SKILL.md body verbatim and publishes nested assessment schema
    const skillRaw = readFileSync(join(repoRoot, "skills", "learning-os-teacher", "SKILL.md"), "utf8");
    const skillBody = skillRaw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/u, "").trim();
    expect(loadPackagedSkillInstructions()).toBe(skillBody);

    const initResp = handleJsonRpcMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26" },
    });
    expect((initResp?.result as { instructions: string }).instructions).toBe(skillBody);

    const submitSchema = MCP_TOOLS.find((t) => t.name === "study_submit")!.inputSchema as {
      properties: { assessment: { required: string[]; properties: { objectiveResults: { items: { required: string[] } } } } };
    };
    expect(submitSchema.properties.assessment.required).toEqual([
      "evaluatorType",
      "assessmentBasis",
      "objectiveResults",
    ]);
    expect(submitSchema.properties.assessment.properties.objectiveResults.items.required).toEqual(
      expect.arrayContaining(["objectiveId", "result", "criteriaMet", "criteriaUnmet", "rationale"]),
    );

    // 2. action='verify' commits an unsubmitted response and executes the packaged Node case
    const dir = mkdtempSync(join(tmpdir(), "learning-os-mcp-verify-"));
    dirs.push(dir);
    const dbPath = join(dir, "tutor.db");
    const prepared = prepareTeacherScenario("calibrated_promises_missing_return_answer", dbPath);
    const scenario = teacherScenarios.find((s) => s.id === "calibrated_promises_missing_return_answer")!;

    const verifiedFirst = callLearningOsTool(
      "study_submit",
      {
        dbPath,
        action: "verify",
        attemptId: prepared.attemptId,
        questionSeq: prepared.initialQuestionSeq!,
        responseText: scenario.learnerMessage,
      },
      { knowledgeRoot },
    ) as { verificationOutput: Record<string, unknown>; alreadySubmitted: boolean };
    expect(verifiedFirst).toMatchObject({
      action: "verify",
      attemptId: prepared.attemptId,
      alreadySubmitted: false,
      verificationOutput: {
        outcome: "passed",
        basis: "deterministic_execution",
        details: { stdout: ["next got undefined", "saved draft"] },
      },
    });

    // Idempotent retry on already-submitted attempt succeeds; conflicting text is rejected
    const verifiedRetry = callLearningOsTool(
      "study_submit",
      { dbPath, action: "verify", attemptId: prepared.attemptId },
      { knowledgeRoot },
    );
    expect(verifiedRetry).toMatchObject({
      action: "verify",
      alreadySubmitted: true,
      verificationOutput: { details: { stdout: ["next got undefined", "saved draft"] } },
    });
    expect(() =>
      callLearningOsTool(
        "study_submit",
        { dbPath, action: "verify", attemptId: prepared.attemptId, responseText: "altered" },
        { knowledgeRoot },
      ),
    ).toThrow(/already submitted/i);

    // Passing returned verificationOutput straight into assess closes feedback and passes all scenario checks
    const assessed = callLearningOsTool(
      "study_submit",
      {
        dbPath,
        action: "assess",
        attemptId: prepared.attemptId,
        assessment: {
          evaluatorType: "agent",
          assessmentBasis: "mixed",
          verificationOutput: verifiedFirst.verificationOutput,
          objectiveResults: [
            {
              objectiveId: prepared.objectiveId,
              result: "correct",
              criteriaMet: ["output_order", "settlement_link"],
              criteriaUnmet: [],
              rationale: "Matched verified output and explained missing return settlement.",
            },
          ],
        },
      },
      { knowledgeRoot },
    );
    expect(assessed).toMatchObject({ action: "assess", feedbackClosed: true });
    expect(inspectTeacherScenario(dbPath, prepared).every((check) => check.passed)).toBe(true);

    // 3. Unmatched custom challenge rejects verify cleanly while preserving committed response and 0 evidence
    const customDbPath = join(dir, "custom.db");
    const fixture = createKernelFixture(customDbPath);
    const { attemptId } = fixture.openPracticeAttempt();
    fixture.db.close();
    expect(() =>
      callLearningOsTool(
        "study_submit",
        { dbPath: customDbPath, action: "verify", attemptId, responseText: "My custom prediction." },
        { knowledgeRoot },
      ),
    ).toThrow(/No packaged deterministic case matches/);
    const customDb = createDatabase(customDbPath);
    try {
      expect(customDb.prepare("SELECT response_text FROM attempts WHERE id = ?").get(attemptId)).toEqual({
        response_text: "My custom prediction.",
      });
      expect(customDb.prepare("SELECT COUNT(*) AS c FROM evidence_events").get()).toEqual({ c: 0 });
    } finally {
      customDb.close();
    }

    // 4. Local CLI `tutor study describe` & `tutor study study_next` forward cleanly to the shared 5-tool dispatcher
    const cliTs = join(repoRoot, "src", "cli.ts");
    const described = runSync(tsxBin, [cliTs, "study", "describe", "study_submit"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(described.status).toBe(0);
    expect(JSON.parse(described.stdout)).toMatchObject({ name: "study_submit" });

    const cliNext = runSync(
      tsxBin,
      [cliTs, "study", "study_next", JSON.stringify({ dbPath: customDbPath, goalId: GOAL_ID })],
      { cwd: repoRoot, encoding: "utf8" },
    );
    expect(cliNext.status).toBe(0);
    expect(JSON.parse(cliNext.stdout)).toMatchObject({
      continuation: { kind: "resume", commitment: { alreadySubmitted: true } },
    });
  });
});
