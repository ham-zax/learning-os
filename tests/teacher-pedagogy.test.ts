import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  createConcept,
  createDatabase,
  createTopic,
  setGoalObjective,
  setGoalPreparation,
} from "../src/db/database.js";
import { createLearningObjective, openAttempt, registerChallenge } from "../src/kernel/foundation.js";
import { submitAndAssess } from "../src/kernel/composite.js";
import { getTodayMission } from "../src/plan/today.js";
import { selectNextChallenge } from "../src/selection/selector.js";
import {
  deriveConfidenceFeedbackDirective,
  derivePedagogyDirective,
} from "../src/teacher-pedagogy.js";
import { createTeacherKernel } from "../src/teacher.js";
import type { ChallengeIntent } from "../src/selection/types.js";
import type { DurablePreparationObjective } from "../src/onboarding/apply.js";

function makeIntent(overrides: Partial<ChallengeIntent> = {}): ChallengeIntent {
  return {
    goalId: "goal-be",
    objectiveId: "resource-saturation-and-backpressure:predict",
    conceptId: "resource-saturation-and-backpressure",
    capabilityId: "predict",
    taskForm: "runtime_trace",
    deliveryContext: "practice",
    novelty: "same",
    reasonKind: "new_objective",
    reason: "New predict objective.",
    dueAt: null,
    weakness: null,
    requiresChangedSurface: false,
    avoidRecentChallenges: [],
    ...overrides,
  };
}

function makePrepObj(overrides: Partial<DurablePreparationObjective> = {}): DurablePreparationObjective {
  return {
    objectiveId: "resource-saturation-and-backpressure:predict",
    isActive: true,
    conceptId: "resource-saturation-and-backpressure",
    capabilityId: "predict",
    importance: "core",
    targetReadiness: "independent",
    requireTransfer: true,
    requireDurability: true,
    strategy: "learn",
    initialDiagnosticKind: null,
    diagnosticPending: false,
    readiness: "unknown",
    transferState: "untested",
    durabilityState: "untested",
    ...overrides,
  };
}

describe("Scope 3 & 4 pedagogy, FIRe-Lite compression, and confusion-pair discrimination", () => {
  it("starts learn strategy on unknown objectives at worked_example and steps down after 2 consecutive misses", () => {
    const learnUnknown = derivePedagogyDirective({
      intent: makeIntent({ reasonKind: "new_objective" }),
      objective: makePrepObj({ strategy: "learn", readiness: "unknown" }),
    });
    expect(learnUnknown).toMatchObject({
      stage: "worked_example",
      scaffold: "guided",
    });

    const diagUnknown = derivePedagogyDirective({
      intent: makeIntent({ reasonKind: "new_objective" }),
      objective: makePrepObj({ strategy: "diagnose_first", readiness: "unknown", diagnosticPending: true }),
    });
    expect(diagUnknown).toMatchObject({
      stage: "independent",
      scaffold: "independent",
    });

    const stepDown = derivePedagogyDirective({
      intent: makeIntent({ reasonKind: "weak_capability", novelty: "variant" }),
      objective: makePrepObj({ strategy: "learn", readiness: "exposed" }),
      consecutiveFailures: 2,
    });
    expect(stepDown).toMatchObject({
      stage: "completion",
      scaffold: "guided",
    });
  });

  it("derives non-evidence confidence guidance for uncertain wins and high-confidence misses", () => {
    expect(deriveConfidenceFeedbackDirective("low", "correct")).toBe("confirm_uncertain_success");
    expect(deriveConfidenceFeedbackDirective("high", "incorrect")).toBe("hypercorrection_repair");
    expect(deriveConfidenceFeedbackDirective("high", "correct")).toBe("none");
    expect(deriveConfidenceFeedbackDirective("low", "incorrect")).toBe("none");

    const db = createDatabase(":memory:");
    try {
      const kernel = createTeacherKernel(db);
      createTopic(db, { id: "g1", name: "Goal 1" });
      createConcept(db, { id: "c1", topicId: "g1", title: "Concept 1" });
      createLearningObjective(db, { id: "c1:explain", conceptId: "c1", capabilityId: "explain" });
      setGoalObjective(db, { goalId: "g1", objectiveId: "c1:explain", importance: "core" });
      setGoalPreparation(db, { goalId: "g1", purpose: "interview", confirmedAt: "2026-09-01T00:00:00Z" });
      registerChallenge(db, {
        id: "ch1",
        version: 1,
        publicPrompt: "Explain c1.",
        taskForm: "explanation",
        deliveryContext: "practice",
        targets: [{ objectiveId: "c1:explain", novelty: "same", criterionIds: ["k1"] }],
        rubric: { id: "r1", version: 1, criteria: [{ id: "k1", objectiveId: "c1:explain", required: true, description: "Key point" }] },
        verification: { required: false, basis: "frozen_rubric" },
      });
      const sess = kernel.createSession("g1", "practice");
      const att = kernel.openAttempt("ch1", 1, sess.id).attempt;
      submitAndAssess(db, att.id, {
        closeIfComplete: true,
        response: { responseText: "Not 100% sure, maybe because X." },
        assessment: {
          evaluatorType: "agent",
          assessmentBasis: "frozen_rubric",
          objectiveResults: [{
            objectiveId: "c1:explain",
            result: "correct",
            criteriaMet: ["k1"],
            criteriaUnmet: [],
            rationale: "Correct explanation.",
          }],
        },
      });
      const rec = kernel.getPedagogyRecommendation(
        makeIntent({ goalId: "g1", objectiveId: "c1:explain", conceptId: "c1", capabilityId: "explain", taskForm: "explanation" }),
        { learnerConfidence: "low" },
      );
      expect(rec.confidenceGuidance).toBe("confirm_uncertain_success");
    } finally {
      db.close();
    }
  });

  it("emits discriminationHint only after both confusable concepts reach at least guided readiness", () => {
    const db = createDatabase(":memory:");
    try {
      createTopic(db, { id: "g1", name: "Backend" });
      createConcept(db, { id: "c-rt", topicId: "g1", title: "Runtime Execution" });
      createConcept(db, { id: "c-bp", topicId: "g1", title: "Backpressure" });
      createLearningObjective(db, { id: "c-rt:predict", conceptId: "c-rt", capabilityId: "predict" });
      createLearningObjective(db, { id: "c-bp:predict", conceptId: "c-bp", capabilityId: "predict" });
      setGoalObjective(db, { goalId: "g1", objectiveId: "c-rt:predict", importance: "core", targetReadiness: "independent" });
      setGoalObjective(db, { goalId: "g1", objectiveId: "c-bp:predict", importance: "core", targetReadiness: "independent" });

      registerChallenge(db, {
        id: "ch-rt",
        version: 1,
        publicPrompt: "Trace runtime.",
        taskForm: "runtime_trace",
        deliveryContext: "practice",
        targets: [{ objectiveId: "c-rt:predict", novelty: "same", criterionIds: ["o"] }],
        rubric: { id: "r-rt", version: 1, criteria: [{ id: "o", objectiveId: "c-rt:predict", required: true, description: "ok" }] },
        verification: { required: false, basis: "frozen_rubric" },
      });
      const kernel = createTeacherKernel(db);
      const sess1 = kernel.createSession("g1", "practice");
      const att1 = openAttempt(db, "ch-rt", 1, sess1.id).attempt;
      submitAndAssess(db, att1.id, {
        closeIfComplete: true,
        response: { responseText: "trace" },
        assessment: {
          evaluatorType: "agent",
          assessmentBasis: "frozen_rubric",
          objectiveResults: [{ objectiveId: "c-rt:predict", result: "correct", criteriaMet: ["o"], criteriaUnmet: [], rationale: "ok" }],
        },
      });

      const beforePeerReady = selectNextChallenge(db, {
        goalId: "g1",
        now: "2026-09-10T00:00:00Z",
        deliveryContext: "practice",
        prerequisitePolicy: { capabilityId: "explain", minimumReadiness: "guided" },
        recentChallengeLimit: 5,
        candidates: [{
          objectiveId: "c-rt:predict",
          importance: "core",
          urgency: 1,
          transfer: "none",
          confusableConceptIds: ["c-bp"],
        }],
      });
      expect(beforePeerReady.intent?.discriminationHint).toBeUndefined();

      // Advance c-bp:predict to guided as well
      registerChallenge(db, {
        id: "ch-bp",
        version: 1,
        publicPrompt: "Trace backpressure.",
        taskForm: "runtime_trace",
        deliveryContext: "practice",
        targets: [{ objectiveId: "c-bp:predict", novelty: "same", criterionIds: ["o"] }],
        rubric: { id: "r-bp", version: 1, criteria: [{ id: "o", objectiveId: "c-bp:predict", required: true, description: "ok" }] },
        verification: { required: false, basis: "frozen_rubric" },
      });
      const sess2 = kernel.createSession("g1", "practice");
      const att2 = openAttempt(db, "ch-bp", 1, sess2.id).attempt;
      submitAndAssess(db, att2.id, {
        closeIfComplete: true,
        response: { responseText: "trace bp" },
        assessment: {
          evaluatorType: "agent",
          assessmentBasis: "frozen_rubric",
          objectiveResults: [{ objectiveId: "c-bp:predict", result: "correct", criteriaMet: ["o"], criteriaUnmet: [], rationale: "ok" }],
        },
      });

      const afterPeerReady = selectNextChallenge(db, {
        goalId: "g1",
        now: "2026-09-10T00:00:00Z",
        deliveryContext: "practice",
        prerequisitePolicy: { capabilityId: "explain", minimumReadiness: "guided" },
        recentChallengeLimit: 5,
        candidates: [{
          objectiveId: "c-rt:predict",
          importance: "core",
          urgency: 1,
          transfer: "none",
          confusableConceptIds: ["c-bp"],
        }],
      });
      expect(afterPeerReady.intent?.discriminationHint).toMatchObject({
        contrastConceptId: "c-bp",
        contrastConceptTitle: "Backpressure",
      });
    } finally {
      db.close();
    }
  });

  it("compresses due prerequisite explain review when a dependent objective passes a clean design/debug/implement check", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-01T09:00:00Z"));
    const db = createDatabase(":memory:");
    try {
      const kernel = createTeacherKernel(db);
      createTopic(db, { id: "g1", name: "Systems" });
      createConcept(db, { id: "base", topicId: "g1", title: "Base Concept", prerequisites: [] });
      createConcept(db, { id: "adv", topicId: "g1", title: "Advanced Concept", prerequisites: ["base"] });
      createLearningObjective(db, { id: "base:explain", conceptId: "base", capabilityId: "explain" });
      createLearningObjective(db, { id: "adv:design", conceptId: "adv", capabilityId: "design" });
      setGoalObjective(db, { goalId: "g1", objectiveId: "base:explain", importance: "core", targetReadiness: "independent" });
      setGoalObjective(db, { goalId: "g1", objectiveId: "adv:design", importance: "core", targetReadiness: "guided" });

      registerChallenge(db, {
        id: "ch-base-1",
        version: 1,
        publicPrompt: "Explain base 1.",
        taskForm: "explanation",
        deliveryContext: "practice",
        targets: [{ objectiveId: "base:explain", novelty: "same", criterionIds: ["c"] }],
        rubric: { id: "r-b1", version: 1, criteria: [{ id: "c", objectiveId: "base:explain", required: true, description: "ok" }] },
        verification: { required: false, basis: "frozen_rubric" },
      });
      registerChallenge(db, {
        id: "ch-base-2",
        version: 1,
        publicPrompt: "Explain base 2.",
        taskForm: "explanation",
        deliveryContext: "practice",
        targets: [{ objectiveId: "base:explain", novelty: "variant", criterionIds: ["c"] }],
        rubric: { id: "r-b2", version: 1, criteria: [{ id: "c", objectiveId: "base:explain", required: true, description: "ok" }] },
        verification: { required: false, basis: "frozen_rubric" },
      });
      registerChallenge(db, {
        id: "ch-adv-d",
        version: 1,
        publicPrompt: "Design adv.",
        taskForm: "design",
        deliveryContext: "practice",
        targets: [{ objectiveId: "adv:design", novelty: "same", criterionIds: ["c"] }],
        rubric: { id: "r-ad", version: 1, criteria: [{ id: "c", objectiveId: "adv:design", required: true, description: "ok" }] },
        verification: { required: false, basis: "frozen_rubric" },
      });

      // Two distinct clean passes on base:explain -> independent
      for (const [chId, ts] of [["ch-base-1", "2026-09-01T10:00:00Z"], ["ch-base-2", "2026-09-02T10:00:00Z"]] as const) {
        vi.setSystemTime(new Date(ts));
        const s = kernel.createSession("g1", "practice");
        const a = kernel.openAttempt(chId, 1, s.id).attempt;
        submitAndAssess(db, a.id, {
          closeIfComplete: true,
          response: { responseText: "solid" },
          assessment: {
            evaluatorType: "agent",
            assessmentBasis: "frozen_rubric",
            objectiveResults: [{ objectiveId: "base:explain", result: "correct", criteriaMet: ["c"], criteriaUnmet: [], rationale: "solid" }],
          },
        });
      }

      // Clean design pass on dependent concept 'adv' at 2026-09-10
      vi.setSystemTime(new Date("2026-09-10T10:00:00Z"));
      const sAdv = kernel.createSession("g1", "practice");
      const aAdv = kernel.openAttempt("ch-adv-d", 1, sAdv.id).attempt;
      submitAndAssess(db, aAdv.id, {
        closeIfComplete: true,
        response: { responseText: "sound design" },
        assessment: {
          evaluatorType: "agent",
          assessmentBasis: "frozen_rubric",
          objectiveResults: [{ objectiveId: "adv:design", result: "correct", criteriaMet: ["c"], criteriaUnmet: [], rationale: "sound design" }],
        },
      });

      // Set base:explain due_at in the past (2026-09-08) while adv:design passed cleanly on 2026-09-10
      db.prepare(`UPDATE review_cards SET due_at = ? WHERE objective_id = ?`)
        .run("2026-09-08T00:00:00Z", "base:explain");

      const mission = getTodayMission(db, {
        goalId: "g1",
        now: "2026-09-11T00:00:00Z",
        availableMinutes: 20,
      });
      expect(mission.items.map((item) => item.kind)).not.toContain("retrieval");
    } finally {
      vi.useRealTimers();
      db.close();
    }
  });

  it("surfaces pedagogy and manifest-backed discriminationHint directly on getStudyContinuation recommend", () => {
    const db = createDatabase(":memory:");
    const knowledgeRoot = fileURLToPath(new URL("../knowledge", import.meta.url));
    try {
      const kernel = createTeacherKernel(db, { knowledgeRoot });
      createTopic(db, { id: "backend-systems", name: "Backend Systems" });
      createConcept(db, {
        id: "runtime-request-execution-and-concurrency",
        topicId: "backend-systems",
        title: "Runtime request execution and concurrency",
      });
      createConcept(db, {
        id: "resource-saturation-and-backpressure",
        topicId: "backend-systems",
        title: "Resource saturation and backpressure",
      });
      createLearningObjective(db, {
        id: "runtime-request-execution-and-concurrency:predict",
        conceptId: "runtime-request-execution-and-concurrency",
        capabilityId: "predict",
      });
      createLearningObjective(db, {
        id: "resource-saturation-and-backpressure:predict",
        conceptId: "resource-saturation-and-backpressure",
        capabilityId: "predict",
      });
      setGoalObjective(db, {
        goalId: "backend-systems",
        objectiveId: "runtime-request-execution-and-concurrency:predict",
        importance: "core",
        targetReadiness: "independent",
      });
      setGoalObjective(db, {
        goalId: "backend-systems",
        objectiveId: "resource-saturation-and-backpressure:predict",
        importance: "core",
        targetReadiness: "independent",
      });

      // Advance both confusable concepts (declared in knowledge/backend-systems/manifest.json) to guided
      for (const [id, objId] of [
        ["ch-rt-e2e", "runtime-request-execution-and-concurrency:predict"],
        ["ch-bp-e2e", "resource-saturation-and-backpressure:predict"],
      ] as const) {
        registerChallenge(db, {
          id,
          version: 1,
          publicPrompt: `Trace ${objId}`,
          taskForm: "runtime_trace",
          deliveryContext: "practice",
          targets: [{ objectiveId: objId, novelty: "same", criterionIds: ["o"] }],
          rubric: { id: `r-${id}`, version: 1, criteria: [{ id: "o", objectiveId: objId, required: true, description: "ok" }] },
          verification: { required: false, basis: "frozen_rubric" },
        });
        const s = kernel.createSession("backend-systems", "practice");
        const a = kernel.openAttempt(id, 1, s.id).attempt;
        submitAndAssess(db, a.id, {
          closeIfComplete: true,
          response: { responseText: "trace" },
          assessment: {
            evaluatorType: "agent",
            assessmentBasis: "frozen_rubric",
            objectiveResults: [{ objectiveId: objId, result: "correct", criteriaMet: ["o"], criteriaUnmet: [], rationale: "ok" }],
          },
        });
      }

      const cont = kernel.getStudyContinuation({
        goalId: "backend-systems",
        now: "2026-09-12T00:00:00Z",
        oneEpisode: true,
      });
      expect(cont.kind).toBe("recommend");
      if (cont.kind === "recommend") {
        expect(cont.pedagogy).toMatchObject({
          stage: expect.any(String),
          scaffold: expect.any(String),
          commitBeforeReveal: true,
        });
        expect(cont.item.intent.discriminationHint).toMatchObject({
          contrastConceptId: expect.stringMatching(/^(runtime-request-execution-and-concurrency|resource-saturation-and-backpressure)$/),
        });
      }
    } finally {
      db.close();
    }
  });

  it("unlocks dependent objectives when a prerequisite concept reaches guided on any capability under allowAnyQualifyingCapability", () => {
    const db = createDatabase(":memory:");
    try {
      const kernel = createTeacherKernel(db);
      createTopic(db, { id: "g-prereq", name: "Backend" });
      createConcept(db, { id: "rt", topicId: "g-prereq", title: "Runtime", prerequisites: [] });
      createConcept(db, { id: "bp", topicId: "g-prereq", title: "Backpressure", prerequisites: ["rt"] });
      createLearningObjective(db, { id: "rt:predict", conceptId: "rt", capabilityId: "predict" });
      createLearningObjective(db, { id: "bp:predict", conceptId: "bp", capabilityId: "predict" });
      setGoalObjective(db, { goalId: "g-prereq", objectiveId: "rt:predict", importance: "core", targetReadiness: "independent" });
      setGoalObjective(db, { goalId: "g-prereq", objectiveId: "bp:predict", importance: "core", targetReadiness: "independent" });

      // Before rt:predict has any evidence, bp:predict is blocked even with allowAnyQualifyingCapability
      const blockedBefore = selectNextChallenge(db, {
        goalId: "g-prereq",
        now: "2026-09-10T00:00:00Z",
        deliveryContext: "practice",
        prerequisitePolicy: { capabilityId: "explain", minimumReadiness: "guided", allowAnyQualifyingCapability: true },
        recentChallengeLimit: 5,
        candidates: [{ objectiveId: "bp:predict", importance: "core", urgency: 1, transfer: "none" }],
      });
      expect(blockedBefore.intent).toBeNull();
      expect(blockedBefore.blocked).toHaveLength(1);

      // Advance rt:predict (not rt:explain) to guided
      registerChallenge(db, {
        id: "ch-rt-unlock",
        version: 1,
        publicPrompt: "Trace runtime.",
        taskForm: "runtime_trace",
        deliveryContext: "practice",
        targets: [{ objectiveId: "rt:predict", novelty: "same", criterionIds: ["o"] }],
        rubric: { id: "r-rt-unlock", version: 1, criteria: [{ id: "o", objectiveId: "rt:predict", required: true, description: "ok" }] },
        verification: { required: false, basis: "frozen_rubric" },
      });
      const sess = kernel.createSession("g-prereq", "practice");
      const att = openAttempt(db, "ch-rt-unlock", 1, sess.id).attempt;
      submitAndAssess(db, att.id, {
        closeIfComplete: true,
        response: { responseText: "trace" },
        assessment: {
          evaluatorType: "agent",
          assessmentBasis: "frozen_rubric",
          objectiveResults: [{ objectiveId: "rt:predict", result: "correct", criteriaMet: ["o"], criteriaUnmet: [], rationale: "ok" }],
        },
      });

      // Strict explain-only policy still blocks bp:predict
      const strictBlocked = selectNextChallenge(db, {
        goalId: "g-prereq",
        now: "2026-09-10T00:00:00Z",
        deliveryContext: "practice",
        prerequisitePolicy: { capabilityId: "explain", minimumReadiness: "guided", allowAnyQualifyingCapability: false },
        recentChallengeLimit: 5,
        candidates: [{ objectiveId: "bp:predict", importance: "core", urgency: 1, transfer: "none" }],
      });
      expect(strictBlocked.intent).toBeNull();

      // Any-capability policy (and getTodayMission default) unlocks bp:predict
      const unlocked = selectNextChallenge(db, {
        goalId: "g-prereq",
        now: "2026-09-10T00:00:00Z",
        deliveryContext: "practice",
        prerequisitePolicy: { capabilityId: "explain", minimumReadiness: "guided", allowAnyQualifyingCapability: true },
        recentChallengeLimit: 5,
        candidates: [{ objectiveId: "bp:predict", importance: "core", urgency: 1, transfer: "none" }],
      });
      expect(unlocked.intent?.objectiveId).toBe("bp:predict");
      expect(unlocked.blocked).toEqual([]);

      const mission = getTodayMission(db, {
        goalId: "g-prereq",
        now: "2026-09-10T00:00:00Z",
        availableMinutes: 30,
      });
      expect(mission.blocked).toEqual([]);
      expect(mission.items.some((item) => item.objectiveId === "bp:predict")).toBe(true);
    } finally {
      db.close();
    }
  });
});
