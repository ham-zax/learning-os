import type { Database } from "better-sqlite3";
import type { ChallengeSpec, Novelty, TaskForm } from "../db/types.js";
import { createSession } from "../db/database.js";
import {
  createLearningObjective,
  getChallenge,
  getLearningObjective,
  registerChallenge,
} from "../kernel/foundation.js";

export interface InterviewCriterionInput {
  id: string;
  description: string;
  acceptableVariants?: string[];
}

export interface PreparedInterviewChallenge {
  objectiveId: string;
  challenge: ChallengeSpec;
}

export function createInterviewSessionForConcept(db: Database, conceptId: string): number {
  const concept = db
    .prepare(`SELECT topic_id FROM concepts WHERE id = ?`)
    .get(conceptId) as { topic_id: string } | undefined;
  if (!concept) {
    throw new Error(`Interview concept not found: ${conceptId}`);
  }
  return createSession(db, { topicId: concept.topic_id, mode: "interview" }).id;
}

function sameStrings(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function challengeMatches(
  challenge: ChallengeSpec,
  input: {
    publicPrompt: string;
    taskForm: TaskForm;
    novelty: Novelty;
    objectiveId: string;
    criteria: InterviewCriterionInput[];
    timeBudgetMinutes?: number;
    verificationRequired: boolean;
    verificationBasis: "deterministic_execution" | "frozen_rubric";
  },
): boolean {
  if (
    challenge.publicPrompt !== input.publicPrompt ||
    challenge.taskForm !== input.taskForm ||
    challenge.deliveryContext !== "interview" ||
    challenge.targets.length !== 1 ||
    challenge.targets[0].objectiveId !== input.objectiveId ||
    challenge.targets[0].novelty !== input.novelty ||
    (challenge.timeBudgetMinutes ?? undefined) !== input.timeBudgetMinutes ||
    challenge.verification.required !== input.verificationRequired ||
    challenge.verification.basis !== input.verificationBasis ||
    challenge.rubric.criteria.length !== input.criteria.length
  ) {
    return false;
  }

  const expectedCriterionIds = input.criteria.map((criterion) => criterion.id);
  if (!sameStrings(challenge.targets[0].criterionIds, expectedCriterionIds)) return false;

  return challenge.rubric.criteria.every((criterion, index) => {
    const expected = input.criteria[index];
    return (
      criterion.id === expected.id &&
      criterion.objectiveId === input.objectiveId &&
      criterion.required &&
      criterion.description === expected.description &&
      sameStrings(criterion.acceptableVariants, expected.acceptableVariants ?? [])
    );
  });
}

export function ensureInterviewObjective(
  db: Database,
  conceptId: string,
  capabilityId: "implement" | "design",
): string {
  const canonicalId = `${conceptId}:${capabilityId}`;
  const canonical = getLearningObjective(db, canonicalId);
  if (canonical) {
    if (canonical.concept_id !== conceptId || canonical.capability_id !== capabilityId) {
      throw new Error(`Objective ID collision: ${canonicalId}`);
    }
    return canonical.id;
  }

  const existing = db
    .prepare(
      `SELECT id FROM learning_objectives
       WHERE concept_id = ? AND capability_id = ?`,
    )
    .get(conceptId, capabilityId) as { id: string } | undefined;
  if (existing) return existing.id;

  return createLearningObjective(db, {
    id: canonicalId,
    conceptId,
    capabilityId,
  }).id;
}

export function prepareInterviewChallenge(
  db: Database,
  input: {
    problemId: string;
    conceptId: string;
    capabilityId: "implement" | "design";
    taskForm: "implementation" | "design";
    publicPrompt: string;
    novelty?: Novelty;
    timeBudgetMinutes?: number;
    criteria: InterviewCriterionInput[];
    verificationRequired: boolean;
    verificationBasis: "deterministic_execution" | "frozen_rubric";
  },
): PreparedInterviewChallenge {
  if (input.criteria.length === 0) {
    throw new Error(`Interview problem has no frozen assessment criteria: ${input.problemId}`);
  }

  const objectiveId = ensureInterviewObjective(db, input.conceptId, input.capabilityId);
  const novelty = input.novelty ?? "same";
  const challengeId = `interview:${input.capabilityId}:${input.problemId}`;
  const latest = db
    .prepare(
      `SELECT MAX(version) AS version
       FROM challenge_versions
       WHERE challenge_id = ? AND is_frozen = 1`,
    )
    .get(challengeId) as { version: number | null };

  if (latest.version !== null) {
    const existing = getChallenge(db, challengeId, latest.version);
    if (!existing) {
      throw new Error(`Frozen interview challenge could not be reconstructed: ${challengeId}@${latest.version}`);
    }
    if (
      challengeMatches(existing, {
        publicPrompt: input.publicPrompt,
        taskForm: input.taskForm,
        novelty,
        objectiveId,
        criteria: input.criteria,
        timeBudgetMinutes: input.timeBudgetMinutes,
        verificationRequired: input.verificationRequired,
        verificationBasis: input.verificationBasis,
      })
    ) {
      return { objectiveId, challenge: existing };
    }
  }

  const version = (latest.version ?? 0) + 1;
  const criterionIds = input.criteria.map((criterion) => criterion.id);
  const challenge = registerChallenge(db, {
    id: challengeId,
    version,
    sourceProblemId: input.problemId,
    publicPrompt: input.publicPrompt,
    taskForm: input.taskForm,
    deliveryContext: "interview",
    timeBudgetMinutes: input.timeBudgetMinutes,
    targets: [
      {
        objectiveId,
        novelty,
        criterionIds,
      },
    ],
    rubric: {
      id: `${challengeId}:rubric`,
      version,
      criteria: input.criteria.map((criterion) => ({
        id: criterion.id,
        objectiveId,
        required: true,
        description: criterion.description,
        acceptableVariants: criterion.acceptableVariants ?? [],
      })),
    },
    hintLadder: {},
    verification: {
      required: input.verificationRequired,
      basis: input.verificationBasis,
    },
  });

  return { objectiveId, challenge };
}
