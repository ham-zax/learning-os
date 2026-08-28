import type Database from "better-sqlite3";
import type {
  Novelty,
  Readiness,
  TaskForm,
  WeaknessLifecycle,
} from "../db/types.js";
import type {
  BlockedSelectionCandidate,
  ChallengeIntent,
  ChallengeSelectionInput,
  ChallengeSelectionResult,
  ObjectiveImportance,
  ObjectiveSelectionCandidate,
  RecentChallengeRef,
  SelectedWeaknessContext,
  SelectionCapabilityId,
  SelectionReasonKind,
} from "./types.js";

const DEFAULT_TASK_FORM: Record<SelectionCapabilityId, TaskForm> = {
  explain: "explanation",
  predict: "runtime_trace",
  implement: "implementation",
  debug: "debugging",
  design: "design",
};

const READINESS_RANK: Record<Readiness, number> = {
  unknown: 0,
  exposed: 1,
  guided: 2,
  independent: 3,
};

const IMPORTANCE_RANK: Record<ObjectiveImportance, number> = {
  core: 0,
  important: 1,
  supporting: 2,
};

const ACTIVE_WEAKNESS_RANK: Partial<Record<WeaknessLifecycle, number>> = {
  recurring: 0,
  retest: 0,
  new: 1,
  improving: 2,
};

const CAPABILITIES = new Set<SelectionCapabilityId>([
  "explain",
  "predict",
  "implement",
  "debug",
  "design",
]);

const TASK_FORMS = new Set<TaskForm>([
  "explanation",
  "runtime_trace",
  "implementation",
  "debugging",
  "design",
]);

type ObjectiveState = {
  objectiveId: string;
  conceptId: string;
  conceptTitle: string;
  capabilityId: SelectionCapabilityId;
  prerequisites: string[];
  readiness: Readiness;
  transferState: "untested" | "not_demonstrated" | "demonstrated" | "contradicted";
  blockingMisconceptionCount: number;
  recentFailure: boolean;
  lastEventSeq: number;
  dueAt: string | null;
};

type WeaknessRow = {
  key: string;
  category: string;
  lifecycle: WeaknessLifecycle;
  lastEventSeq: number;
};

type CandidateEvaluation = {
  candidate: ObjectiveSelectionCandidate;
  state: ObjectiveState;
  history: RecentChallengeRef[];
  activeWeakness: WeaknessRow | null;
  retestWeakness: WeaknessRow | null;
  tier: number;
  isDue: boolean;
  transferNeeded: boolean;
};

function normalizeNow(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid selection time: ${value}`);
  }
  return parsed.toISOString();
}

function capabilityId(value: string): SelectionCapabilityId {
  if (!CAPABILITIES.has(value as SelectionCapabilityId)) {
    throw new Error(`Unsupported learning capability for selection: ${value}`);
  }
  return value as SelectionCapabilityId;
}

function parsePrerequisites(value: string): string[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new Error("Concept prerequisites must be a JSON string array");
  }
  return parsed;
}

function loadObjectiveState(
  db: Database.Database,
  objectiveId: string,
): ObjectiveState {
  const row = db
    .prepare(
      `SELECT objective.id AS objective_id,
              objective.concept_id,
              objective.capability_id,
              concept.title AS concept_title,
              concept.prerequisites,
              projection.readiness,
              projection.transfer_state,
              projection.blocking_misconception_count,
              projection.recent_failure,
              projection.last_event_seq,
              card.due_at
       FROM learning_objectives objective
       JOIN concepts concept ON concept.id = objective.concept_id
       JOIN objective_projections projection ON projection.objective_id = objective.id
       LEFT JOIN review_cards card ON card.objective_id = objective.id
       WHERE objective.id = ?`,
    )
    .get(objectiveId) as
    | {
        objective_id: string;
        concept_id: string;
        capability_id: string;
        concept_title: string;
        prerequisites: string;
        readiness: Readiness;
        transfer_state: ObjectiveState["transferState"];
        blocking_misconception_count: number;
        recent_failure: number;
        last_event_seq: number;
        due_at: string | null;
      }
    | undefined;

  if (!row) {
    throw new Error(`Selection objective not found or missing projection: ${objectiveId}`);
  }

  return {
    objectiveId: row.objective_id,
    conceptId: row.concept_id,
    conceptTitle: row.concept_title,
    capabilityId: capabilityId(row.capability_id),
    prerequisites: parsePrerequisites(row.prerequisites),
    readiness: row.readiness,
    transferState: row.transfer_state,
    blockingMisconceptionCount: row.blocking_misconception_count,
    recentFailure: row.recent_failure === 1,
    lastEventSeq: row.last_event_seq,
    dueAt: row.due_at,
  };
}

function loadWeaknesses(
  db: Database.Database,
  objectiveId: string,
): WeaknessRow[] {
  return (
    db
      .prepare(
        `SELECT key, category, lifecycle, last_event_seq
         FROM weakness_projections
         WHERE objective_id = ?
         ORDER BY category, key`,
      )
      .all(objectiveId) as Array<{
      key: string;
      category: string;
      lifecycle: WeaknessLifecycle;
      last_event_seq: number;
    }>
  ).map((row) => ({
    key: row.key,
    category: row.category,
    lifecycle: row.lifecycle,
    lastEventSeq: row.last_event_seq,
  }));
}

function loadRecentChallengeHistory(
  db: Database.Database,
  objectiveId: string,
  limit: number,
): RecentChallengeRef[] {
  if (limit === 0) return [];

  const rows = db
    .prepare(
      `SELECT challenge.challenge_id,
              challenge.version,
              challenge.task_form,
              target.novelty,
              attempt.id AS attempt_id,
              COALESCE(attempt.submitted_at, attempt.started_at) AS performed_at
       FROM attempts attempt
       JOIN challenge_versions challenge
         ON challenge.challenge_id = attempt.challenge_id
        AND challenge.version = attempt.challenge_version
        AND challenge.is_frozen = 1
       JOIN challenge_targets target
         ON target.challenge_id = challenge.challenge_id
        AND target.version = challenge.version
        AND target.objective_id = ?
       ORDER BY COALESCE(attempt.submitted_at, attempt.started_at) DESC,
                attempt.id DESC,
                challenge.challenge_id,
                challenge.version DESC
       LIMIT ?`,
    )
    .all(objectiveId, limit) as Array<{
    challenge_id: string;
    version: number;
    task_form: TaskForm;
    novelty: Novelty;
    attempt_id: number;
    performed_at: string;
  }>;

  return rows.map((row) => ({
    challengeId: row.challenge_id,
    version: row.version,
    attemptId: row.attempt_id,
    taskForm: row.task_form,
    novelty: row.novelty,
    performedAt: row.performed_at,
  }));
}

function prerequisiteBlockers(
  db: Database.Database,
  state: ObjectiveState,
  input: ChallengeSelectionInput,
): string[] {
  const blockers: string[] = [];
  for (const prerequisiteId of state.prerequisites) {
    const row = db
      .prepare(
        `SELECT projection.readiness
         FROM learning_objectives objective
         JOIN objective_projections projection ON projection.objective_id = objective.id
         WHERE objective.concept_id = ?
           AND objective.capability_id = ?`,
      )
      .get(prerequisiteId, input.prerequisitePolicy.capabilityId) as
      | { readiness: Readiness }
      | undefined;

    if (!row) {
      blockers.push(
        `Prerequisite ${prerequisiteId} has no ${input.prerequisitePolicy.capabilityId} objective.`,
      );
      continue;
    }

    if (
      READINESS_RANK[row.readiness] <
      READINESS_RANK[input.prerequisitePolicy.minimumReadiness]
    ) {
      blockers.push(
        `Prerequisite ${prerequisiteId}:${input.prerequisitePolicy.capabilityId} readiness ${row.readiness} is below ${input.prerequisitePolicy.minimumReadiness}.`,
      );
    }
  }
  return blockers;
}

function pickActiveWeakness(weaknesses: WeaknessRow[]): WeaknessRow | null {
  return (
    weaknesses
      .filter((weakness) => ACTIVE_WEAKNESS_RANK[weakness.lifecycle] !== undefined)
      .sort((left, right) => {
        const lifecycle =
          ACTIVE_WEAKNESS_RANK[left.lifecycle]! - ACTIVE_WEAKNESS_RANK[right.lifecycle]!;
        if (lifecycle !== 0) return lifecycle;
        if (left.lastEventSeq !== right.lastEventSeq) {
          return right.lastEventSeq - left.lastEventSeq;
        }
        return left.key.localeCompare(right.key);
      })[0] ?? null
  );
}

function pickRetestWeakness(
  weaknesses: WeaknessRow[],
  candidate: ObjectiveSelectionCandidate,
): WeaknessRow | null {
  const eligible = new Set(candidate.retestEligibleWeaknessKeys ?? []);
  return (
    weaknesses
      .filter(
        (weakness) => weakness.lifecycle === "resolved" && eligible.has(weakness.key),
      )
      .sort((left, right) => {
        if (left.lastEventSeq !== right.lastEventSeq) {
          return right.lastEventSeq - left.lastEventSeq;
        }
        return left.key.localeCompare(right.key);
      })[0] ?? null
  );
}

function selectionTier(evaluation: Omit<CandidateEvaluation, "tier">): number {
  if (
    evaluation.activeWeakness?.lifecycle === "recurring" ||
    evaluation.activeWeakness?.lifecycle === "retest"
  ) {
    return 0;
  }
  if (evaluation.retestWeakness) return 1;
  if (
    evaluation.transferNeeded &&
    evaluation.candidate.transfer === "required"
  ) {
    return 2;
  }
  if (evaluation.isDue) return 3;
  if (evaluation.activeWeakness) return 4;
  if (evaluation.transferNeeded) return 5;
  if (evaluation.state.recentFailure || evaluation.state.readiness !== "independent") {
    return 6;
  }
  return 7;
}

function evaluateCandidate(
  db: Database.Database,
  candidate: ObjectiveSelectionCandidate,
  input: ChallengeSelectionInput,
  now: string,
): CandidateEvaluation {
  const state = loadObjectiveState(db, candidate.objectiveId);
  const weaknesses = loadWeaknesses(db, candidate.objectiveId);
  const history = loadRecentChallengeHistory(
    db,
    candidate.objectiveId,
    input.recentChallengeLimit,
  );
  const activeWeakness = pickActiveWeakness(weaknesses);
  const retestWeakness = pickRetestWeakness(weaknesses, candidate);
  const isDue = state.dueAt !== null && state.dueAt <= now;
  const transferNeeded =
    candidate.transfer !== "none" && state.transferState !== "demonstrated";
  const base = {
    candidate,
    state,
    history,
    activeWeakness,
    retestWeakness,
    isDue,
    transferNeeded,
  };
  return { ...base, tier: selectionTier(base) };
}

function compareEvaluations(
  left: CandidateEvaluation,
  right: CandidateEvaluation,
): number {
  if (left.tier !== right.tier) return left.tier - right.tier;

  const importance =
    IMPORTANCE_RANK[left.candidate.importance] -
    IMPORTANCE_RANK[right.candidate.importance];
  if (importance !== 0) return importance;

  if (left.candidate.urgency !== right.candidate.urgency) {
    return right.candidate.urgency - left.candidate.urgency;
  }

  if (left.isDue && right.isDue) {
    const dueOrder = left.state.dueAt!.localeCompare(right.state.dueAt!);
    if (dueOrder !== 0) return dueOrder;
  }

  if (left.state.recentFailure !== right.state.recentFailure) {
    return left.state.recentFailure ? -1 : 1;
  }

  if (left.state.blockingMisconceptionCount !== right.state.blockingMisconceptionCount) {
    return right.state.blockingMisconceptionCount - left.state.blockingMisconceptionCount;
  }

  const preference = Number(Boolean(right.candidate.preferred)) - Number(Boolean(left.candidate.preferred));
  if (preference !== 0) return preference;

  const readiness =
    READINESS_RANK[left.state.readiness] - READINESS_RANK[right.state.readiness];
  if (readiness !== 0) return readiness;

  if (left.history.length !== right.history.length) {
    return left.history.length - right.history.length;
  }

  return left.state.objectiveId.localeCompare(right.state.objectiveId);
}

function availableTaskForms(
  candidate: ObjectiveSelectionCandidate,
  capability: SelectionCapabilityId,
): TaskForm[] {
  if (!candidate.availableTaskForms || candidate.availableTaskForms.length === 0) {
    return [DEFAULT_TASK_FORM[capability]];
  }

  const forms: TaskForm[] = [];
  for (const form of candidate.availableTaskForms) {
    if (!TASK_FORMS.has(form)) {
      throw new Error(`Unsupported task form for selection: ${String(form)}`);
    }
    if (!forms.includes(form)) forms.push(form);
  }
  return forms;
}

function chooseTaskForm(
  candidate: ObjectiveSelectionCandidate,
  capability: SelectionCapabilityId,
  history: RecentChallengeRef[],
): TaskForm {
  const forms = availableTaskForms(candidate, capability);
  if (forms.length === 1) return forms[0];

  const usageCount = new Map<TaskForm, number>();
  const mostRecentIndex = new Map<TaskForm, number>();
  for (const form of forms) usageCount.set(form, 0);

  history.forEach((entry, index) => {
    if (!usageCount.has(entry.taskForm)) return;
    usageCount.set(entry.taskForm, usageCount.get(entry.taskForm)! + 1);
    if (!mostRecentIndex.has(entry.taskForm)) {
      mostRecentIndex.set(entry.taskForm, index);
    }
  });

  return [...forms].sort((left, right) => {
    const count = usageCount.get(left)! - usageCount.get(right)!;
    if (count !== 0) return count;

    const leftRecent = mostRecentIndex.get(left) ?? Number.POSITIVE_INFINITY;
    const rightRecent = mostRecentIndex.get(right) ?? Number.POSITIVE_INFINITY;
    if (leftRecent !== rightRecent) return rightRecent - leftRecent;

    return forms.indexOf(left) - forms.indexOf(right);
  })[0];
}

function selectedWeakness(evaluation: CandidateEvaluation): SelectedWeaknessContext | null {
  const weakness =
    evaluation.activeWeakness?.lifecycle === "recurring" ||
    evaluation.activeWeakness?.lifecycle === "retest"
      ? evaluation.activeWeakness
      : evaluation.retestWeakness ?? evaluation.activeWeakness;
  if (!weakness) return null;

  return {
    key: weakness.key,
    category: weakness.category,
    lifecycle: weakness.lifecycle,
    isRetest: evaluation.retestWeakness?.key === weakness.key,
  };
}

function reasonFor(
  evaluation: CandidateEvaluation,
): { kind: SelectionReasonKind; text: string } {
  if (
    evaluation.activeWeakness?.lifecycle === "recurring" ||
    evaluation.activeWeakness?.lifecycle === "retest"
  ) {
    return {
      kind: "recurring_weakness",
      text: `Recurring weakness on ${evaluation.state.capabilityId}: ${evaluation.activeWeakness.category}.`,
    };
  }

  if (evaluation.retestWeakness) {
    const transferSuffix =
      evaluation.candidate.transfer === "required" && evaluation.transferNeeded
        ? " Transfer evidence is also required."
        : "";
    return {
      kind: "resolved_weakness_retest",
      text: `Resolved weakness retest: ${evaluation.retestWeakness.category}.${transferSuffix}`,
    };
  }

  if (
    evaluation.transferNeeded &&
    evaluation.candidate.transfer === "required"
  ) {
    return {
      kind: "transfer_needed",
      text: `Transfer evidence required for ${evaluation.state.capabilityId}; current transfer state is ${evaluation.state.transferState}.`,
    };
  }

  if (evaluation.isDue) {
    return {
      kind: "due_retrieval",
      text: `Due retrieval for ${evaluation.state.conceptTitle}:${evaluation.state.capabilityId}.`,
    };
  }

  if (evaluation.activeWeakness) {
    return {
      kind: "weak_capability",
      text: `Weak capability ${evaluation.state.capabilityId}: ${evaluation.activeWeakness.category} is ${evaluation.activeWeakness.lifecycle}.`,
    };
  }

  if (evaluation.transferNeeded) {
    return {
      kind: "transfer_needed",
      text: `Transfer evidence is eligible for ${evaluation.state.capabilityId}; current transfer state is ${evaluation.state.transferState}.`,
    };
  }

  if (evaluation.state.lastEventSeq === 0 && evaluation.state.readiness === "unknown") {
    return {
      kind: "new_objective",
      text: `New ${evaluation.state.capabilityId} objective has no qualifying evidence yet.`,
    };
  }

  if (evaluation.state.recentFailure || evaluation.state.readiness !== "independent") {
    return {
      kind: "weak_capability",
      text: `Weak capability ${evaluation.state.capabilityId}; current readiness is ${evaluation.state.readiness}.`,
    };
  }

  return {
    kind: "reinforcement",
    text: `${evaluation.candidate.importance} ${evaluation.state.capabilityId} objective selected for reinforcement.`,
  };
}

function intentFor(
  evaluation: CandidateEvaluation,
  input: ChallengeSelectionInput,
): ChallengeIntent {
  const taskForm = chooseTaskForm(
    evaluation.candidate,
    evaluation.state.capabilityId,
    evaluation.history,
  );
  const recentTaskForm = evaluation.history[0]?.taskForm;
  const rotatedTaskForm =
    evaluation.history.length > 0 &&
    availableTaskForms(evaluation.candidate, evaluation.state.capabilityId).length > 1 &&
    recentTaskForm !== undefined &&
    taskForm !== recentTaskForm;

  let novelty: Novelty = "same";
  if (evaluation.tier === 1 && evaluation.retestWeakness) {
    novelty =
      evaluation.candidate.transfer === "required" && evaluation.transferNeeded
        ? "transfer"
        : "variant";
  } else if (evaluation.transferNeeded) {
    novelty = "transfer";
  } else if (rotatedTaskForm) {
    novelty = "variant";
  }

  const reason = reasonFor(evaluation);
  return {
    objectiveId: evaluation.state.objectiveId,
    conceptId: evaluation.state.conceptId,
    capabilityId: evaluation.state.capabilityId,
    taskForm,
    deliveryContext: input.deliveryContext,
    novelty,
    reasonKind: reason.kind,
    reason: reason.text,
    dueAt: evaluation.state.dueAt,
    weakness: selectedWeakness(evaluation),
    requiresChangedSurface: novelty !== "same",
    avoidRecentChallenges: evaluation.history,
  };
}

function validateInput(input: ChallengeSelectionInput): void {
  if (!Number.isInteger(input.recentChallengeLimit) || input.recentChallengeLimit < 0) {
    throw new Error("recentChallengeLimit must be a non-negative integer");
  }

  const objectiveIds = new Set<string>();
  for (const candidate of input.candidates) {
    if (objectiveIds.has(candidate.objectiveId)) {
      throw new Error(`Duplicate selection candidate: ${candidate.objectiveId}`);
    }
    objectiveIds.add(candidate.objectiveId);
    if (!Number.isFinite(candidate.urgency)) {
      throw new Error(`Candidate urgency must be finite: ${candidate.objectiveId}`);
    }
  }
}

export function selectNextChallenge(
  db: Database.Database,
  input: ChallengeSelectionInput,
): ChallengeSelectionResult {
  validateInput(input);
  const now = normalizeNow(input.now);
  const eligible: CandidateEvaluation[] = [];
  const blocked: BlockedSelectionCandidate[] = [];

  for (const candidate of input.candidates) {
    const evaluation = evaluateCandidate(db, candidate, input, now);
    const blockers = prerequisiteBlockers(db, evaluation.state, input);
    if (blockers.length > 0) {
      blocked.push({
        objectiveId: evaluation.state.objectiveId,
        conceptId: evaluation.state.conceptId,
        blockers,
      });
      continue;
    }
    eligible.push(evaluation);
  }

  eligible.sort(compareEvaluations);
  blocked.sort((left, right) => left.objectiveId.localeCompare(right.objectiveId));

  return {
    intent: eligible.length > 0 ? intentFor(eligible[0], input) : null,
    blocked,
  };
}
