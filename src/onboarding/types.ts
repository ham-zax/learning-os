export type ProposalImportance = "core" | "important" | "supporting";
export type ProposalTargetReadiness = "guided" | "independent";

export const ONBOARDING_CAPABILITIES = [
  "explain",
  "predict",
  "implement",
  "debug",
  "design",
] as const;
export type OnboardingCapability = (typeof ONBOARDING_CAPABILITIES)[number];

export type PreparationPurpose = "interview" | "role_readiness" | "long_term_mastery";
export type PreparationStrategy = "learn" | "refresh" | "diagnose_first" | "transfer_practice";
export type ProposalStatus = "collecting" | "ready_for_confirmation";
export type ExperienceDepth = "none" | "exposed" | "working" | "deep";
export type ClaimSource = "resume" | "job_description" | "user_statement" | "study_plan";
export type ClaimKind =
  | "experience"
  | "requirement"
  | "strength"
  | "weakness"
  | "coverage"
  | "exclusion";

export interface IntakeArea {
  label: string;
  topicId?: string;
  conceptId?: string;
  capabilities?: OnboardingCapability[];
}

export interface ExperienceArea extends IntakeArea {
  depth?: ExperienceDepth;
  years?: number;
}

export interface SourceClaim {
  source: ClaimSource;
  kind: ClaimKind;
  area: IntakeArea;
  detail?: string;
  experienceDepth?: ExperienceDepth;
  importance?: ProposalImportance;
}

export interface StudyAvailability {
  minutesPerDay?: number;
  daysPerWeek?: number;
  minutesPerWeek?: number;
}

export interface OnboardingIntake {
  targetRole?: string;
  targetOutcome?: string;
  purpose?: PreparationPurpose;
  /** undefined = not answered; null = explicitly no fixed deadline. */
  deadlineAt?: string | null;
  availability?: StudyAvailability;
  stack?: IntakeArea[];
  mustCover?: IntakeArea[];
  weakAreas?: IntakeArea[];
  strengths?: IntakeArea[];
  existingExperience?: ExperienceArea[];
  currentStudyPlan?: IntakeArea[];
  exclusions?: IntakeArea[];
  depriorities?: IntakeArea[];
  sourceClaims?: SourceClaim[];
}

export interface NormalizedOnboardingIntake {
  targetRole: string | null;
  targetOutcome: string | null;
  purpose: PreparationPurpose | null;
  deadlineAt: string | null | undefined;
  availability: StudyAvailability | null;
  stack: IntakeArea[];
  mustCover: IntakeArea[];
  weakAreas: IntakeArea[];
  strengths: IntakeArea[];
  existingExperience: ExperienceArea[];
  currentStudyPlan: IntakeArea[];
  exclusions: IntakeArea[];
  depriorities: IntakeArea[];
  sourceClaims: SourceClaim[];
}

export interface CatalogConcept {
  topicId: string;
  topicName: string;
  conceptId: string;
  title: string;
  prerequisites: string[];
  difficulty: number;
  tags: string[];
  manifestPath: string;
  materialRefs: string[];
}

export interface CatalogTopic {
  topicId: string;
  topicName: string;
  description: string;
  manifestPath: string;
  concepts: CatalogConcept[];
}

export interface KnowledgeCatalog {
  topics: CatalogTopic[];
}

export type CatalogResolution =
  | { kind: "concept"; concept: CatalogConcept }
  | { kind: "topic"; topic: CatalogTopic }
  | { kind: "ambiguous"; concepts: CatalogConcept[] }
  | { kind: "missing"; suggestedConceptId: string };

export type InformationNeedCode =
  | "target_outcome"
  | "preparation_purpose"
  | "deadline"
  | "time_budget"
  | "target_scope"
  | "concept_scope"
  | "experience_depth"
  | "coverage_conflict";

export interface InformationNeed {
  code: InformationNeedCode;
  subject: string | null;
  blocking: boolean;
  changes: Array<"priority" | "depth" | "schedule" | "strategy" | "coverage">;
  reason: string;
}

export type ProposalHorizon = "no_deadline" | "expired" | "urgent" | "short" | "medium" | "long";

export interface ProposalTimeBudget {
  horizon: ProposalHorizon;
  now: string;
  deadlineAt: string | null;
  daysRemaining: number | null;
  minutesPerWeek: number;
  estimatedAvailableMinutes: number | null;
  estimatedPlannedMinutes: number;
  deferredEstimatedMinutes: number;
  overBudgetMinutes: number;
}

export type CoverageAction = "reuse_existing" | "create_missing" | "clarify_scope";
export type CoverageDisposition = "include" | "defer";

export interface CurriculumCoverageProposal {
  key: string;
  label: string;
  action: CoverageAction;
  disposition: CoverageDisposition;
  topicId: string | null;
  conceptId: string | null;
  suggestedConceptId: string | null;
  materialRefs: string[];
  prerequisites: string[];
  importance: ProposalImportance;
  rationale: string[];
  provenance: string[];
  estimatedMinutes: number;
}

export type CompetenceAssumption =
  | "unknown"
  | "exposure_claimed"
  | "strength_claimed"
  | "weakness_claimed"
  | "no_exposure_claimed";

export interface ObjectiveProposal {
  key: string;
  conceptKey: string;
  capability: OnboardingCapability;
  importance: ProposalImportance;
  targetReadiness: ProposalTargetReadiness;
  requireTransfer: boolean;
  requireDurability: boolean;
  strategy: PreparationStrategy;
  competenceAssumption: CompetenceAssumption;
  rationale: string[];
  estimatedMinutes: number;
}

export type DiagnosticKind =
  | "baseline"
  | "refresh_check"
  | "strength_check"
  | "prerequisite_check"
  | "transfer_check";

export interface DiagnosticProposal {
  objectiveKey: string;
  kind: DiagnosticKind;
  evidenceRequired: true;
  reason: string;
}

export interface ProposalAssumption {
  subject: string;
  basis: string;
  effect: string;
  authoritativeCompetence: false;
}

export interface OnboardingProposal {
  status: ProposalStatus;
  confirmation: {
    required: true;
    state: "unconfirmed";
  };
  interpretedTarget: {
    role: string | null;
    outcome: string | null;
  };
  purpose: PreparationPurpose | null;
  timeBudget: ProposalTimeBudget;
  coverage: CurriculumCoverageProposal[];
  objectives: ObjectiveProposal[];
  diagnostics: DiagnosticProposal[];
  assumptions: ProposalAssumption[];
  unresolvedQuestions: InformationNeed[];
}

function cleanText(value: string | undefined, label = "text"): string | null {
  if (value !== undefined && typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

export function normalizeAreaKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function validateCapabilities(capabilities: readonly OnboardingCapability[] | undefined): OnboardingCapability[] {
  if (!capabilities) return [];
  const allowed = new Set<string>(ONBOARDING_CAPABILITIES);
  const result = [...new Set(capabilities)];
  for (const capability of result) {
    if (!allowed.has(capability)) {
      throw new Error(`Unsupported onboarding capability: ${String(capability)}`);
    }
  }
  return result.sort();
}

function normalizeArea(area: IntakeArea): IntakeArea {
  if (!area || typeof area !== "object" || typeof area.label !== "string") {
    throw new Error("Onboarding area requires a string label");
  }
  const label = area.label.trim();
  if (!label) throw new Error("Onboarding area label must not be empty");
  const topicId = cleanText(area.topicId) ?? undefined;
  const conceptId = cleanText(area.conceptId) ?? undefined;
  const capabilities = validateCapabilities(area.capabilities);
  return {
    label,
    ...(topicId ? { topicId } : {}),
    ...(conceptId ? { conceptId } : {}),
    ...(capabilities.length > 0 ? { capabilities } : {}),
  };
}

function areaSortKey(area: IntakeArea): string {
  return [area.topicId ?? "", area.conceptId ?? "", normalizeAreaKey(area.label)].join("/");
}

function normalizeAreas(areas: readonly IntakeArea[] | undefined): IntakeArea[] {
  const byKey = new Map<string, IntakeArea>();
  for (const raw of areas ?? []) {
    const area = normalizeArea(raw);
    const key = areaSortKey(area);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, area);
      continue;
    }
    const capabilities = validateCapabilities([
      ...(existing.capabilities ?? []),
      ...(area.capabilities ?? []),
    ]);
    byKey.set(key, {
      ...existing,
      ...(capabilities.length > 0 ? { capabilities } : {}),
    });
  }
  return [...byKey.values()].sort((left, right) => areaSortKey(left).localeCompare(areaSortKey(right)));
}

function normalizeExperience(areas: readonly ExperienceArea[] | undefined): ExperienceArea[] {
  const allowedDepths = new Set<ExperienceDepth>(["none", "exposed", "working", "deep"]);
  const byKey = new Map<string, ExperienceArea>();
  for (const raw of areas ?? []) {
    const area = normalizeArea(raw);
    if (raw.depth !== undefined && !allowedDepths.has(raw.depth)) {
      throw new Error(`Unsupported experience depth for ${area.label}: ${String(raw.depth)}`);
    }
    if (raw.years !== undefined && (!Number.isFinite(raw.years) || raw.years < 0)) {
      throw new Error(`Experience years must be non-negative for ${area.label}`);
    }
    const key = areaSortKey(area);
    const existing = byKey.get(key);
    if (existing && existing.depth && raw.depth && existing.depth !== raw.depth) {
      throw new Error(`Conflicting experience depth for ${area.label}`);
    }
    byKey.set(key, {
      ...existing,
      ...area,
      ...(raw.depth ?? existing?.depth ? { depth: raw.depth ?? existing?.depth } : {}),
      ...(raw.years !== undefined || existing?.years !== undefined
        ? { years: Math.max(raw.years ?? 0, existing?.years ?? 0) }
        : {}),
    });
  }
  return [...byKey.values()].sort((left, right) => areaSortKey(left).localeCompare(areaSortKey(right)));
}

function normalizeAvailability(value: StudyAvailability | undefined): StudyAvailability | null {
  if (!value) return null;
  const result: StudyAvailability = {};
  for (const key of ["minutesPerDay", "daysPerWeek", "minutesPerWeek"] as const) {
    const candidate = value[key];
    if (candidate === undefined) continue;
    if (!Number.isFinite(candidate) || candidate <= 0) {
      throw new Error(`${key} must be positive`);
    }
    result[key] = Math.round(candidate);
  }
  if (result.daysPerWeek !== undefined && result.daysPerWeek > 7) {
    throw new Error("daysPerWeek cannot exceed 7");
  }
  return Object.keys(result).length > 0 ? result : null;
}

function normalizeClaims(claims: readonly SourceClaim[] | undefined): SourceClaim[] {
  const sources = new Set<ClaimSource>(["resume", "job_description", "user_statement", "study_plan"]);
  const kinds = new Set<ClaimKind>(["experience", "requirement", "strength", "weakness", "coverage", "exclusion"]);
  const depths = new Set<ExperienceDepth>(["none", "exposed", "working", "deep"]);
  const importance = new Set<ProposalImportance>(["core", "important", "supporting"]);
  return (claims ?? [])
    .map((claim) => {
      if (!sources.has(claim.source)) throw new Error(`Unsupported claim source: ${String(claim.source)}`);
      if (!kinds.has(claim.kind)) throw new Error(`Unsupported claim kind: ${String(claim.kind)}`);
      if (
        claim.source === "job_description" &&
        (claim.kind === "experience" || claim.kind === "strength" || claim.kind === "weakness")
      ) {
        throw new Error("Job-description claims may describe requirements/coverage, not learner competence");
      }
      if (claim.experienceDepth !== undefined && claim.kind !== "experience") {
        throw new Error("experienceDepth is only valid for experience claims");
      }
      if (claim.experienceDepth !== undefined && !depths.has(claim.experienceDepth)) {
        throw new Error(`Unsupported claim experience depth: ${String(claim.experienceDepth)}`);
      }
      if (claim.importance !== undefined && !importance.has(claim.importance)) {
        throw new Error(`Unsupported claim importance: ${String(claim.importance)}`);
      }
      const detail = cleanText(claim.detail, "claim detail");
      return {
        source: claim.source,
        kind: claim.kind,
        area: normalizeArea(claim.area),
        ...(detail ? { detail } : {}),
        ...(claim.experienceDepth ? { experienceDepth: claim.experienceDepth } : {}),
        ...(claim.importance ? { importance: claim.importance } : {}),
      };
    })
    .sort((left, right) => {
      const leftKey = `${left.source}/${left.kind}/${areaSortKey(left.area)}`;
      const rightKey = `${right.source}/${right.kind}/${areaSortKey(right.area)}`;
      return leftKey.localeCompare(rightKey);
    });
}

export function normalizeOnboardingIntake(input: OnboardingIntake): NormalizedOnboardingIntake {
  if (!input || typeof input !== "object") throw new Error("Onboarding intake must be an object");
  const purposes = new Set<PreparationPurpose>(["interview", "role_readiness", "long_term_mastery"]);
  if (input.purpose !== undefined && !purposes.has(input.purpose)) {
    throw new Error(`Unsupported preparation purpose: ${String(input.purpose)}`);
  }
  let deadlineAt: string | null | undefined = input.deadlineAt;
  if (typeof deadlineAt === "string") {
    const parsed = new Date(deadlineAt);
    if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid onboarding deadline: ${deadlineAt}`);
    deadlineAt = parsed.toISOString();
  }

  return {
    targetRole: cleanText(input.targetRole, "targetRole"),
    targetOutcome: cleanText(input.targetOutcome, "targetOutcome"),
    purpose: input.purpose ?? null,
    deadlineAt,
    availability: normalizeAvailability(input.availability),
    stack: normalizeAreas(input.stack),
    mustCover: normalizeAreas(input.mustCover),
    weakAreas: normalizeAreas(input.weakAreas),
    strengths: normalizeAreas(input.strengths),
    existingExperience: normalizeExperience(input.existingExperience),
    currentStudyPlan: normalizeAreas(input.currentStudyPlan),
    exclusions: normalizeAreas(input.exclusions),
    depriorities: normalizeAreas(input.depriorities),
    sourceClaims: normalizeClaims(input.sourceClaims),
  };
}
