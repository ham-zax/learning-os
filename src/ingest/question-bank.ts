import type Database from "better-sqlite3";

import {
  createConcept,
  createProblem,
  createTopic,
  getConcept,
  getTopic,
} from "../db/database.js";
import type { DeliveryContext, TaskForm } from "../db/types.js";
import {
  createLearningObjective,
  getLearningObjective,
  registerChallenge,
} from "../kernel/foundation.js";

export type LearningCapability = "explain" | "predict" | "implement" | "debug" | "design";

export interface QuestionBankConcept {
  id: string;
  title: string;
  difficulty?: number;
  prerequisites?: string[];
  tags?: string[];
  source?: string;
  sourceId?: string;
}

export interface QuestionBankItem {
  id: string;
  prompt: string;
  concept: QuestionBankConcept;
  capability: LearningCapability;
  taskForm: TaskForm;
  source: string;
  externalId: string;
  criterion: string;
  acceptableVariants?: string[];
  difficulty?: number;
  tags?: string[];
  deliveryContext?: DeliveryContext;
  timeBudgetMinutes?: number;
  verification?: {
    required: boolean;
    basis: "human" | "deterministic_execution" | "frozen_rubric" | "mixed";
  };
  privateSolutionRef?: string;
}

export interface QuestionBankMaterializationOptions {
  topic: {
    id: string;
    name: string;
    goal?: string;
  };
  items: QuestionBankItem[];
}

export interface QuestionBankMaterializationResult {
  conceptsCreated: number;
  objectivesCreated: number;
  problemsCreated: number;
  challengesCreated: number;
}

function objectiveId(conceptId: string, capability: LearningCapability): string {
  return `${conceptId}:${capability}`;
}

function ensureTopic(
  db: Database.Database,
  topic: QuestionBankMaterializationOptions["topic"],
): void {
  const existing = getTopic(db, topic.id);
  if (existing) {
    if (existing.name !== topic.name) {
      throw new Error(`Topic identity mismatch for ${topic.id}: ${existing.name}/${topic.name}`);
    }
    return;
  }
  createTopic(db, topic);
}

function ensureConcept(
  db: Database.Database,
  topicId: string,
  concept: QuestionBankConcept,
): boolean {
  const existing = getConcept(db, concept.id);
  if (existing) {
    if (existing.topic_id !== topicId || existing.title !== concept.title) {
      throw new Error(
        `Concept identity mismatch for ${concept.id}: ${existing.topic_id}/${existing.title}`,
      );
    }
    return false;
  }

  createConcept(db, {
    id: concept.id,
    topicId,
    title: concept.title,
    difficulty: concept.difficulty,
    prerequisites: concept.prerequisites,
    tags: concept.tags,
    source: concept.source,
    sourceId: concept.sourceId,
  });
  return true;
}

function ensureObjective(
  db: Database.Database,
  conceptId: string,
  capability: LearningCapability,
): { id: string; created: boolean } {
  const id = objectiveId(conceptId, capability);
  const existing = getLearningObjective(db, id);
  if (existing) {
    if (existing.concept_id !== conceptId || existing.capability_id !== capability) {
      throw new Error(`Learning objective identity mismatch for ${id}`);
    }
    return { id, created: false };
  }

  createLearningObjective(db, { id, conceptId, capabilityId: capability });
  return { id, created: true };
}

function ensureProblem(db: Database.Database, item: QuestionBankItem): boolean {
  const existing = db.prepare(`SELECT id FROM problems WHERE id = ?`).get(item.id) as
    | { id: string }
    | undefined;
  if (existing) return false;

  createProblem(db, {
    id: item.id,
    type: item.taskForm,
    title: item.prompt.split(/\r?\n/, 1)[0]!.slice(0, 160),
    description: item.prompt,
    difficulty: item.difficulty,
    tags: item.tags,
    conceptId: item.concept.id,
    source: item.source,
    externalId: item.externalId,
  });
  return true;
}

function ensureChallenge(
  db: Database.Database,
  item: QuestionBankItem,
  targetObjectiveId: string,
): boolean {
  const challengeId = `challenge:${item.id}`;
  const existing = db
    .prepare(`SELECT 1 FROM challenge_versions WHERE challenge_id = ? AND version = 1`)
    .get(challengeId);
  if (existing) return false;

  const criterionId = `${item.id}:criterion`;
  registerChallenge(db, {
    id: challengeId,
    version: 1,
    sourceProblemId: item.id,
    publicPrompt: item.prompt,
    taskForm: item.taskForm,
    deliveryContext: item.deliveryContext ?? "practice",
    timeBudgetMinutes: item.timeBudgetMinutes,
    targets: [
      {
        objectiveId: targetObjectiveId,
        novelty: "same",
        criterionIds: [criterionId],
      },
    ],
    rubric: {
      id: `${item.id}:rubric`,
      version: 1,
      criteria: [
        {
          id: criterionId,
          objectiveId: targetObjectiveId,
          required: true,
          description: item.criterion,
          acceptableVariants: item.acceptableVariants ?? [],
        },
      ],
    },
    hintLadder: {},
    verification: item.verification ?? { required: false, basis: "human" },
    privateSolutionRef: item.privateSolutionRef,
  });
  return true;
}

export function materializeQuestionBank(
  db: Database.Database,
  options: QuestionBankMaterializationOptions,
): QuestionBankMaterializationResult {
  ensureTopic(db, options.topic);

  let conceptsCreated = 0;
  let objectivesCreated = 0;
  let problemsCreated = 0;
  let challengesCreated = 0;

  db.transaction(() => {
    for (const item of options.items) {
      if (!item.prompt.trim()) throw new Error(`Question prompt is empty: ${item.id}`);
      if (!item.criterion.trim()) throw new Error(`Question criterion is empty: ${item.id}`);

      if (ensureConcept(db, options.topic.id, item.concept)) conceptsCreated += 1;
      const objective = ensureObjective(db, item.concept.id, item.capability);
      if (objective.created) objectivesCreated += 1;
      if (ensureProblem(db, item)) problemsCreated += 1;
      if (ensureChallenge(db, item, objective.id)) challengesCreated += 1;
    }
  })();

  return {
    conceptsCreated,
    objectivesCreated,
    problemsCreated,
    challengesCreated,
  };
}
