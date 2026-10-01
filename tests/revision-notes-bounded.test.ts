import { describe, expect, it, vi } from "vitest";
import { recordAssessment } from "../src/kernel/evidence.js";
import { submitAttempt } from "../src/kernel/foundation.js";
import { getRevisionNote, getRevisionNoteContext, listRevisionNotes, saveRevisionNote } from "../src/revision-notes.js";
import { CHALLENGE_ID, GOAL_ID, OBJECTIVE_ID, createKernelFixture } from "./helpers/kernel-fixture.js";

function historyFixture(count = 1000) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  const fixture = createKernelFixture();
  const { db } = fixture;
  const { sessionId, attemptId } = fixture.openPracticeAttempt();
  db.prepare("INSERT INTO hint_observations (attempt_id, level, scope_kind, recorded_at) VALUES (?, 1, 'all_targets', ?)").run(attemptId, "2026-01-01T00:00:00.000Z");
  vi.setSystemTime(new Date("2026-01-01T00:00:06.000Z"));
  submitAttempt(db, attemptId, { responseText: "A causal state transition." });
  recordAssessment(db, attemptId, {
    evaluatorType: "agent", assessmentBasis: "frozen_rubric",
    objectiveResults: [{ objectiveId: OBJECTIVE_ID, result: "correct", criteriaMet: ["mechanism"], criteriaUnmet: [], rationale: "Explained." }],
  });
  vi.useRealTimers();
  const sample = db.prepare("SELECT * FROM evidence_events LIMIT 1").get() as Record<string, unknown>;
  const fields = Object.keys(sample).filter((key) => key !== "seq");
  const insertEvidence = db.prepare(`INSERT INTO evidence_events (${fields.join(",")}) VALUES (${fields.map(() => "?").join(",")})`);
  const insertAttempt = db.prepare(`INSERT INTO attempts (challenge_id, challenge_version, session_id, response_text, started_at, submitted_at, created_at)
    VALUES (?, 1, ?, ?, ?, NULL, ?)`);
  const insertExposure = db.prepare(`INSERT INTO exposure_events (objective_id, session_id, attempt_id, exposure_type, occurred_at, teaching_artifact_id)
    VALUES (?, ?, ?, 'explanation_shown', ?, ?)`);
  const insertHint = db.prepare(`INSERT INTO hint_observations (attempt_id, level, scope_kind, recorded_at) VALUES (?, 1, 'all_targets', ?)`);
  db.prepare("INSERT INTO teaching_artifacts (id, content, content_format, created_at) VALUES ('material', 'A recovered explanation.', 'markdown', ?)").run("2026-01-01T00:00:00.000Z");
  // Synthetic historical rows keep the fixture fast and avoid mutating live profiles.
  db.transaction(() => {
    for (let index = 0; index < count; index++) {
      const timestamp = new Date(Date.UTC(2026, 0, 1, 0, 0, index === 8 ? 9 : index)).toISOString();
      const id = index === 0 ? attemptId : Number(insertAttempt.run(CHALLENGE_ID, sessionId, `Response ${index}`, timestamp, timestamp).lastInsertRowid);
      if (index > 0) {
        insertHint.run(id, timestamp);
        db.prepare("UPDATE attempts SET submitted_at = ? WHERE id = ?").run(index === 10 ? "2026-01-02T00:00:00.000Z" : timestamp, id);
      }
      const event = { ...sample, id: `event-${index}`, attempt_id: id, performed_at: timestamp };
      if (index > 0) insertEvidence.run(...fields.map((key) => event[key as keyof typeof event] as string | number | null));
      insertExposure.run(OBJECTIVE_ID, sessionId, id, timestamp, index === 0 ? null : "material");
    }
  })();
  return { ...fixture, sessionId, firstAttemptId: attemptId, firstEvidenceId: sample.id as string };
}

function trackReads(db: ReturnType<typeof createKernelFixture>["db"]) {
  const reads: Array<{ sql: string; count: number }> = [];
  const prepare = db.prepare.bind(db);
  const spy = vi.spyOn(db, "prepare").mockImplementation((sql) => {
    const statement = prepare(sql);
    const all = statement.all.bind(statement);
    vi.spyOn(statement, "all").mockImplementation((...args) => {
      const rows = all(...args);
      reads.push({ sql, count: rows.length });
      return rows;
    });
    return statement;
  });
  return { reads, restore: () => spy.mockRestore() };
}

describe("bounded revision note history", () => {
  it("loads only selected details while preserving full-history source state and provenance", () => {
    const { db } = historyFixture();
    const tracker = trackReads(db);
    try {
      const context = getRevisionNoteContext(db, { scope: { kind: "objective", objectiveId: OBJECTIVE_ID }, maxInteractions: 4 });
      expect(context.interactions.map((row) => row.attemptId)).toEqual([1000, 999, 998, 997]);
      expect(context.interactions[0]).toMatchObject({ learnerResponse: "Response 999", evidence: [{ id: "event-999" }], hints: [{ level: 1 }], exposures: [{ teachingMaterial: { artifactId: "material", content: "A recovered explanation." } }] });
      expect(context.standaloneExposures.map((row) => row.attemptId)).toEqual([996, 995, 994, 993]);
      expect(context.sourceState).toMatchObject({ maxAttemptId: 1000, maxEvidenceSeq: 1000, maxExposureSeq: 1000, maxHintSeq: 1000 });
      expect(context.sourceRefs.attemptIds).toEqual([1000, 999, 998, 997, 996, 995, 994, 993]);
      expect(context.sourceRefs.evidenceIds).toEqual(["event-999", "event-998", "event-997", "event-996"]);
      expect(context.sourceRefs.teachingArtifactIds).toEqual(["material"]);
      expect(context.limitations).toEqual([
        expect.stringContaining("Some historical exposure events"),
        "Context is bounded to the 4 most recent relevant interactions out of 1000.",
      ]);
      const detailReads = tracker.reads.filter(({ sql }) => /SELECT (?:a|e|x)\.\*|SELECT \* FROM (?:hint_observations|teaching_artifacts)/.test(sql));
      expect(detailReads).toHaveLength(6);
      expect(detailReads.every(({ count }) => count <= 4)).toBe(true);
    } finally { tracker.restore(); db.close(); }
  });

  it("invalidates notes for changes in omitted history and checks repeated scopes without loading details", () => {
    const { db, sessionId, firstEvidenceId } = historyFixture(100);
    try {
      const pendingId = Number(db.prepare("INSERT INTO attempts (challenge_id, challenge_version, session_id, started_at, created_at) VALUES (?, 1, ?, ?, ?)").run(CHALLENGE_ID, sessionId, "2025-01-01T00:00:00.000Z", "2025-01-01T00:00:00.000Z").lastInsertRowid);
      const context = getRevisionNoteContext(db, { scope: { kind: "objective", objectiveId: OBJECTIVE_ID }, maxInteractions: 1 });
      const note = saveRevisionNote(db, { context, markdown: "Recorded explanation." });
      saveRevisionNote(db, { context, markdown: "Second snapshot." });
      expect(getRevisionNote(db, note.id)?.stale).toBe(false);
      db.prepare("INSERT INTO evidence_revisions (evidence_event_id, action, reason, created_at) VALUES (?, 'invalidate', 'Correction', ?)").run(firstEvidenceId, "2026-02-01T00:00:00.000Z");
      expect(getRevisionNote(db, note.id)?.stale).toBe(true);
      const corrected = getRevisionNoteContext(db, { scope: context.scope, maxInteractions: 1 });
      const correctedNote = saveRevisionNote(db, { context: corrected, markdown: "Corrected snapshot." });
      db.prepare("INSERT INTO hint_observations (attempt_id, level, scope_kind, recorded_at) VALUES (?, 2, 'all_targets', ?)").run(pendingId, "2026-02-02T00:00:00.000Z");
      expect(getRevisionNote(db, correctedNote.id)?.stale).toBe(true);
      const tracker = trackReads(db);
      try {
        expect(listRevisionNotes(db)).toHaveLength(3);
        expect(tracker.reads.some(({ sql }) => /SELECT (?:a|e|x)\.\*|SELECT \* FROM (?:hint_observations|teaching_artifacts)/.test(sql))).toBe(false);
        expect(tracker.reads.filter(({ sql }) => sql.includes("SELECT objective_id FROM objective_projections"))).toHaveLength(1);
      } finally { tracker.restore(); }
    } finally { db.close(); }
  });

  it("applies session and episode windows before limiting history, retaining timestamp and tie ordering", () => {
    const { db, sessionId } = historyFixture(30);
    try {
      const other = db.prepare("INSERT INTO sessions (topic_id, mode, started_at) VALUES (?, 'practice', ?)").run(GOAL_ID, "2026-01-02T00:00:00.000Z");
      db.prepare("UPDATE attempts SET session_id = ? WHERE id > 10").run(Number(other.lastInsertRowid));
      const session = getRevisionNoteContext(db, { scope: { kind: "session", sessionId }, maxInteractions: 2 });
      expect(session.interactions.map((row) => row.attemptId)).toEqual([10, 9]);
      expect(session.sourceState.maxAttemptId).toBe(10);
      expect(session.sourceState.maxHintSeq).toBe(10);
      db.prepare(`INSERT INTO study_focus_episodes (id, goal_id, target_objective_ids, resolved_objective_ids, opened_at, closed_at)
        VALUES ('window', ?, ?, ?, ?, ?)`).run(GOAL_ID, JSON.stringify([OBJECTIVE_ID]), JSON.stringify([OBJECTIVE_ID]), "2026-01-01T00:00:05.000Z", "2026-01-01T00:00:10.000Z");
      // An early-started attempt submitted in the window is relevant; a later
      // started attempt submitted outside it must be excluded before LIMIT.
      const episode = getRevisionNoteContext(db, { scope: { kind: "focus_episode", focusEpisodeId: "window" }, maxInteractions: 2 });
      expect(episode.interactions.map((row) => row.attemptId)).toEqual([10, 9]);
      expect(episode.sourceState.maxAttemptId).toBe(10);
      expect(episode.sourceState.maxExposureSeq).toBe(11);
      expect(episode.limitations).toContain("Context is bounded to the 2 most recent relevant interactions out of 6.");
    } finally { db.close(); }
  });
});
