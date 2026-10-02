import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runSync } from "./helpers/spawn.js";
import { afterEach, describe, expect, it } from "vitest";
import { createConcept, createDatabase, createTopic, setGoalObjective } from "../src/db/database.js";
import {
  parseOutcomeManifest, summarizeLearningOutcomes, type OutcomeManifest,
} from "../src/evaluation/learning-outcomes.js";
import { createTeacherKernel } from "../src/teacher.js";

const knowledgeRoot = fileURLToPath(new URL("../knowledge", import.meta.url));
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

/** Timestamps are millisecond-resolution; spin so consecutive steps never share a millisecond. */
function tick(): void {
  const start = Date.now();
  while (Date.now() === start) { /* wait for the next millisecond */ }
}

type Kernel = ReturnType<typeof createTeacherKernel>;
let counter = 0;

function addObjective(db: ReturnType<typeof createDatabase>, kernel: Kernel, key: string): string {
  const objectiveId = `${key}:explain`;
  createTopic(db, { id: `goal-${key}`, name: `Goal ${key}` });
  createConcept(db, { id: `concept-${key}`, topicId: `goal-${key}`, title: key });
  kernel.createLearningObjective({ id: objectiveId, conceptId: `concept-${key}`, capabilityId: "explain" });
  setGoalObjective(db, { goalId: `goal-${key}`, objectiveId, importance: "core", targetReadiness: "guided" });
  return objectiveId;
}

interface AttemptOptions { result: "correct" | "partially_correct" | "incorrect"; assisted?: boolean; seconds?: number }

/** One complete frozen-rubric attempt through the public kernel; returns identifiers a manifest would cite. */
function runAttempt(kernel: Kernel, key: string, objectiveId: string, options: AttemptOptions) {
  const challengeId = `challenge-${key}-${++counter}`;
  kernel.registerChallenge({
    id: challengeId, version: 1, publicPrompt: "Explain the mechanism.", taskForm: "explanation",
    deliveryContext: "practice",
    targets: [{ objectiveId, novelty: "same", criterionIds: ["mechanism"] }],
    rubric: { id: `rubric-${challengeId}`, version: 1, criteria: [{ id: "mechanism", objectiveId, required: true,
      description: "Explains the mechanism." }] },
    verification: { required: false, basis: "frozen_rubric" },
  });
  tick();
  const sessionId = kernel.createSession(`goal-${key}`, "practice").id;
  const attemptId = kernel.openAttempt(challengeId, 1, sessionId).attempt.id;
  if (options.assisted) {
    tick();
    kernel.recordExposure(sessionId, { attemptId, objectiveIds: [objectiveId], exposureType: "explanation_shown",
      teachingMaterial: { content: "Shown before the learner answered." } });
  }
  tick();
  kernel.submitAttempt(attemptId, { responseText: "My explanation.",
    ...(options.seconds === undefined ? {} : { activeTimeSeconds: options.seconds }) });
  tick();
  const committed = kernel.recordAssessment(attemptId, { evaluatorType: "agent", assessmentBasis: "frozen_rubric",
    objectiveResults: [{ objectiveId, result: options.result,
      criteriaMet: options.result === "correct" ? ["mechanism"] : [],
      criteriaUnmet: options.result === "correct" ? [] : ["mechanism"], rationale: "Fixture assessment." }] });
  kernel.completeSessionFeedback(sessionId);
  return { attemptId, evidenceId: committed.evidenceEvents[0]!.id, objectiveId };
}

function entry(partial: Partial<OutcomeManifest["entries"][number]> & Pick<OutcomeManifest["entries"][number], "entryId" | "baseline" | "followUp">) {
  return {
    learnerRef: "L01", objectiveRef: partial.entryId, condition: "curated_scaffold" as const, database: "main",
    taskDesign: {}, intendedFollowUpDate: "2026-01-08T00:00:00.000Z",
    studyTime: { attemptIds: [], minimumCoverage: 1 }, ...partial,
  };
}

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "learning-os-outcomes-"));
  dirs.push(dir);
  const path = join(dir, "tutor.db");
  const db = createDatabase(path);
  const kernel = createTeacherKernel(db);
  return { dir, path, db, kernel };
}

function load(raw: OutcomeManifest, dir: string) {
  return parseOutcomeManifest(raw, { baseDirectory: dir, knowledgeRoot });
}

const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

describe("learning-outcome pilot report", () => {
  it("reports independent change, elapsed delay and gain per recorded study minute without altering the database", () => {
    const { dir, path, db, kernel } = setup();
    const o = addObjective(db, kernel, "a");
    const baseline = runAttempt(kernel, "a", o, { result: "incorrect" });
    const study1 = runAttempt(kernel, "a", o, { result: "partially_correct", assisted: true, seconds: 600 });
    const study2 = runAttempt(kernel, "a", o, { result: "correct", assisted: true, seconds: 300 });
    const followUp = runAttempt(kernel, "a", o, { result: "correct" });
    db.close();

    const manifest: OutcomeManifest = { version: 1, pilotId: "pilot-1", databases: { main: path }, entries: [
      entry({ entryId: "e1", baseline: { evidenceId: baseline.evidenceId },
        followUp: { evidenceId: followUp.evidenceId }, taskDesign: { form: "trace", difficulty: "medium", order: "AB" },
        studyTime: { attemptIds: [study1.attemptId, study2.attemptId], minimumCoverage: 1 } }),
    ] };
    const before = sha(path);
    const report = summarizeLearningOutcomes(load(manifest, dir), { asOf: "2026-02-01T00:00:00.000Z" });
    expect(sha(path)).toBe(before);

    const row = report.entries[0]!;
    expect(row.baseline).toMatchObject({ status: "independent", evidence: { score: 0, independent: true } });
    expect(row.followUp).toMatchObject({ status: "independent", evidence: { score: 1, independent: true } });
    expect(row.simpleChange).toBe(1);
    expect(row.studyTime).toMatchObject({ status: "adequate", recordedSeconds: 900, usableSeconds: 900, coverage: 1 });
    expect(row.gainPerStudyMinute).toBeCloseTo(1 / 15, 3);
    expect(row.elapsedDays).not.toBeNull();
    expect(row.taskDesign).toEqual({ form: "trace", difficulty: "medium", order: "AB" });
    expect(report.analysis).toMatchObject({ baselineAdjustment: "not_performed", causalClaim: "none" });
    const summary = report.conditions.find((item) => item.condition === "curated_scaffold")!;
    expect(summary.meanDelayedIndependentScore).toEqual({ n: 1, mean: 1 });
    expect(summary.meanSimpleChange).toEqual({ n: 1, mean: 1 });
  });

  it("does not treat an assisted follow-up as independent success", () => {
    const { dir, path, db, kernel } = setup();
    const o = addObjective(db, kernel, "b");
    const baseline = runAttempt(kernel, "b", o, { result: "incorrect" });
    const assisted = runAttempt(kernel, "b", o, { result: "correct", assisted: true });
    db.close();
    const report = summarizeLearningOutcomes(load({ version: 1, pilotId: "pilot-2", databases: { main: path }, entries: [
      entry({ entryId: "assisted", baseline: { evidenceId: baseline.evidenceId }, followUp: { evidenceId: assisted.evidenceId } }),
    ] }, dir), { asOf: "2026-02-01T00:00:00.000Z" });
    const row = report.entries[0]!;
    expect(row.followUp.status).toBe("assisted");
    expect(row.followUp.evidence).toMatchObject({ result: "correct", independent: false });
    expect(row.followUp.evidence!.preResponseExposures).toBeGreaterThan(0);
    expect(row.simpleChange).toBeNull();
    expect(row.gainPerStudyMinute).toBeNull();
    const summary = report.conditions.find((item) => item.condition === "curated_scaffold")!;
    expect(summary.followUps.assisted).toBe(1);
    expect(summary.followUps.independent).toBe(0);
    expect(summary.meanDelayedIndependentScore).toEqual({ n: 0, mean: null });
  });

  it("honors invalidation and follows a corrected replacement", () => {
    const { dir, path, db, kernel } = setup();
    const oInvalid = addObjective(db, kernel, "c");
    const oCorrected = addObjective(db, kernel, "d");
    const baselineC = runAttempt(kernel, "c", oInvalid, { result: "incorrect" });
    const followC = runAttempt(kernel, "c", oInvalid, { result: "correct" });
    const baselineD = runAttempt(kernel, "d", oCorrected, { result: "incorrect" });
    const followD = runAttempt(kernel, "d", oCorrected, { result: "correct" });
    kernel.reviseEvidence(followC.evidenceId, { action: "invalidate", reason: "Grader error; no replacement." });
    const revised = kernel.reviseEvidence(followD.evidenceId, { action: "invalidate", reason: "Regraded.",
      correctedObjectiveResult: { objectiveId: oCorrected, result: "partially_correct", criteriaMet: [],
        criteriaUnmet: ["mechanism"], rationale: "Corrected." } });
    expect(revised.replacementEvent).not.toBeNull();
    db.close();

    const report = summarizeLearningOutcomes(load({ version: 1, pilotId: "pilot-3", databases: { main: path }, entries: [
      entry({ entryId: "invalidated", baseline: { evidenceId: baselineC.evidenceId }, followUp: { evidenceId: followC.evidenceId } }),
      entry({ entryId: "corrected", baseline: { evidenceId: baselineD.evidenceId }, followUp: { evidenceId: followD.evidenceId } }),
    ] }, dir), { asOf: "2026-02-01T00:00:00.000Z" });
    const invalidated = report.entries.find((item) => item.entryId === "invalidated")!;
    expect(invalidated.followUp).toEqual({ status: "invalidated", evidence: null });
    expect(invalidated.simpleChange).toBeNull();
    const corrected = report.entries.find((item) => item.entryId === "corrected")!;
    expect(corrected.followUp.evidence).toMatchObject({ result: "partially_correct", score: 0.5,
      correctedFrom: followD.evidenceId });
    expect(corrected.followUp.evidence!.evidenceId).toBe(revised.replacementEvent!.id);
    expect(corrected.simpleChange).toBe(0.5);
    expect(corrected.notes.join(" ")).toMatch(/corrected/i);
  });

  it("reports missing follow-ups as pending or not returned, never as success or zero", () => {
    const { dir, path, db, kernel } = setup();
    const o1 = addObjective(db, kernel, "e");
    const o2 = addObjective(db, kernel, "f");
    const b1 = runAttempt(kernel, "e", o1, { result: "correct" });
    const b2 = runAttempt(kernel, "f", o2, { result: "correct" });
    db.close();
    const report = summarizeLearningOutcomes(load({ version: 1, pilotId: "pilot-4", databases: { main: path }, entries: [
      entry({ entryId: "late", baseline: { evidenceId: b1.evidenceId }, followUp: null, intendedFollowUpDate: "2026-01-08" }),
      entry({ entryId: "early", baseline: { evidenceId: b2.evidenceId }, followUp: null, intendedFollowUpDate: "2026-03-01" }),
      entry({ entryId: "typo", baseline: { evidenceId: "no-such-event" }, followUp: null, intendedFollowUpDate: "2026-03-01" }),
    ] }, dir), { asOf: "2026-02-01T00:00:00.000Z" });
    expect(report.entries.map((item) => item.followUp.status)).toEqual(["not_returned", "pending", "pending"]);
    expect(report.entries[2]!.baseline.status).toBe("reference_not_found");
    const summary = report.conditions.find((item) => item.condition === "curated_scaffold")!;
    expect(summary.followUps).toMatchObject({ not_returned: 1, pending: 2, independent: 0 });
    expect(summary.meanDelayedIndependentScore).toEqual({ n: 0, mean: null });
    expect(summary.meanSimpleChange).toEqual({ n: 0, mean: null });
    expect(report.entries.every((item) => item.simpleChange === null)).toBe(true);
  });

  it("keeps unknown study time unknown and treats recorded zero as a recorded value with an undefined rate", () => {
    const { dir, path, db, kernel } = setup();
    const o1 = addObjective(db, kernel, "g");
    const o2 = addObjective(db, kernel, "h");
    const o3 = addObjective(db, kernel, "i");
    const mk = (key: string, objective: string, study: AttemptOptions[]) => {
      const baseline = runAttempt(kernel, key, objective, { result: "incorrect" });
      const attempts = study.map((options) => runAttempt(kernel, key, objective, { ...options, assisted: true }));
      const followUp = runAttempt(kernel, key, objective, { result: "correct" });
      return { baseline, followUp, ids: attempts.map((attempt) => attempt.attemptId) };
    };
    const partial = mk("g", o1, [{ result: "correct", seconds: 600 }, { result: "correct" }]);
    const zero = mk("h", o2, [{ result: "correct", seconds: 0 }]);
    const none = mk("i", o3, []);
    db.close();

    const report = summarizeLearningOutcomes(load({ version: 1, pilotId: "pilot-5", databases: { main: path }, entries: [
      entry({ entryId: "partial", baseline: { evidenceId: partial.baseline.evidenceId },
        followUp: { evidenceId: partial.followUp.evidenceId }, studyTime: { attemptIds: partial.ids, minimumCoverage: 1 } }),
      entry({ entryId: "partial-lenient", baseline: { evidenceId: partial.baseline.evidenceId },
        followUp: { evidenceId: partial.followUp.evidenceId }, studyTime: { attemptIds: partial.ids, minimumCoverage: 0.5 } }),
      entry({ entryId: "zero", baseline: { evidenceId: zero.baseline.evidenceId },
        followUp: { evidenceId: zero.followUp.evidenceId }, studyTime: { attemptIds: zero.ids, minimumCoverage: 1 } }),
      entry({ entryId: "none", baseline: { evidenceId: none.baseline.evidenceId },
        followUp: { evidenceId: none.followUp.evidenceId }, studyTime: { attemptIds: none.ids, minimumCoverage: 1 } }),
    ] }, dir), { asOf: "2026-02-01T00:00:00.000Z" });
    const byId = Object.fromEntries(report.entries.map((item) => [item.entryId, item]));

    // One of two attempts has no recorded time: coverage 0.5 is inadequate at the default threshold.
    expect(byId.partial!.studyTime).toMatchObject({ status: "inadequate_coverage", coverage: 0.5,
      recordedSeconds: 600, usableSeconds: null });
    expect(byId.partial!.simpleChange).toBe(1);
    expect(byId.partial!.gainPerStudyMinute).toBeNull();
    // The same data become usable only when the entry explicitly accepts the lower coverage.
    expect(byId["partial-lenient"]!.studyTime).toMatchObject({ status: "adequate", usableSeconds: 600 });
    expect(byId["partial-lenient"]!.gainPerStudyMinute).toBeCloseTo(0.1, 3);

    // A recorded zero is a value, not unknown; it cannot support a per-minute rate.
    expect(byId.zero!.studyTime).toMatchObject({ status: "adequate", recordedSeconds: 0, usableSeconds: 0 });
    expect(byId.zero!.gainPerStudyMinute).toBeNull();
    expect(byId.zero!.notes.join(" ")).toMatch(/zero seconds/);

    // No declared study attempts: unknown, not zero.
    expect(byId.none!.studyTime).toMatchObject({ status: "none_declared", usableSeconds: null, coverage: null });
    expect(byId.none!.gainPerStudyMinute).toBeNull();
    const summary = report.conditions.find((item) => item.condition === "curated_scaffold")!;
    expect(summary.meanGainPerStudyMinute.n).toBe(1);
  });

  it("is read-only: it rejects a missing database without creating it and leaves a live one byte-identical", () => {
    const { dir, path, db, kernel } = setup();
    const o = addObjective(db, kernel, "j");
    const baseline = runAttempt(kernel, "j", o, { result: "correct" });
    db.close();
    const missing = join(dir, "does-not-exist.db");
    expect(() => summarizeLearningOutcomes(load({ version: 1, pilotId: "pilot-6", databases: { main: missing }, entries: [
      entry({ entryId: "x", baseline: { evidenceId: baseline.evidenceId }, followUp: null }),
    ] }, dir))).toThrow();
    expect(existsSync(missing)).toBe(false);

    const check = new Database(path, { readonly: true });
    const counts = () => ["evidence_events", "review_cards", "review_events", "exposure_events", "attempts"].map(
      (table) => (check.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n);
    const before = counts();
    check.close();
    summarizeLearningOutcomes(load({ version: 1, pilotId: "pilot-6", databases: { main: path }, entries: [
      entry({ entryId: "x", baseline: { evidenceId: baseline.evidenceId }, followUp: null }),
    ] }, dir));
    const reopened = createDatabase(path);
    try {
      expect(["evidence_events", "review_cards", "review_events", "exposure_events", "attempts"].map(
        (table) => (reopened.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n)).toEqual(before);
    } finally { reopened.close(); }
  });
});

describe("outcomes evaluation command", () => {
  it("prints a report from a manifest and rejects a manifest with held-out materials inside the curriculum", () => {
    const { dir, path, db, kernel } = setup();
    const o = addObjective(db, kernel, "k");
    const baseline = runAttempt(kernel, "k", o, { result: "correct" });
    db.close();
    const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
    const run = (manifest: object) => {
      const file = join(dir, "manifest.json");
      writeFileSync(file, JSON.stringify(manifest));
      return runSync(join(repoRoot, "node_modules", ".bin", "tsx"),
        [join(repoRoot, "src", "evaluation", "cli.ts"), "outcomes", file, "2026-02-01T00:00:00.000Z"],
        { cwd: dir, encoding: "utf8" });
    };
    const manifest = { version: 1, pilotId: "cli-pilot", databases: { main: "tutor.db" }, entries: [
      entry({ entryId: "c1", baseline: { evidenceId: baseline.evidenceId }, followUp: null, intendedFollowUpDate: "2026-01-08" }),
    ] };
    const ok = run(manifest);
    expect(ok.status).toBe(0);
    const report = JSON.parse(ok.stdout as string);
    expect(report.pilotId).toBe("cli-pilot");
    expect(report.entries[0].followUp.status).toBe("not_returned");
    expect(report.analysis.causalClaim).toBe("none");
    const bad = run({ ...manifest, heldOutMaterialsDirectory: join(knowledgeRoot, "held-out") });
    expect(bad.status).toBe(1);
    expect(bad.stderr as string).toMatch(/outside the curriculum/);
  });
});

describe("outcome manifest validation", () => {
  const base = (): OutcomeManifest => ({ version: 1, pilotId: "pilot", databases: { main: "tutor.db" }, entries: [
    entry({ entryId: "e1", baseline: { evidenceId: "b" }, followUp: null }),
  ] });

  it("rejects duplicate entries, unknown database aliases, unknown fields and identifying-looking refs", () => {
    const dir = tmpdir();
    const duplicate = base(); duplicate.entries.push(duplicate.entries[0]!);
    expect(() => load(duplicate, dir)).toThrow(/Duplicate entryId/);
    const unknown = base(); unknown.entries[0]!.database = "other";
    expect(() => load(unknown, dir)).toThrow(/Unknown database alias/);
    const extra = { ...base(), surprise: true } as unknown as OutcomeManifest;
    expect(() => load(extra, dir)).toThrow();
    const spaced = base(); spaced.entries[0]!.learnerRef = "Jane Doe";
    expect(() => load(spaced, dir)).toThrow(/anonymized/);
    const badDate = base(); badDate.entries[0]!.intendedFollowUpDate = "next week";
    expect(() => load(badDate, dir)).toThrow(/ISO/);
  });

  it("keeps held-out evaluation materials outside the curriculum knowledge directory", () => {
    const inside = { ...base(), heldOutMaterialsDirectory: join(knowledgeRoot, "frontend-revision", "held-out") };
    expect(() => load(inside, tmpdir())).toThrow(/outside the curriculum/);
    const outside = { ...base(), heldOutMaterialsDirectory: join(tmpdir(), "held-out") };
    expect(load(outside, tmpdir()).manifest.pilotId).toBe("pilot");
  });
});
