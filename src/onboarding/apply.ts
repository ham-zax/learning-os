import { isDeepStrictEqual } from "node:util";
import type Database from "better-sqlite3";
import {
  createConcept,
  createTopic,
  getConcept,
  getGoalObjectives,
  getGoalPreparation,
  getTopic,
  setGoalObjective,
  setGoalPreparation,
} from "../db/database.js";
import type {
  GoalImportance,
  GoalTargetReadiness,
  InitialDiagnosticKind,
  PreparationStrategy as DurablePreparationStrategy,
  Readiness,
} from "../db/types.js";
import {
  createLearningObjective,
  getLearningObjective,
  getObjectiveProjection,
} from "../kernel/foundation.js";
import {
  createProfile,
  deriveProfileId,
  discardCreatedProfile,
  getProfile,
  openProfileDatabase,
  selectProfile,
} from "../profile/index.js";
import type {
  CreateProfileInput,
  LearnerProfile,
  ProfileStoreOptions,
} from "../profile/types.js";
import { allCatalogConcepts } from "./catalog.js";
import { buildOnboardingProposal } from "./planner.js";
import type {
  CatalogConcept,
  DiagnosticKind,
  DiagnosticProposal,
  KnowledgeCatalog,
  ObjectiveProposal,
  OnboardingIntake,
  OnboardingProposal,
  PreparationPurpose,
  PreparationStrategy,
} from "./types.js";
import { normalizeAreaKey, normalizeOnboardingIntake } from "./types.js";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface MissingConceptMaterialization {
  coverageKey: string;
  topicId: string;
  topicName: string;
  conceptId: string;
  title: string;
  prerequisites?: readonly string[];
  /** Required because the current durable concept contract does not represent unknown difficulty. */
  difficulty: number;
  tags?: readonly string[];
}

export interface DeriveMissingConceptMaterializationInput {
  proposal: OnboardingProposal;
  catalog: KnowledgeCatalog;
  coverageKey: string;
  /** Learner-facing topic/group label. Required only when coverage has no topic identity yet. */
  topic?: string;
  /** Learner-facing prerequisite labels or IDs; normalized to concept IDs. */
  prerequisites?: readonly string[];
}

export interface ApplyConfirmedOnboardingInput {
  intake: OnboardingIntake;
  catalog: KnowledgeCatalog;
  planningNow: string;
  proposal: OnboardingProposal;
  confirmed: boolean;
  confirmedAt: string;
  profile: CreateProfileInput;
  missingConcepts?: readonly MissingConceptMaterialization[];
  profileStore?: ProfileStoreOptions;
}

export interface ActivatedOnboardingObjective {
  objectiveId: string;
  conceptId: string;
  capabilityId: string;
  importance: GoalImportance;
  targetReadiness: GoalTargetReadiness;
  requireTransfer: boolean;
  requireDurability: boolean;
  strategy: PreparationStrategy;
  initialDiagnosticKind: DiagnosticKind | null;
}

export interface OnboardingDiagnosticIntent {
  objectiveId: string;
  kind: DiagnosticKind;
  reason: string;
  pending: boolean;
}

export interface PrerequisiteDiagnosticGap {
  objectiveId: string;
  conceptId: string;
  requiredForObjectiveIds: string[];
  readiness: Readiness;
}

export interface AppliedOnboardingResult {
  profile: LearnerProfile;
  goalId: string;
  activatedObjectives: ActivatedOnboardingObjective[];
  diagnostics: OnboardingDiagnosticIntent[];
  prerequisiteDiagnosticGaps: PrerequisiteDiagnosticGap[];
  nextAction: "run_initial_diagnostics" | "build_today_mission";
}

export interface DurablePreparationObjective {
  objectiveId: string;
  conceptId: string;
  capabilityId: string;
  importance: GoalImportance;
  targetReadiness: GoalTargetReadiness;
  requireTransfer: boolean;
  requireDurability: boolean;
  strategy: PreparationStrategy | null;
  initialDiagnosticKind: DiagnosticKind | null;
  diagnosticPending: boolean;
  readiness: Readiness;
  transferState: string;
  durabilityState: string;
}

export interface DurablePreparationContext {
  goalId: string;
  goalName: string;
  target: string | null;
  deadlineAt: string | null;
  purpose: PreparationPurpose;
  targetRole: string | null;
  targetOutcome: string | null;
  availability: {
    minutesPerDay: number | null;
    daysPerWeek: number | null;
    minutesPerWeek: number | null;
  };
  confirmedAt: string;
  objectives: DurablePreparationObjective[];
  prerequisiteDiagnosticGaps: PrerequisiteDiagnosticGap[];
}

type MaterializedConcept = {
  topicId: string;
  topicName: string;
  conceptId: string;
  title: string;
  prerequisites: string[];
  difficulty: number;
  tags: string[];
  source: "knowledge_catalog" | "onboarding_custom";
  sourceId: string;
};

type MaterializationPlan = {
  concepts: MaterializedConcept[];
  conceptByCoverageKey: Map<string, MaterializedConcept>;
};

function requiredText(value: string, label: string): string {
  const result = value.trim();
  if (!result) throw new Error(`${label} must not be empty.`);
  return result;
}

function safeId(value: string, label: string): string {
  const id = requiredText(value, label);
  if (!ID_PATTERN.test(id)) {
    throw new Error(`${label} must use lowercase letters, numbers, and hyphen separators: ${id}`);
  }
  return id;
}

function uniqueStrings(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => requiredText(value, "Concept metadata value")))].sort();
}

function catalogConceptForCoverage(
  catalog: KnowledgeCatalog,
  topicId: string | null,
  conceptId: string | null,
): CatalogConcept {
  if (!topicId || !conceptId) {
    throw new Error("Reusable curriculum coverage is missing its catalog topic/concept identity.");
  }
  const concept = allCatalogConcepts(catalog).find(
    (candidate) => candidate.topicId === topicId && candidate.conceptId === conceptId,
  );
  if (!concept) {
    throw new Error(`Confirmed catalog concept is no longer available: ${topicId}/${conceptId}`);
  }
  return concept;
}

function fromCatalog(concept: CatalogConcept): MaterializedConcept {
  return {
    topicId: concept.topicId,
    topicName: concept.topicName,
    conceptId: concept.conceptId,
    title: concept.title,
    prerequisites: [...concept.prerequisites],
    difficulty: concept.difficulty,
    tags: [...concept.tags],
    source: "knowledge_catalog",
    sourceId: `${concept.topicId}/${concept.conceptId}`,
  };
}

function humanizeId(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function deriveMissingConceptMaterialization(
  input: DeriveMissingConceptMaterializationInput,
): MissingConceptMaterialization {
  const coverage = input.proposal.coverage.find((item) => item.key === input.coverageKey);
  if (!coverage || coverage.disposition !== "include" || coverage.action !== "create_missing") {
    throw new Error(`Included missing curriculum coverage not found: ${input.coverageKey}`);
  }

  const suppliedTopic = input.topic?.trim() ?? "";
  const topicId = coverage.topicId ?? normalizeAreaKey(suppliedTopic);
  if (!topicId) {
    throw new Error(`Topic/group is required for missing concept: ${coverage.label}`);
  }
  const existingTopic = input.catalog.topics.find(
    (topic) =>
      topic.topicId === topicId ||
      (suppliedTopic.length > 0 && normalizeAreaKey(topic.topicName) === normalizeAreaKey(suppliedTopic)),
  );
  const topicName = existingTopic?.topicName ?? (suppliedTopic || humanizeId(topicId));
  const conceptId = coverage.suggestedConceptId ?? normalizeAreaKey(coverage.label);

  return validateMissingMaterialization({
    coverageKey: coverage.key,
    topicId,
    topicName,
    conceptId,
    title: coverage.label,
    difficulty: 3,
    prerequisites: (input.prerequisites ?? []).map((value) => normalizeAreaKey(value)).filter(Boolean),
    tags: [],
  });
}

function validateMissingMaterialization(
  raw: MissingConceptMaterialization,
): MissingConceptMaterialization {
  const coverageKey = requiredText(raw.coverageKey, "Missing concept coverage key");
  const topicId = safeId(raw.topicId, `Missing concept ${coverageKey} topic ID`);
  const topicName = requiredText(raw.topicName, `Missing concept ${coverageKey} topic name`);
  const conceptId = safeId(raw.conceptId, `Missing concept ${coverageKey} concept ID`);
  const title = requiredText(raw.title, `Missing concept ${coverageKey} title`);
  if (!Number.isInteger(raw.difficulty) || raw.difficulty < 1 || raw.difficulty > 5) {
    throw new Error(`Missing concept ${coverageKey} difficulty must be an integer from 1 to 5.`);
  }
  return {
    coverageKey,
    topicId,
    topicName,
    conceptId,
    title,
    prerequisites: uniqueStrings(raw.prerequisites),
    difficulty: raw.difficulty,
    tags: uniqueStrings(raw.tags),
  };
}

function buildMaterializationPlan(
  proposal: OnboardingProposal,
  catalog: KnowledgeCatalog,
  inputs: readonly MissingConceptMaterialization[],
): MaterializationPlan {
  if (proposal.coverage.some((coverage) => coverage.action === "clarify_scope")) {
    throw new Error("Confirmed onboarding still contains clarify_scope curriculum.");
  }
  const included = proposal.coverage.filter((coverage) => coverage.disposition === "include");

  const expectedMissing = new Map(
    included
      .filter((coverage) => coverage.action === "create_missing")
      .map((coverage) => [coverage.key, coverage] as const),
  );
  const missingInputs = new Map<string, MissingConceptMaterialization>();
  for (const raw of inputs) {
    const input = validateMissingMaterialization(raw);
    if (missingInputs.has(input.coverageKey)) {
      throw new Error(`Duplicate missing concept materialization: ${input.coverageKey}`);
    }
    if (!expectedMissing.has(input.coverageKey)) {
      throw new Error(`Unexpected missing concept materialization: ${input.coverageKey}`);
    }
    missingInputs.set(input.coverageKey, input);
  }
  for (const coverageKey of expectedMissing.keys()) {
    if (!missingInputs.has(coverageKey)) {
      throw new Error(`Missing concept materialization is required before confirmation can apply: ${coverageKey}`);
    }
  }

  const catalogConcepts = allCatalogConcepts(catalog);
  const catalogByTopicAndId = new Map(
    catalogConcepts.map((concept) => [`${concept.topicId}/${concept.conceptId}`, concept] as const),
  );
  const catalogById = new Map<string, CatalogConcept[]>();
  for (const concept of catalogConcepts) {
    const values = catalogById.get(concept.conceptId) ?? [];
    values.push(concept);
    catalogById.set(concept.conceptId, values);
  }
  const catalogTopicNames = new Map(catalog.topics.map((topic) => [topic.topicId, topic.topicName] as const));

  const customByConceptId = new Map<string, MissingConceptMaterialization>();
  for (const input of missingInputs.values()) {
    const coverage = expectedMissing.get(input.coverageKey)!;
    if (coverage.suggestedConceptId && input.conceptId !== coverage.suggestedConceptId) {
      throw new Error(
        `Missing concept ${coverage.key} must use confirmed suggested ID ${coverage.suggestedConceptId}, not ${input.conceptId}.`,
      );
    }
    if (coverage.topicId && input.topicId !== coverage.topicId) {
      throw new Error(
        `Missing concept ${coverage.key} must remain in confirmed topic ${coverage.topicId}.`,
      );
    }
    const catalogCollision = catalogById.get(input.conceptId) ?? [];
    if (catalogCollision.some((concept) => concept.topicId !== input.topicId)) {
      throw new Error(
        `Missing concept ID ${input.conceptId} already belongs to a different catalog topic; choose a distinct ID.`,
      );
    }
    const catalogTopicName = catalogTopicNames.get(input.topicId);
    if (catalogTopicName && catalogTopicName !== input.topicName) {
      throw new Error(
        `Missing concept topic name no longer matches catalog topic ${input.topicId}: ${catalogTopicName}`,
      );
    }
    const existingCustom = customByConceptId.get(input.conceptId);
    if (existingCustom && existingCustom.coverageKey !== input.coverageKey) {
      throw new Error(`Multiple missing coverage items use concept ID ${input.conceptId}.`);
    }
    customByConceptId.set(input.conceptId, input);
  }

  const concepts = new Map<string, MaterializedConcept>();
  const addConcept = (concept: MaterializedConcept): void => {
    const existing = concepts.get(concept.conceptId);
    if (existing) {
      if (!isDeepStrictEqual(existing, concept)) {
        throw new Error(`Conflicting materialization metadata for concept ${concept.conceptId}.`);
      }
      return;
    }
    concepts.set(concept.conceptId, concept);
  };

  const addCatalogClosure = (concept: CatalogConcept): void => {
    const alreadyMaterialized = concepts.has(concept.conceptId);
    addConcept(fromCatalog(concept));
    if (alreadyMaterialized) return;
    for (const prerequisiteId of concept.prerequisites) {
      const prerequisite = catalogByTopicAndId.get(`${concept.topicId}/${prerequisiteId}`);
      if (!prerequisite) {
        throw new Error(
          `Catalog prerequisite disappeared for ${concept.topicId}/${concept.conceptId}: ${prerequisiteId}`,
        );
      }
      addCatalogClosure(prerequisite);
    }
  };

  const addCustomClosure = (input: MissingConceptMaterialization): void => {
    const alreadyMaterialized = concepts.has(input.conceptId);
    addConcept({
      topicId: input.topicId,
      topicName: input.topicName,
      conceptId: input.conceptId,
      title: input.title,
      prerequisites: [...(input.prerequisites ?? [])],
      difficulty: input.difficulty,
      tags: [...(input.tags ?? [])],
      source: "onboarding_custom",
      sourceId: input.coverageKey,
    });
    if (alreadyMaterialized) return;
    for (const prerequisiteId of input.prerequisites ?? []) {
      const custom = customByConceptId.get(prerequisiteId);
      if (custom) {
        addCustomClosure(custom);
        continue;
      }
      const catalogMatches = catalogById.get(prerequisiteId) ?? [];
      if (catalogMatches.length !== 1) {
        throw new Error(
          `Missing concept ${input.conceptId} prerequisite ${prerequisiteId} needs explicit unambiguous materialization.`,
        );
      }
      addCatalogClosure(catalogMatches[0]);
    }
  };

  const conceptByCoverageKey = new Map<string, MaterializedConcept>();
  for (const coverage of included) {
    if (coverage.action === "reuse_existing") {
      const catalogConcept = catalogConceptForCoverage(catalog, coverage.topicId, coverage.conceptId);
      addCatalogClosure(catalogConcept);
      conceptByCoverageKey.set(coverage.key, fromCatalog(catalogConcept));
      continue;
    }
    if (coverage.action === "create_missing") {
      const custom = missingInputs.get(coverage.key)!;
      addCustomClosure(custom);
      conceptByCoverageKey.set(coverage.key, concepts.get(custom.conceptId)!);
    }
  }

  return {
    concepts: [...concepts.values()].sort(
      (left, right) => left.topicId.localeCompare(right.topicId) || left.conceptId.localeCompare(right.conceptId),
    ),
    conceptByCoverageKey,
  };
}

function goalIdFor(profileId: string, concepts: readonly MaterializedConcept[]): string {
  const occupied = new Set(concepts.map((concept) => concept.topicId));
  const base = `goal-${profileId}`;
  if (!occupied.has(base)) return base;
  let suffix = 2;
  while (occupied.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function goalTarget(proposal: OnboardingProposal): string {
  const target = proposal.interpretedTarget.outcome ?? proposal.interpretedTarget.role;
  if (!target) throw new Error("Ready onboarding proposal is missing its target outcome/role.");
  return target;
}

function ensureTopic(db: Database.Database, topicId: string, topicName: string): void {
  const existing = getTopic(db, topicId);
  if (!existing) {
    createTopic(db, { id: topicId, name: topicName });
    return;
  }
  if (existing.name !== topicName || existing.goal !== null || existing.deadline !== null) {
    throw new Error(`Existing topic metadata conflicts with onboarding materialization: ${topicId}`);
  }
}

function ensureConcept(db: Database.Database, concept: MaterializedConcept): void {
  const existing = getConcept(db, concept.conceptId);
  if (!existing) {
    createConcept(db, {
      id: concept.conceptId,
      topicId: concept.topicId,
      title: concept.title,
      difficulty: concept.difficulty,
      prerequisites: concept.prerequisites,
      tags: concept.tags,
      source: concept.source,
      sourceId: concept.sourceId,
    });
    return;
  }
  if (
    existing.topic_id !== concept.topicId ||
    existing.title !== concept.title ||
    existing.difficulty !== concept.difficulty ||
    !isDeepStrictEqual(existing.prerequisites, concept.prerequisites) ||
    !isDeepStrictEqual(existing.tags, concept.tags) ||
    existing.source !== concept.source ||
    existing.source_id !== concept.sourceId
  ) {
    throw new Error(`Existing concept metadata conflicts with onboarding materialization: ${concept.conceptId}`);
  }
}

function ensureObjective(
  db: Database.Database,
  conceptId: string,
  capabilityId: string,
): string {
  const objectiveId = `${conceptId}:${capabilityId}`;
  const existing = getLearningObjective(db, objectiveId);
  if (existing) {
    if (existing.concept_id !== conceptId || existing.capability_id !== capabilityId) {
      throw new Error(`Existing objective identity conflicts with onboarding: ${objectiveId}`);
    }
    return objectiveId;
  }
  const samePair = db
    .prepare(
      `SELECT id FROM learning_objectives WHERE concept_id = ? AND capability_id = ?`,
    )
    .get(conceptId, capabilityId) as { id: string } | undefined;
  if (samePair) {
    throw new Error(
      `Existing objective ${samePair.id} conflicts with stable identity convention ${objectiveId}.`,
    );
  }
  createLearningObjective(db, { id: objectiveId, conceptId, capabilityId });
  return objectiveId;
}

function diagnosticByObjectiveKey(proposal: OnboardingProposal): Map<string, DiagnosticProposal> {
  return new Map(proposal.diagnostics.map((diagnostic) => [diagnostic.objectiveKey, diagnostic] as const));
}

function validateReadyConfirmation(input: ApplyConfirmedOnboardingInput): OnboardingProposal {
  if (input.proposal.status === "collecting") {
    throw new Error("Collecting onboarding proposal cannot be applied.");
  }
  if (input.proposal.unresolvedQuestions.some((need) => need.blocking)) {
    throw new Error("Onboarding proposal still has blocking information needs.");
  }
  if (input.confirmed !== true) {
    throw new Error("Learner confirmation is required before onboarding can create a profile.");
  }
  const rebuilt = buildOnboardingProposal({
    intake: input.intake,
    catalog: input.catalog,
    now: input.planningNow,
  });
  if (!isDeepStrictEqual(rebuilt, input.proposal)) {
    throw new Error("Confirmed onboarding proposal is stale relative to the supplied intake/catalog/time inputs.");
  }
  const confirmedAt = new Date(input.confirmedAt);
  if (Number.isNaN(confirmedAt.getTime())) {
    throw new Error(`Invalid onboarding confirmation time: ${input.confirmedAt}`);
  }
  return rebuilt;
}

function durableStrategy(value: PreparationStrategy): DurablePreparationStrategy {
  return value;
}

function durableDiagnostic(value: DiagnosticKind | null): InitialDiagnosticKind | undefined {
  return value ?? undefined;
}

function buildActivatedObjective(
  proposal: ObjectiveProposal,
  concept: MaterializedConcept,
  diagnostic: DiagnosticProposal | undefined,
  objectiveId: string,
): ActivatedOnboardingObjective {
  return {
    objectiveId,
    conceptId: concept.conceptId,
    capabilityId: proposal.capability,
    importance: proposal.importance,
    targetReadiness: proposal.targetReadiness,
    requireTransfer: proposal.requireTransfer,
    requireDurability: proposal.requireDurability,
    strategy: proposal.strategy,
    initialDiagnosticKind: diagnostic?.kind ?? null,
  };
}

function derivePrerequisiteDiagnosticGaps(
  db: Database.Database,
  objectiveIds: readonly string[],
): PrerequisiteDiagnosticGap[] {
  const requiredFor = new Map<string, Set<string>>();
  const visitedDependencies = new Set<string>();

  const visit = (dependentObjectiveId: string, conceptId: string): void => {
    const concept = getConcept(db, conceptId);
    if (!concept) throw new Error(`Prerequisite traversal concept is missing: ${conceptId}`);
    for (const prerequisiteId of concept.prerequisites) {
      const prerequisiteObjectiveId = `${prerequisiteId}:explain`;
      const prerequisiteObjective = getLearningObjective(db, prerequisiteObjectiveId);
      const projection = getObjectiveProjection(db, prerequisiteObjectiveId);
      if (!prerequisiteObjective || !projection) {
        throw new Error(`Prerequisite objective is missing kernel state: ${prerequisiteObjectiveId}`);
      }
      const dependents = requiredFor.get(prerequisiteObjectiveId) ?? new Set<string>();
      dependents.add(dependentObjectiveId);
      requiredFor.set(prerequisiteObjectiveId, dependents);

      const edge = `${dependentObjectiveId}->${prerequisiteObjectiveId}`;
      if (visitedDependencies.has(edge)) continue;
      visitedDependencies.add(edge);
      visit(prerequisiteObjectiveId, prerequisiteObjective.concept_id);
    }
  };

  for (const objectiveId of objectiveIds) {
    const objective = getLearningObjective(db, objectiveId);
    if (!objective) throw new Error(`Learning objective not found: ${objectiveId}`);
    visit(objectiveId, objective.concept_id);
  }

  return [...requiredFor.entries()]
    .map(([objectiveId, dependents]) => {
      const objective = getLearningObjective(db, objectiveId)!;
      const projection = getObjectiveProjection(db, objectiveId)!;
      return {
        objectiveId,
        conceptId: objective.concept_id,
        requiredForObjectiveIds: [...dependents].sort(),
        readiness: projection.readiness,
      } satisfies PrerequisiteDiagnosticGap;
    })
    .filter((gap) => gap.readiness !== "guided" && gap.readiness !== "independent")
    .sort((left, right) => left.objectiveId.localeCompare(right.objectiveId));
}

export function getDurablePreparationContext(
  db: Database.Database,
  goalId: string,
): DurablePreparationContext | null {
  const preparation = getGoalPreparation(db, goalId);
  if (!preparation) return null;
  const goal = getTopic(db, goalId);
  if (!goal) throw new Error(`Goal topic not found for preparation context: ${goalId}`);
  const configs = getGoalObjectives(db, goalId, { includeInactive: true });
  const objectives = configs.map((config) => {
    const objective = getLearningObjective(db, config.objective_id);
    const projection = getObjectiveProjection(db, config.objective_id);
    if (!objective || !projection) {
      throw new Error(`Goal objective is missing kernel state: ${config.objective_id}`);
    }
    return {
      objectiveId: config.objective_id,
      conceptId: objective.concept_id,
      capabilityId: objective.capability_id,
      importance: config.importance,
      targetReadiness: config.target_readiness,
      requireTransfer: config.require_transfer,
      requireDurability: config.require_durability,
      strategy: config.preparation_strategy,
      initialDiagnosticKind: config.initial_diagnostic_kind,
      diagnosticPending:
        config.initial_diagnostic_kind !== null &&
        (config.initial_diagnostic_kind === "transfer_check"
          ? projection.transfer_state === "untested"
          : projection.last_qualifying_evidence_at === null),
      readiness: projection.readiness,
      transferState: projection.transfer_state,
      durabilityState: projection.durability_state,
    } satisfies DurablePreparationObjective;
  });
  const effectiveMinutesPerWeek =
    preparation.minutes_per_week ??
    (preparation.minutes_per_day !== null && preparation.days_per_week !== null
      ? preparation.minutes_per_day * preparation.days_per_week
      : null);
  return {
    goalId,
    goalName: goal.name,
    target: goal.goal,
    deadlineAt: goal.deadline,
    purpose: preparation.purpose,
    targetRole: preparation.target_role,
    targetOutcome: preparation.target_outcome,
    availability: {
      minutesPerDay: preparation.minutes_per_day,
      daysPerWeek: preparation.days_per_week,
      minutesPerWeek: effectiveMinutesPerWeek,
    },
    confirmedAt: preparation.confirmed_at,
    objectives,
    prerequisiteDiagnosticGaps: derivePrerequisiteDiagnosticGaps(
      db,
      configs.filter((config) => config.is_active).map((config) => config.objective_id),
    ),
  };
}

export function listDurablePreparationContexts(
  db: Database.Database,
): DurablePreparationContext[] {
  const rows = db
    .prepare(`SELECT goal_id FROM goal_preparation ORDER BY confirmed_at DESC, goal_id`)
    .all() as Array<{ goal_id: string }>;
  return rows.map((row) => getDurablePreparationContext(db, row.goal_id)!).filter(Boolean);
}

export function applyConfirmedOnboarding(
  input: ApplyConfirmedOnboardingInput,
): AppliedOnboardingResult {
  const proposal = validateReadyConfirmation(input);
  const normalizedIntake = normalizeOnboardingIntake(input.intake);
  if (!proposal.purpose) {
    throw new Error("Ready onboarding proposal is missing preparation purpose.");
  }
  const materialization = buildMaterializationPlan(
    proposal,
    input.catalog,
    input.missingConcepts ?? [],
  );
  const profileId = input.profile.id ?? deriveProfileId(input.profile.displayName);
  if (getProfile(profileId, input.profileStore) !== null) {
    throw new Error(`Confirmed onboarding requires a new learner profile; profile already exists: ${profileId}`);
  }
  const goalId = goalIdFor(profileId, materialization.concepts);
  const goalTargetText = goalTarget(proposal);
  const diagnosticMap = diagnosticByObjectiveKey(proposal);
  const activatedByProposalKey = new Map<string, ActivatedOnboardingObjective>();

  let profile: LearnerProfile | null = null;
  let db: Database.Database | null = null;
  try {
    profile = createProfile(
      { ...input.profile, id: profileId },
      input.profileStore,
    );
    db = openProfileDatabase(profile.id, input.profileStore);

    db.transaction(() => {
      createTopic(db!, {
        id: goalId,
        name: `Preparation: ${goalTargetText}`,
        goal: goalTargetText,
        deadline: proposal.timeBudget.deadlineAt ?? undefined,
      });
      setGoalPreparation(db!, {
        goalId,
        purpose: proposal.purpose!,
        targetRole: proposal.interpretedTarget.role,
        targetOutcome: proposal.interpretedTarget.outcome,
        minutesPerDay: normalizedIntake.availability?.minutesPerDay ?? null,
        daysPerWeek: normalizedIntake.availability?.daysPerWeek ?? null,
        minutesPerWeek: proposal.timeBudget.minutesPerWeek,
        confirmedAt: input.confirmedAt,
      });

      const topicNames = new Map<string, string>();
      for (const concept of materialization.concepts) {
        const existingName = topicNames.get(concept.topicId);
        if (existingName && existingName !== concept.topicName) {
          throw new Error(`Conflicting topic names for ${concept.topicId}.`);
        }
        topicNames.set(concept.topicId, concept.topicName);
      }
      for (const [topicId, topicName] of [...topicNames].sort(([left], [right]) => left.localeCompare(right))) {
        ensureTopic(db!, topicId, topicName);
      }
      for (const concept of materialization.concepts) ensureConcept(db!, concept);

      const conceptById = new Map(
        materialization.concepts.map((concept) => [concept.conceptId, concept] as const),
      );
      for (const concept of materialization.concepts) {
        for (const prerequisiteId of concept.prerequisites) {
          if (!conceptById.has(prerequisiteId)) {
            throw new Error(
              `Materialized prerequisite graph is incomplete: ${concept.conceptId} -> ${prerequisiteId}`,
            );
          }
          ensureObjective(db!, prerequisiteId, "explain");
        }
      }

      for (const objectiveProposal of proposal.objectives) {
        const concept = materialization.conceptByCoverageKey.get(objectiveProposal.conceptKey);
        if (!concept) {
          throw new Error(`Objective proposal has no included materialized concept: ${objectiveProposal.key}`);
        }
        const objectiveId = ensureObjective(db!, concept.conceptId, objectiveProposal.capability);
        const diagnostic = diagnosticMap.get(objectiveProposal.key);
        setGoalObjective(db!, {
          goalId,
          objectiveId,
          importance: objectiveProposal.importance,
          targetReadiness: objectiveProposal.targetReadiness,
          requireTransfer: objectiveProposal.requireTransfer,
          requireDurability: objectiveProposal.requireDurability,
          preparationStrategy: durableStrategy(objectiveProposal.strategy),
          initialDiagnosticKind: durableDiagnostic(diagnostic?.kind ?? null),
        });
        activatedByProposalKey.set(
          objectiveProposal.key,
          buildActivatedObjective(objectiveProposal, concept, diagnostic, objectiveId),
        );

      }
    })();

    const diagnostics = proposal.diagnostics.map((diagnostic) => {
      const activated = activatedByProposalKey.get(diagnostic.objectiveKey);
      if (!activated) {
        throw new Error(`Diagnostic proposal has no activated objective: ${diagnostic.objectiveKey}`);
      }
      return {
        objectiveId: activated.objectiveId,
        kind: diagnostic.kind,
        reason: diagnostic.reason,
        pending: true,
      } satisfies OnboardingDiagnosticIntent;
    });
    const activatedObjectives = [...activatedByProposalKey.values()].sort((left, right) =>
      left.objectiveId.localeCompare(right.objectiveId),
    );
    const prerequisiteDiagnosticGaps = derivePrerequisiteDiagnosticGaps(
      db,
      activatedObjectives.map((objective) => objective.objectiveId),
    );
    db.close();
    db = null;
    const selected = selectProfile(profile.id, input.profileStore);
    return {
      profile: selected,
      goalId,
      activatedObjectives,
      diagnostics,
      prerequisiteDiagnosticGaps,
      nextAction:
        diagnostics.length > 0 || prerequisiteDiagnosticGaps.length > 0
          ? "run_initial_diagnostics"
          : "build_today_mission",
    };
  } catch (error) {
    if (db) {
      db.close();
      db = null;
    }
    if (profile) {
      try {
        discardCreatedProfile(profile, input.profileStore);
      } catch (cleanupError) {
        const original = error instanceof Error ? error.message : String(error);
        const cleanup = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
        throw new Error(`${original} Provisioning cleanup also failed: ${cleanup}`);
      }
    }
    throw error;
  }
}
