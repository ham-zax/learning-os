import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createConcept,
  createDatabase,
  createTopic,
  setGoalObjective,
  setGoalPreparation,
} from "../src/db/database.js";
import { createLearningObjective } from "../src/kernel/foundation.js";
import { handleJsonRpcMessage } from "../src/mcp-server.js";
import { callLearningOsTool, MCP_TOOLS } from "../src/mcp/tools.js";
import { createKernelFixture, GOAL_ID, OBJECTIVE_ID } from "./helpers/kernel-fixture.js";
import { runSync } from "./helpers/spawn.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const knowledgeRoot = join(repoRoot, "knowledge");
const tsxBin = join(repoRoot, "node_modules", ".bin", "tsx");
const mcpEntryPath = join(repoRoot, "src", "mcp-server.ts");

function createCalibratedTransactionDb(dbPath: string): void {
  const db = createDatabase(dbPath);
  try {
    createTopic(db, { id: "goal-tx", name: "Backend Transactions" });
    createConcept(db, {
      id: "database-transactions-and-concurrent-correctness",
      topicId: "goal-tx",
      title: "Database transactions and concurrent correctness",
    });
    const objectiveId = "database-transactions-and-concurrent-correctness:predict";
    createLearningObjective(db, {
      id: objectiveId,
      conceptId: "database-transactions-and-concurrent-correctness",
      capabilityId: "predict",
    });
    setGoalObjective(db, {
      goalId: "goal-tx",
      objectiveId,
      importance: "core",
      targetReadiness: "independent",
    });
    setGoalPreparation(db, {
      goalId: "goal-tx",
      purpose: "interview",
      minutesPerDay: 30,
      confirmedAt: "2026-09-01T00:00:00.000Z",
    });
  } finally {
    db.close();
  }
}

describe("Learning OS 5-tool MCP server", () => {
  let root: string;
  let dbPath: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "learning-os-mcp-"));
    dbPath = join(root, "tutor.db");
    createKernelFixture(dbPath).db.close();
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("exposes 5 coarse-grained tools and speaks valid MCP JSON-RPC 2.0", () => {
    expect(MCP_TOOLS.map((t) => t.name)).toEqual([
      "study_next",
      "study_submit",
      "study_help",
      "study_status",
      "study_notes",
    ]);

    const init = handleJsonRpcMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1" } },
    });
    expect(init).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "learning-os" },
      },
    });

    // Notifications produce no response
    expect(
      handleJsonRpcMessage({ jsonrpc: "2.0", method: "notifications/initialized" }),
    ).toBeNull();

    expect(handleJsonRpcMessage({ jsonrpc: "2.0", id: 2, method: "ping" })).toEqual({
      jsonrpc: "2.0",
      id: 2,
      result: {},
    });

    const listed = handleJsonRpcMessage({ jsonrpc: "2.0", id: 3, method: "tools/list" });
    expect((listed?.result as { tools: unknown[] }).tools).toHaveLength(5);

    const unknownMethod = handleJsonRpcMessage({ jsonrpc: "2.0", id: 4, method: "resources/list" });
    expect(unknownMethod?.error?.code).toBe(-32601);

    const unknownTool = handleJsonRpcMessage({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "does_not_exist", arguments: {} },
    });
    expect(unknownTool?.error?.code).toBe(-32602);
  });

  it("runs a complete calibrated episode atomically: study_next -> study_help(scaffold) -> study_submit -> repair -> reconstruct -> study_notes", () => {
    const txDbPath = join(root, "tx.db");
    createCalibratedTransactionDb(txDbPath);
    const ctx = { knowledgeRoot };
    const objectiveId = "database-transactions-and-concurrent-correctness:predict";

    // 1. Read-only recommendation discovers both calibrated pack and scaffold pack
    const rec = callLearningOsTool("study_next", { dbPath: txDbPath, oneEpisode: true }, ctx);
    expect(rec).toMatchObject({
      continuation: { kind: "recommend" },
      calibratedMatch: { packId: "transaction-predict", caseId: "last-seat-baseline" },
      availableScaffolds: [
        expect.objectContaining({ packId: "database-transactions-predict" }),
      ],
    });

    // 2. autoOpenCalibrated opens challenge + session + attempt + subquestion in 1 atomic call
    const opened = callLearningOsTool(
      "study_next",
      { dbPath: txDbPath, oneEpisode: true, autoOpenCalibrated: true },
      ctx,
    );
    expect(opened).toMatchObject({
      kind: "opened",
      presentation: { kind: "question", purpose: "response" },
      teacherOnlyCalibration: { expectedOutput: expect.any(Array) },
    });
    const sessionId = (opened.session as { id: number }).id;
    const attemptId = (opened.attempt as { id: number }).id;
    const seq = (opened.presentation as { seq: number }).seq;

    // 3. Calling study_next again resumes the open session instead of opening a duplicate
    const resumed = callLearningOsTool(
      "study_next",
      { dbPath: txDbPath, oneEpisode: true, autoOpenCalibrated: true },
      ctx,
    );
    expect(resumed).toMatchObject({
      continuation: { kind: "resume", session: { session: { id: sessionId } } },
    });

    // 4. Ambiguous answer -> clarify in 1 call
    const clarified = callLearningOsTool(
      "study_submit",
      {
        dbPath: txDbPath,
        action: "clarify",
        attemptId,
        seq,
        responseText: "One of them fails.",
        followUpQuestion: { promptText: "Which caller is rejected and what is the final seats count?" },
      },
      ctx,
    );
    const nextSeq = (clarified.subquestion as { seq: number }).seq;
    expect(nextSeq).toBeGreaterThan(seq);

    // 5. Submit incorrect causal model -> stays in review_gap
    const wrong = callLearningOsTool(
      "study_submit",
      {
        dbPath: txDbPath,
        action: "assess",
        attemptId,
        questionSeq: nextSeq,
        responseText: "A accepted, B rejected, seats 0 because updates are atomic.",
        assessment: {
          evaluatorType: "agent",
          assessmentBasis: "deterministic_execution",
          verificationOutput: {
            outcome: "passed",
            basis: "deterministic_execution",
            summary: "Ran baseline.mjs",
            details: { stdout: ["A:accepted", "B:accepted", "decisions:[true,true]", "seats:-1"] },
          },
          objectiveResults: [{
            objectiveId,
            result: "incorrect",
            criteriaMet: [],
            criteriaUnmet: ["observable_outcome", "invariant_boundary"],
            observedErrors: ["atomic_write_implies_atomic_check_and_act"],
            rationale: "Conflated single write atomicity with check-then-act interleaving.",
          }],
        },
      },
      ctx,
    );
    expect(wrong).toMatchObject({
      feedbackClosed: false,
      feedback: { nextAction: "review_gap" },
      relianceSummary: { totalGradableEvidence: 1, cleanIndependentCorrect: 0 },
    });

    // 6. Record causal repair + reconstruction question atomically via study_help
    const repair = callLearningOsTool(
      "study_help",
      {
        dbPath: txDbPath,
        kind: "exposure",
        sessionId,
        attemptId,
        objectiveIds: [objectiveId],
        exposureType: "corrective_feedback_shown",
        content: "Both callers pass the check before either decrements across the await yield.",
        requireReconstruction: true,
        reconstructionQuestion: {
          promptText: "Why can both callers succeed even when each decrement is single-threaded?",
        },
      },
      ctx,
    );
    const reconSeq = (repair.presentation as { seq: number; purpose: string }).seq;
    expect((repair.presentation as { purpose: string }).purpose).toBe("reconstruction");

    // 7. Resolve reconstruction via study_submit
    const reconstructed = callLearningOsTool(
      "study_submit",
      {
        dbPath: txDbPath,
        action: "reconstruct",
        sessionId,
        outcome: "completed",
        questionSeq: reconSeq,
        responseText: "Because both read seats=1 before the yield, so both decrement afterward.",
      },
      ctx,
    );
    expect(reconstructed).toMatchObject({
      session: { phase: "complete", reconstruction_status: "completed" },
    });

    // 8. Check study_status dashboard & study_notes evidence_receipt
    const status = callLearningOsTool("study_status", { dbPath: txDbPath }, ctx);
    expect(status).toMatchObject({
      openSessions: [],
      goal: { goalId: "goal-tx", byReadiness: { exposed: 1 } },
      reliance: { totalGradableEvidence: 1, cleanIndependentCorrect: 0, assistedOrHinted: 0 },
    });

    const receipt = callLearningOsTool(
      "study_notes",
      { dbPath: txDbPath, action: "evidence_receipt", objectiveId },
      ctx,
    );
    expect(receipt).toMatchObject({
      receipt: { objective: { objectiveId }, projection: { readiness: "exposed" } },
    });

    // 9. Revision notes round-trip: get_context -> save -> list -> get
    const noteCtx = callLearningOsTool(
      "study_notes",
      { dbPath: txDbPath, action: "get_context", scope: { kind: "objective", objectiveId } },
      ctx,
    );
    expect(noteCtx).toMatchObject({
      context: { scope: { kind: "objective", objectiveId } },
    });
    const saved = callLearningOsTool(
      "study_notes",
      {
        dbPath: txDbPath,
        action: "save",
        scope: { kind: "objective", objectiveId },
        title: "Check-then-act invariant",
        markdown: "Atomic single writes do not make check-then-act atomic across awaits.",
      },
      ctx,
    );
    const noteId = (saved.note as { id: string }).id;
    const listedNotes = callLearningOsTool("study_notes", { dbPath: txDbPath, action: "list" }, ctx);
    expect((listedNotes.notes as Array<{ id: string }>).map((n) => n.id)).toContain(noteId);
    const fetchedNote = callLearningOsTool(
      "study_notes",
      { dbPath: txDbPath, action: "get", noteId },
      ctx,
    );
    expect(fetchedNote).toMatchObject({
      note: { id: noteId, title: "Check-then-act invariant" },
    });
  });

  it("enforces scaffold pre-display persistence and returns structured isError on invalid arguments", () => {
    const txDbPath = join(root, "tx-scaffold.db");
    createCalibratedTransactionDb(txDbPath);
    const ctx = { knowledgeRoot };

    const opened = callLearningOsTool(
      "study_next",
      { dbPath: txDbPath, oneEpisode: true, autoOpenCalibrated: true },
      ctx,
    );
    const sessionId = (opened.session as { id: number }).id;

    // Persist worked_example scaffold via study_help before showing to learner
    const scaffold = callLearningOsTool(
      "study_help",
      {
        dbPath: txDbPath,
        kind: "scaffold",
        sessionId,
        packId: "database-transactions-predict",
        stage: "worked_example",
      },
      ctx,
    );
    expect(scaffold).toMatchObject({
      kind: "scaffold",
      stage: "worked_example",
      markdown: expect.stringContaining("withLock"),
    });

    // Reject responseText when opting out of reconstruction (via JSON-RPC isError envelope)
    const errResp = handleJsonRpcMessage(
      {
        jsonrpc: "2.0",
        id: 99,
        method: "tools/call",
        params: {
          name: "study_submit",
          arguments: {
            dbPath: txDbPath,
            action: "reconstruct",
            sessionId,
            outcome: "opted_out",
            responseText: "Should not be accepted on opt-out",
          },
        },
      },
      ctx,
    );
    expect(errResp).toMatchObject({
      id: 99,
      result: { isError: true },
    });
  });

  it("supports custom challengeSpec open, split, hint, closeIfComplete=true, and stdio JSON-RPC round-trip", () => {
    const messages = [
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "vitest", version: "1.0" } },
      }),
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "study_status", arguments: { dbPath } },
      }),
      JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "study_next",
          arguments: {
            dbPath,
            oneEpisode: true,
            promptText: "Explain the causal state transition.",
            challengeSpec: {
              id: "mcp-custom-1",
              version: 1,
              publicPrompt: "Consider a stateful system transition.",
              taskForm: "explanation",
              deliveryContext: "learn",
              targets: [{ objectiveId: OBJECTIVE_ID, novelty: "same", criterionIds: ["mechanism"] }],
              rubric: {
                id: "mcp-custom-1-rubric",
                version: 1,
                criteria: [{ id: "mechanism", objectiveId: OBJECTIVE_ID, required: true, description: "Explains transition" }],
              },
              verification: { required: false, basis: "frozen_rubric" },
            },
          },
        },
      }),
    ].join("\n") + "\n";

    const proc = runSync(tsxBin, [mcpEntryPath], {
      cwd: repoRoot,
      input: messages,
      encoding: "utf8",
    });
    expect(proc.status).toBe(0);
    const lines = proc.stdout.trim().split("\n").map((line) => JSON.parse(line));
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ id: 1, result: { serverInfo: { name: "learning-os" } } });

    const statusPayload = JSON.parse(lines[1].result.content[0].text);
    expect(statusPayload).toMatchObject({ goal: { goalId: GOAL_ID, totalActiveObjectives: 1 } });

    const openedPayload = JSON.parse(lines[2].result.content[0].text);
    expect(openedPayload).toMatchObject({ kind: "opened", presentation: { kind: "question" } });

    const attemptId = openedPayload.attempt.id as number;
    const seq = openedPayload.presentation.seq as number;

    // Split question into atomic criterion-scoped step
    const split = callLearningOsTool("study_submit", {
      dbPath,
      action: "split",
      attemptId,
      seq,
      promptText: "Just state what triggers the transition.",
      scopeCriterionId: "mechanism",
      scopeNote: "Names the input triggering state transition.",
    });
    const atomicSeq = (split.subquestion as { seq: number }).seq;

    // Record a hint before answering -> retrieval_valid becomes false, reflected in relianceSummary
    callLearningOsTool("study_help", {
      dbPath,
      kind: "hint",
      attemptId,
      level: 1,
      scope: { objectiveId: OBJECTIVE_ID },
    });

    const assessed = callLearningOsTool("study_submit", {
      dbPath,
      action: "assess",
      attemptId,
      questionSeq: atomicSeq,
      responseText: "The input triggers a deterministic transition to the next state.",
      assessment: {
        evaluatorType: "agent",
        assessmentBasis: "frozen_rubric",
        objectiveResults: [{
          objectiveId: OBJECTIVE_ID,
          result: "correct",
          criteriaMet: ["mechanism"],
          criteriaUnmet: [],
          rationale: "Correct with L1 hint.",
        }],
      },
    });
    expect(assessed).toMatchObject({
      feedbackClosed: true,
      relianceSummary: {
        totalGradableEvidence: 1,
        cleanIndependentCorrect: 0,
        assistedOrHinted: 1,
        independentSuccessRate: 0,
      },
    });
  });
});
