import { afterEach, describe, expect, it, vi } from "vitest";
import { recordAssessment, reviseEvidence, getEffectiveEvidenceEventsByObjective } from "../src/kernel/evidence.js";
import { getChallenge, registerChallenge, openAttempt, submitAttempt } from "../src/kernel/foundation.js";
import { createSession } from "../src/db/database.js";
import { getObjectiveReviewCard, rebuildObjectiveReviewCard } from "../src/scheduler/index.js";
import { createKernelFixture, GOAL_ID, OBJECTIVE_ID } from "./helpers/kernel-fixture.js";

describe("assessment replay equivalence", () => {
  afterEach(() => vi.useRealTimers());

  it("matches full FSRS replay across chronological appends, corrections, and out-of-order assessment", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const fixture = createKernelFixture();
    const { db } = fixture;
    try {
      const checkCard = () => {
        const incremental = getObjectiveReviewCard(db, OBJECTIVE_ID);
        const replayed = rebuildObjectiveReviewCard(db, OBJECTIVE_ID);
        expect(incremental).toEqual(replayed);
      };
      const answer = (attemptId: number, correct: boolean) => recordAssessment(db, attemptId, {
        evaluatorType: "agent", assessmentBasis: "frozen_rubric",
        objectiveResults: [{ objectiveId: OBJECTIVE_ID, result: correct ? "correct" : "incorrect",
          criteriaMet: correct ? ["mechanism"] : [], criteriaUnmet: correct ? [] : ["mechanism"],
          rationale: "Frozen rubric assessment." }],
      });
      let firstId = "";
      for (let day = 1; day <= 30; day++) {
        vi.setSystemTime(new Date(Date.UTC(2026, 0, day)));
        const { attemptId } = fixture.openPracticeAttempt();
        submitAttempt(db, attemptId, { responseText: "A causal state transition." });
        const committed = answer(attemptId, day % 4 !== 0);
        if (day === 1) firstId = committed.evidenceEvents[0].id;
        checkCard();
      }
      reviseEvidence(db, firstId, { action: "invalidate", reason: "Recheck original assessment." });
      checkCard();
      reviseEvidence(db, firstId, { action: "restore", reason: "Original assessment confirmed." });
      checkCard();
      // Assess the earlier submitted attempt only after a later one has been assessed.
      vi.setSystemTime(new Date("2026-02-01T00:00:00Z"));
      const earlier = fixture.openPracticeAttempt();
      submitAttempt(db, earlier.attemptId, { responseText: "Earlier response." });
      vi.setSystemTime(new Date("2026-02-03T00:00:00Z"));
      const later = fixture.openPracticeAttempt();
      submitAttempt(db, later.attemptId, { responseText: "Later response." });
      answer(later.attemptId, true);
      answer(earlier.attemptId, false);
      checkCard();
    } finally { db.close(); }
  });

  it("preserves prefix-based current and historical readiness over varied successes and failures", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { db } = createKernelFixture();
    try {
      const template = getChallenge(db, "challenge", 1)!;
      let historical = "unknown";
      const rank = ["unknown", "exposed", "guided", "independent"];
      for (let day = 1; day <= 40; day++) {
        vi.setSystemTime(new Date(Date.UTC(2026, 0, day)));
        const id = `surface-${day % 3}`;
        if (day <= 3) registerChallenge(db, { ...template, id });
        const session = createSession(db, { topicId: GOAL_ID, mode: "practice" });
        const { attempt } = openAttempt(db, id, 1, session.id);
        submitAttempt(db, attempt.id, { responseText: "A mechanism." });
        const correct = day % 7 !== 0;
        const committed = recordAssessment(db, attempt.id, {
          evaluatorType: "agent", assessmentBasis: "frozen_rubric",
          objectiveResults: [{ objectiveId: OBJECTIVE_ID, result: correct ? "correct" : "incorrect",
            criteriaMet: correct ? ["mechanism"] : [], criteriaUnmet: correct ? [] : ["mechanism"],
            rationale: "Frozen rubric assessment." }],
        });
        const events = getEffectiveEvidenceEventsByObjective(db, OBJECTIVE_ID);
        const gradable = events.filter(event => event.result !== "ungradable");
        const useful = gradable.some(event => (event.result === "correct" || event.result === "partially_correct") &&
          ((event.hint_level >= 1 && event.hint_level <= 4) || (event.hint_level === 0 && event.retrieval_valid)));
        const unaided = gradable.filter(event => event.hint_level === 0 && event.retrieval_valid).slice(-2);
        let readiness = !gradable.length ? "unknown" : !useful ? "exposed" : "guided";
        if (useful && unaided.length === 2 && unaided.every(event => event.result === "correct") &&
            (unaided[0].task_id !== unaided[1].task_id || unaided[0].task_version !== unaided[1].task_version)) {
          readiness = "independent";
        }
        if (rank.indexOf(readiness) > rank.indexOf(historical)) historical = readiness;
        expect(committed.projections[0]).toMatchObject({ readiness, historical_highest_readiness: historical });
      }
    } finally { db.close(); }
  });
});
