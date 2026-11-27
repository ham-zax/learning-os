import { isDeepStrictEqual } from "node:util";
import type Database from "better-sqlite3";
import {
  createConcept,
  createTopic,
  getConcept,
  getGoal,
  getGoalObjective,
  getTopic,
  setGoalObjective,
} from "../db/database.js";
import { QuestionBankItemRowSchema } from "../db/types.js";
import type {
  DeliveryContext,
  QuestionBankItemRow,
  TaskForm,
  VerificationBasis,
} from "../db/types.js";
import {
  createLearningObjective,
  getChallenge,
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
    basis: VerificationBasis;
  };
  gradingBasis?: VerificationBasis;
  privateSolutionRef?: string;
}

export interface QuestionBankImportOptions {
  topic: {
    id: string;
    name: string;
    goal?: string;
  };
  items: QuestionBankItem[];
}

export interface QuestionBankImportResult {
  itemsCreated: number;
  itemsExisting: number;
}

export interface ActivateQuestionBankItemInput {
  itemId: string;
  goalId?: string;
}

export interface ActivatedQuestionBankItem {
  itemId: string;
  conceptId: string;
  objectiveId: string;
  challengeId: string;
  conceptCreated: boolean;
  objectiveCreated: boolean;
  challengeCreated: boolean;
  goalAttached: boolean;
}

function objectiveId(conceptId: string, capability: LearningCapability): string {
  return `${conceptId}:${capability}`;
}

function ensureTopic(
  db: Database.Database,
  topic: QuestionBankImportOptions["topic"],
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

function ensureQuestionBankItem(
  db: Database.Database,
  topicId: string,
  item: QuestionBankItem,
): boolean {
  const rawExisting = db
    .prepare(`SELECT * FROM question_bank_items WHERE id = ?`)
    .get(item.id);
  const deliveryContext: DeliveryContext = item.deliveryContext ?? "practice";
  const verificationRequired = item.verification?.required ?? false;
  const verificationBasis: VerificationBasis = item.verification?.basis ?? "frozen_rubric";
  const gradingBasis: VerificationBasis =
    item.gradingBasis ?? (verificationRequired ? verificationBasis : "frozen_rubric");

  const normalizedConceptDifficulty = item.concept.difficulty ?? 1;
  const normalizedConceptPrereqs = item.concept.prerequisites ?? [];
  const normalizedConceptTags = item.concept.tags ?? [];
  const normalizedAcceptableVariants = item.acceptableVariants ?? [];
  const normalizedDifficulty = item.difficulty ?? 1;
  const normalizedTags = item.tags ?? [];
  const normalizedBudget = item.timeBudgetMinutes ?? null;
  const normalizedPrivateRef = item.privateSolutionRef ?? null;

  if (rawExisting !== undefined) {
    const existing = QuestionBankItemRowSchema.parse(rawExisting);
    const matches =
      existing.topic_id === topicId &&
      existing.concept_id === item.concept.id &&
      existing.concept_title === item.concept.title &&
      existing.concept_difficulty === normalizedConceptDifficulty &&
      isDeepStrictEqual(existing.concept_prerequisites, normalizedConceptPrereqs) &&
      isDeepStrictEqual(existing.concept_tags, normalizedConceptTags) &&
      existing.capability_id === item.capability &&
      existing.task_form === item.taskForm &&
      existing.delivery_context === deliveryContext &&
      existing.prompt === item.prompt &&
      existing.criterion === item.criterion &&
      isDeepStrictEqual(existing.acceptable_variants_json, normalizedAcceptableVariants) &&
      existing.difficulty === normalizedDifficulty &&
      isDeepStrictEqual(existing.tags_json, normalizedTags) &&
      existing.time_budget_minutes === normalizedBudget &&
      existing.verification_required === verificationRequired &&
      existing.verification_basis === verificationBasis &&
      existing.grading_basis === gradingBasis &&
      existing.private_solution_ref === normalizedPrivateRef &&
      existing.source === item.source &&
      existing.external_id === item.externalId;
    if (!matches) {
      throw new Error(
        `Question-bank item identity or grading specification conflict for ${item.id}: reimporting a changed specification under the same ID is forbidden`,
      );
    }
    return false;
  }

  db.prepare(
    `INSERT INTO question_bank_items (
       id,
       topic_id,
       concept_id,
       concept_title,
       concept_difficulty,
       concept_prerequisites,
       concept_tags,
       capability_id,
       task_form,
       delivery_context,
       prompt,
       criterion,
       acceptable_variants_json,
       difficulty,
       tags_json,
       time_budget_minutes,
       verification_required,
       verification_basis,
       grading_basis,
       private_solution_ref,
       source,
       external_id,
       created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    item.id,
    topicId,
    item.concept.id,
    item.concept.title,
    item.concept.difficulty ?? 1,
    JSON.stringify(item.concept.prerequisites ?? []),
    JSON.stringify(item.concept.tags ?? []),
    item.capability,
    item.taskForm,
    deliveryContext,
    item.prompt,
    item.criterion,
    JSON.stringify(item.acceptableVariants ?? []),
    item.difficulty ?? 1,
    JSON.stringify(item.tags ?? []),
    item.timeBudgetMinutes ?? null,
    verificationRequired ? 1 : 0,
    verificationBasis,
    gradingBasis,
    item.privateSolutionRef ?? null,
    item.source,
    item.externalId,
    new Date().toISOString(),
  );
  return true;
}

/**
 * Atomically import a searchable question-bank corpus without eagerly creating
 * concepts, objectives, or frozen challenges.
 */
export function materializeQuestionBank(
  db: Database.Database,
  options: QuestionBankImportOptions,
): QuestionBankImportResult {
  let itemsCreated = 0;
  let itemsExisting = 0;

  db.transaction(() => {
    ensureTopic(db, options.topic);
    for (const item of options.items) {
      if (!item.prompt.trim()) throw new Error(`Question prompt is empty: ${item.id}`);
      if (!item.criterion.trim()) throw new Error(`Question criterion is empty: ${item.id}`);
      if (ensureQuestionBankItem(db, options.topic.id, item)) {
        itemsCreated += 1;
      } else {
        itemsExisting += 1;
      }
    }
  })();

  return { itemsCreated, itemsExisting };
}

export function getQuestionBankItem(
  db: Database.Database,
  itemId: string,
): QuestionBankItemRow | undefined {
  const row = db.prepare(`SELECT * FROM question_bank_items WHERE id = ?`).get(itemId);
  return row === undefined ? undefined : QuestionBankItemRowSchema.parse(row);
}

export function listQuestionBankItems(
  db: Database.Database,
  filter: { topicId?: string; conceptId?: string; query?: string; limit?: number } = {},
): QuestionBankItemRow[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.topicId) {
    clauses.push("topic_id = ?");
    params.push(filter.topicId);
  }
  if (filter.conceptId) {
    clauses.push("concept_id = ?");
    params.push(filter.conceptId);
  }
  if (filter.query?.trim()) {
    const pattern = `%${filter.query.trim().toLowerCase()}%`;
    clauses.push("(LOWER(prompt) LIKE ? OR LOWER(concept_title) LIKE ? OR LOWER(id) LIKE ?)");
    params.push(pattern, pattern, pattern);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = filter.limit && filter.limit > 0 ? Math.min(filter.limit, 200) : 50;
  const rows = db
    .prepare(`SELECT * FROM question_bank_items ${where} ORDER BY topic_id, id LIMIT ?`)
    .all(...params, limit);
  return QuestionBankItemRowSchema.array().parse(rows);
}

/**
 * Promote one searchable question-bank item into a durable concept, objective,
 * matching frozen challenge, and optional active goal membership in a single transaction.
 */
export function activateQuestionBankItem(
  db: Database.Database,
  input: ActivateQuestionBankItemInput,
): ActivatedQuestionBankItem {
  const item = getQuestionBankItem(db, input.itemId);
  if (!item) {
    throw new Error(`Question-bank item not found: ${input.itemId}`);
  }
  if (input.goalId && !getGoal(db, input.goalId)) {
    throw new Error(`Goal not found: ${input.goalId}`);
  }

  return db.transaction(() => {
    const conceptCreated = ensureConcept(db, item.topic_id, {
      id: item.concept_id,
      title: item.concept_title,
      difficulty: item.concept_difficulty,
      prerequisites: item.concept_prerequisites,
      tags: item.concept_tags,
      source: item.source,
      sourceId: item.external_id,
    });
    const objective = ensureObjective(
      db,
      item.concept_id,
      item.capability_id as LearningCapability,
    );

    const challengeId = `challenge:${item.id}`;
    const existingChallenge = getChallenge(db, challengeId, 1);
    const criterionId = `${item.id}:criterion`;
    let challengeCreated = false;
    if (existingChallenge) {
      const criterion = existingChallenge.rubric.criteria[0];
      const matchesFullSpec =
        existingChallenge.sourceProblemId === item.id &&
        existingChallenge.publicPrompt === item.prompt &&
        existingChallenge.taskForm === item.task_form &&
        existingChallenge.deliveryContext === item.delivery_context &&
        (existingChallenge.timeBudgetMinutes ?? null) === item.time_budget_minutes &&
        existingChallenge.targets.length === 1 &&
        existingChallenge.targets[0]?.objectiveId === objective.id &&
        existingChallenge.targets[0]?.novelty === "same" &&
        isDeepStrictEqual(existingChallenge.targets[0]?.criterionIds, [criterionId]) &&
        existingChallenge.rubric.criteria.length === 1 &&
        criterion?.id === criterionId &&
        criterion?.objectiveId === objective.id &&
        criterion?.required === true &&
        criterion?.description === item.criterion &&
        isDeepStrictEqual(criterion?.acceptableVariants, item.acceptable_variants_json) &&
        existingChallenge.verification.required === item.verification_required &&
        existingChallenge.verification.basis === item.verification_basis &&
        (existingChallenge.gradingBasis ?? (existingChallenge.verification.required ? existingChallenge.verification.basis : "frozen_rubric")) === item.grading_basis &&
        (existingChallenge.privateSolutionRef ?? null) === item.private_solution_ref;
      if (!matchesFullSpec) {
        throw new Error(
          `Existing frozen challenge ${challengeId}@1 conflicts with question-bank item ${item.id} grading specification`,
        );
      }
    } else {
      registerChallenge(db, {
        id: challengeId,
        version: 1,
        sourceProblemId: item.id,
        publicPrompt: item.prompt,
        taskForm: item.task_form,
        deliveryContext: item.delivery_context,
        timeBudgetMinutes: item.time_budget_minutes,
        targets: [
          {
            objectiveId: objective.id,
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
              objectiveId: objective.id,
              required: true,
              description: item.criterion,
              acceptableVariants: item.acceptable_variants_json,
            },
          ],
        },
        hintLadder: {},
        verification: {
          required: item.verification_required,
          basis: item.verification_basis,
        },
        gradingBasis: item.grading_basis,
        privateSolutionRef: item.private_solution_ref,
      });
      challengeCreated = true;
    }

    let goalAttached = false;
    if (input.goalId) {
      const existingMembership = getGoalObjective(db, input.goalId, objective.id);
      if (!existingMembership || !existingMembership.is_active) {
        setGoalObjective(db, {
          goalId: input.goalId,
          objectiveId: objective.id,
          isActive: true,
          importance: "important",
          targetReadiness: "independent",
        });
        goalAttached = true;
      }
    }

    return {
      itemId: item.id,
      conceptId: item.concept_id,
      objectiveId: objective.id,
      challengeId,
      conceptCreated,
      objectiveCreated: objective.created,
      challengeCreated,
      goalAttached,
    };
  })();
}
