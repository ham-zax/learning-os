import { resolveCatalogArea } from "./catalog.js";
import { planInformationNeeds } from "./questions.js";
import type {
  CatalogConcept,
  CatalogResolution,
  CompetenceAssumption,
  CurriculumCoverageProposal,
  DiagnosticKind,
  DiagnosticProposal,
  ExperienceDepth,
  IntakeArea,
  KnowledgeCatalog,
  NormalizedOnboardingIntake,
  ObjectiveProposal,
  OnboardingCapability,
  OnboardingIntake,
  OnboardingProposal,
  PreparationPurpose,
  PreparationStrategy,
  ProposalAssumption,
  ProposalHorizon,
  ProposalImportance,
  ProposalTimeBudget,
} from "./types.js";
import { normalizeAreaKey, normalizeOnboardingIntake } from "./types.js";

type CandidateSignal =
  | "stack"
  | "must_cover"
  | "weakness"
  | "strength"
  | "experience"
  | "study_plan"
  | "requirement"
  | "coverage"
  | "prerequisite";

type Candidate = {
  key: string;
  area: IntakeArea;
  resolution: CatalogResolution;
  importance: ProposalImportance;
  signals: Set<CandidateSignal>;
  capabilities: Set<OnboardingCapability>;
  experienceDepths: Set<ExperienceDepth>;
  excluded: boolean;
  deprioritized: boolean;
  rationale: Set<string>;
  provenance: Set<string>;
};

const IMPORTANCE_RANK: Record<ProposalImportance, number> = {
  core: 3,
  important: 2,
  supporting: 1,
};

const STRATEGY_MINUTES: Record<PreparationStrategy, number> = {
  learn: 90,
  refresh: 35,
  diagnose_first: 20,
  transfer_practice: 35,
};

const CAPABILITY_MULTIPLIER: Record<OnboardingCapability, number> = {
  explain: 0.8,
  predict: 0.8,
  implement: 1.2,
  debug: 1,
  design: 1.2,
};

function maxImportance(left: ProposalImportance, right: ProposalImportance): ProposalImportance {
  return IMPORTANCE_RANK[left] >= IMPORTANCE_RANK[right] ? left : right;
}

function demoteImportance(value: ProposalImportance): ProposalImportance {
  if (value === "core") return "core";
  return value === "important" ? "supporting" : value;
}

function resolutionKey(resolution: CatalogResolution, area: IntakeArea): string {
  if (resolution.kind === "concept") {
    return `concept:${resolution.concept.topicId}/${resolution.concept.conceptId}`;
  }
  if (resolution.kind === "topic") return `topic:${resolution.topic.topicId}`;
  if (resolution.kind === "ambiguous") return `ambiguous:${normalizeAreaKey(area.label)}`;
  return `missing:${resolution.suggestedConceptId}`;
}

function candidateFor(
  target: Map<string, Candidate>,
  catalog: KnowledgeCatalog,
  area: IntakeArea,
  signal: CandidateSignal,
  importance: ProposalImportance,
  provenance: string,
  rationale: string,
  experienceDepth?: ExperienceDepth,
): Candidate {
  const resolution = resolveCatalogArea(catalog, area);
  const key = resolutionKey(resolution, area);
  let candidate = target.get(key);
  if (!candidate) {
    candidate = {
      key,
      area,
      resolution,
      importance,
      signals: new Set(),
      capabilities: new Set(),
      experienceDepths: new Set(),
      excluded: false,
      deprioritized: false,
      rationale: new Set(),
      provenance: new Set(),
    };
    target.set(key, candidate);
  }
  candidate.importance = maxImportance(candidate.importance, importance);
  candidate.signals.add(signal);
  for (const capability of area.capabilities ?? []) candidate.capabilities.add(capability);
  if (experienceDepth) candidate.experienceDepths.add(experienceDepth);
  candidate.provenance.add(provenance);
  candidate.rationale.add(rationale);
  return candidate;
}

function collectCandidates(
  intake: NormalizedOnboardingIntake,
  catalog: KnowledgeCatalog,
): Map<string, Candidate> {
  const candidates = new Map<string, Candidate>();
  for (const area of intake.stack) {
    candidateFor(candidates, catalog, area, "stack", "important", "user:stack", "Target technology stack.");
  }
  for (const area of intake.mustCover) {
    candidateFor(candidates, catalog, area, "must_cover", "core", "user:must-cover", "Explicit must-cover area.");
  }
  for (const area of intake.weakAreas) {
    candidateFor(candidates, catalog, area, "weakness", "important", "user:weakness", "Learner reports weakness here.");
  }
  for (const area of intake.strengths) {
    candidateFor(candidates, catalog, area, "strength", "important", "user:strength", "Learner reports existing strength.");
  }
  for (const area of intake.existingExperience) {
    const candidate = candidateFor(
      candidates,
      catalog,
      area,
      "experience",
      "supporting",
      "user:experience",
      "Learner reports prior experience; this is exposure context, not mastery evidence.",
      area.depth,
    );
    if (area.years !== undefined) candidate.provenance.add(`user:experience-years:${area.years}`);
  }
  for (const area of intake.currentStudyPlan) {
    candidateFor(candidates, catalog, area, "study_plan", "supporting", "study-plan:coverage", "Already present in the learner's study plan.");
  }

  for (const claim of intake.sourceClaims) {
    const importance: ProposalImportance =
      claim.kind === "requirement"
        ? claim.importance ?? "important"
        : claim.kind === "coverage"
          ? claim.importance ?? "important"
          : claim.kind === "weakness" || claim.kind === "strength"
            ? "important"
            : "supporting";
    if (claim.kind === "exclusion") continue;
    const signal: CandidateSignal =
      claim.kind === "requirement"
        ? "requirement"
        : claim.kind === "coverage"
          ? "coverage"
          : claim.kind === "weakness"
            ? "weakness"
            : claim.kind === "strength"
              ? "strength"
              : "experience";
    candidateFor(
      candidates,
      catalog,
      claim.area,
      signal,
      importance,
      `${claim.source}:${claim.kind}`,
      claim.kind === "requirement"
        ? "Required by target material; this changes coverage/importance but says nothing about learner competence."
        : claim.kind === "experience"
          ? "Source reports prior exposure; no readiness, transfer, or durability is inferred."
          : `Structured ${claim.kind} claim from ${claim.source.replace(/_/g, " ")}.`,
      claim.experienceDepth,
    );
  }

  for (const area of intake.exclusions) {
    candidateFor(
      candidates,
      catalog,
      area,
      "coverage",
      "supporting",
      "user:exclusion",
      "Learner explicitly wants to avoid this area.",
    );
  }
  for (const area of intake.depriorities) {
    candidateFor(
      candidates,
      catalog,
      area,
      "coverage",
      "supporting",
      "user:depriority",
      "Learner explicitly wants this area deprioritized.",
    );
  }
  for (const claim of intake.sourceClaims.filter((candidate) => candidate.kind === "exclusion")) {
    candidateFor(
      candidates,
      catalog,
      claim.area,
      "coverage",
      "supporting",
      `${claim.source}:exclusion`,
      "Structured source claim excludes this area from the proposed active curriculum.",
    );
  }

  const excludedKeys = new Set(
    [
      ...intake.exclusions,
      ...intake.sourceClaims.filter((claim) => claim.kind === "exclusion").map((claim) => claim.area),
    ].map((area) => resolutionKey(resolveCatalogArea(catalog, area), area)),
  );
  const deprioritizedKeys = new Set(
    intake.depriorities.map((area) => resolutionKey(resolveCatalogArea(catalog, area), area)),
  );
  for (const candidate of candidates.values()) {
    candidate.excluded = excludedKeys.has(candidate.key);
    candidate.deprioritized = deprioritizedKeys.has(candidate.key);
    if (candidate.deprioritized) {
      candidate.importance = demoteImportance(candidate.importance);
      candidate.rationale.add("Learner explicitly deprioritized this area.");
    }
    if (candidate.excluded) candidate.rationale.add("Learner explicitly excluded this area.");
  }
  return candidates;
}

function normalizeNow(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid onboarding current time: ${value}`);
  return parsed.toISOString();
}

function weeklyMinutes(intake: NormalizedOnboardingIntake): number {
  if (!intake.availability) return 0;
  if (intake.availability.minutesPerWeek !== undefined) {
    return intake.availability.minutesPerWeek;
  }
  if (intake.availability.minutesPerDay !== undefined) {
    return intake.availability.minutesPerDay * (intake.availability.daysPerWeek ?? 7);
  }
  return 0;
}

function horizonFor(now: string, deadlineAt: string | null | undefined): {
  horizon: ProposalHorizon;
  deadlineAt: string | null;
  daysRemaining: number | null;
} {
  if (deadlineAt === undefined || deadlineAt === null) {
    return { horizon: "no_deadline", deadlineAt: deadlineAt ?? null, daysRemaining: null };
  }
  const remaining = (new Date(deadlineAt).getTime() - new Date(now).getTime()) / 86_400_000;
  if (remaining <= 0) return { horizon: "expired", deadlineAt, daysRemaining: remaining };
  if (remaining <= 2) return { horizon: "urgent", deadlineAt, daysRemaining: remaining };
  if (remaining <= 7) return { horizon: "short", deadlineAt, daysRemaining: remaining };
  if (remaining <= 42) return { horizon: "medium", deadlineAt, daysRemaining: remaining };
  return { horizon: "long", deadlineAt, daysRemaining: remaining };
}

function strategyFor(
  candidate: Candidate,
  purpose: PreparationPurpose | null,
  horizon: ProposalHorizon,
): PreparationStrategy {
  if (candidate.signals.has("weakness") || candidate.experienceDepths.has("none")) return "learn";
  if (candidate.signals.has("strength")) {
    return purpose === "interview" && (horizon === "urgent" || horizon === "short") && candidate.importance !== "supporting"
      ? "transfer_practice"
      : "refresh";
  }
  if (candidate.signals.has("experience")) return "diagnose_first";
  if (candidate.signals.has("requirement") && !candidate.signals.has("study_plan")) return "diagnose_first";
  return "learn";
}

function competenceAssumption(candidate: Candidate): CompetenceAssumption {
  if (candidate.signals.has("weakness")) return "weakness_claimed";
  if (candidate.experienceDepths.has("none")) return "no_exposure_claimed";
  if (candidate.signals.has("strength")) return "strength_claimed";
  if (candidate.signals.has("experience")) return "exposure_claimed";
  return "unknown";
}

function defaultCapabilities(
  candidate: Candidate,
  strategy: PreparationStrategy,
  purpose: PreparationPurpose | null,
): OnboardingCapability[] {
  if (candidate.capabilities.size > 0) return [...candidate.capabilities].sort();
  if (candidate.signals.has("prerequisite")) return ["explain"];
  if (candidate.resolution.kind === "concept") {
    if (candidate.resolution.concept.topicId === "coding-interview") return ["implement"];
    if (candidate.resolution.concept.topicId === "system-design") return ["design"];
  }
  const label = normalizeAreaKey(candidate.area.label);
  if (label.includes("debug") || label.includes("failure")) return ["debug"];
  if (label.includes("design") || label.includes("architecture")) return ["design"];
  if (purpose === "interview" && strategy !== "learn") return ["predict"];
  return ["explain"];
}

function estimatedObjectiveMinutes(strategy: PreparationStrategy, capability: OnboardingCapability): number {
  const raw = STRATEGY_MINUTES[strategy] * CAPABILITY_MULTIPLIER[capability];
  return Math.max(10, Math.round(raw / 5) * 5);
}

function shouldPrepareDurability(
  purpose: PreparationPurpose | null,
  horizon: ProposalHorizon,
  importance: ProposalImportance,
): boolean {
  if (importance === "supporting") return false;
  if (purpose === "long_term_mastery") return true;
  return purpose === "interview" && (horizon === "medium" || horizon === "long");
}

function objectiveProposals(
  candidate: Candidate,
  purpose: PreparationPurpose | null,
  horizon: ProposalHorizon,
): ObjectiveProposal[] {
  const strategy = strategyFor(candidate, purpose, horizon);
  const assumption = competenceAssumption(candidate);
  return defaultCapabilities(candidate, strategy, purpose).map((capability) => ({
    key: `${candidate.key}:${capability}`,
    conceptKey: candidate.key,
    capability,
    importance: candidate.importance,
    targetReadiness: candidate.importance === "supporting" ? "guided" : "independent",
    requireTransfer: purpose === "interview" && candidate.importance !== "supporting",
    requireDurability: shouldPrepareDurability(purpose, horizon, candidate.importance),
    strategy,
    competenceAssumption: assumption,
    rationale: [
      ...candidate.rationale,
      strategy === "learn"
        ? "Foundation/acquisition work is appropriate before stronger application claims."
        : strategy === "refresh"
          ? "Use compact retrieval/reinforcement rather than reteaching from first principles."
          : strategy === "transfer_practice"
            ? "Short interview horizon plus claimed strength favors changed-surface transfer practice."
            : "Prior exposure or requirement uncertainty should be resolved with evidence before choosing learn versus refresh depth.",
    ].sort(),
    estimatedMinutes: estimatedObjectiveMinutes(strategy, capability),
  }));
}

function addLongHorizonPrerequisites(
  candidates: Map<string, Candidate>,
  catalog: KnowledgeCatalog,
  purpose: PreparationPurpose | null,
  horizon: ProposalHorizon,
): void {
  const allow =
    purpose === "long_term_mastery" || horizon === "medium" || horizon === "long" || horizon === "no_deadline";
  if (!allow) return;

  const existing = [...candidates.values()];
  for (const candidate of existing) {
    if (candidate.excluded || strategyFor(candidate, purpose, horizon) !== "learn") continue;
    if (candidate.resolution.kind !== "concept") continue;
    for (const prerequisiteId of candidate.resolution.concept.prerequisites) {
      const prerequisiteArea: IntakeArea = {
        label: prerequisiteId,
        topicId: candidate.resolution.concept.topicId,
        conceptId: prerequisiteId,
      };
      const prerequisite = candidateFor(
        candidates,
        catalog,
        prerequisiteArea,
        "prerequisite",
        candidate.importance === "core" ? "important" : "supporting",
        `catalog:prerequisite-of:${candidate.resolution.concept.conceptId}`,
        `Prerequisite for ${candidate.resolution.concept.title}; longer horizon allows foundation repair before transfer.`,
      );
      prerequisite.importance = maxImportance(
        prerequisite.importance,
        candidate.importance === "core" ? "important" : "supporting",
      );
    }
  }
}

function coverageFor(candidate: Candidate, objectives: ObjectiveProposal[]): CurriculumCoverageProposal {
  const resolution = candidate.resolution;
  let action: CurriculumCoverageProposal["action"];
  let topicId: string | null = null;
  let conceptId: string | null = null;
  let suggestedConceptId: string | null = null;
  let materialRefs: string[] = [];
  let prerequisites: string[] = [];

  if (resolution.kind === "concept") {
    action = "reuse_existing";
    topicId = resolution.concept.topicId;
    conceptId = resolution.concept.conceptId;
    materialRefs = [...resolution.concept.materialRefs];
    prerequisites = [...resolution.concept.prerequisites];
  } else if (resolution.kind === "missing") {
    action = "create_missing";
    topicId = candidate.area.topicId ?? null;
    suggestedConceptId = resolution.suggestedConceptId;
  } else {
    action = "clarify_scope";
    topicId = resolution.kind === "topic" ? resolution.topic.topicId : null;
  }

  return {
    key: candidate.key,
    label: candidate.area.label,
    action,
    disposition: candidate.excluded || action === "clarify_scope" ? "defer" : "include",
    topicId,
    conceptId,
    suggestedConceptId,
    materialRefs,
    prerequisites,
    importance: candidate.importance,
    rationale: [...candidate.rationale].sort(),
    provenance: [...candidate.provenance].sort(),
    estimatedMinutes: objectives.reduce((sum, objective) => sum + objective.estimatedMinutes, 0),
  };
}

function applyTimeBudget(
  coverage: CurriculumCoverageProposal[],
  availableMinutes: number | null,
  horizon: ProposalHorizon,
): CurriculumCoverageProposal[] {
  const result = coverage.map((item) => ({ ...item }));
  if (horizon === "urgent" || horizon === "expired") {
    for (const item of result) {
      if (item.importance === "supporting" && item.disposition === "include") {
        item.disposition = "defer";
        item.rationale = [...item.rationale, "Tight horizon cuts supporting material before core/important work."].sort();
      }
    }
  }
  if (availableMinutes === null) return result;

  let remaining = Math.max(0, availableMinutes);
  const ordered = [...result].sort(
    (left, right) =>
      IMPORTANCE_RANK[right.importance] - IMPORTANCE_RANK[left.importance] || left.key.localeCompare(right.key),
  );
  for (const item of ordered) {
    if (item.disposition === "defer") continue;
    if (item.importance === "core") {
      remaining -= item.estimatedMinutes;
      continue;
    }
    if (item.estimatedMinutes <= Math.max(0, remaining)) {
      remaining -= item.estimatedMinutes;
      continue;
    }
    item.disposition = "defer";
    item.rationale = [
      ...item.rationale,
      `${item.importance === "supporting" ? "Supporting" : "Important"} work is deferred because higher-priority scope consumes the available horizon.`,
    ].sort();
  }
  return result;
}

function diagnosticKind(objective: ObjectiveProposal): DiagnosticKind {
  if (objective.strategy === "transfer_practice") return "transfer_check";
  if (objective.strategy === "refresh") return "refresh_check";
  if (objective.strategy === "diagnose_first") {
    return objective.competenceAssumption === "exposure_claimed" ? "strength_check" : "baseline";
  }
  return objective.competenceAssumption === "weakness_claimed" ? "prerequisite_check" : "baseline";
}

function diagnosticsFor(objectives: ObjectiveProposal[]): DiagnosticProposal[] {
  return objectives
    .filter(
      (objective) =>
        objective.importance !== "supporting" ||
        objective.strategy === "diagnose_first" ||
        objective.strategy === "refresh" ||
        objective.strategy === "transfer_practice",
    )
    .map((objective) => ({
      objectiveKey: objective.key,
      kind: diagnosticKind(objective),
      evidenceRequired: true as const,
      reason:
        objective.strategy === "learn"
          ? "Confirm the prerequisite/foundation gap before spending acquisition time."
          : "Self-report, resume, and requirement claims are planning signals only; use an evidence-producing diagnostic before strong starting assumptions.",
    }))
    .sort((left, right) => left.objectiveKey.localeCompare(right.objectiveKey));
}

function assumptionsFor(intake: NormalizedOnboardingIntake): ProposalAssumption[] {
  const assumptions: ProposalAssumption[] = [];
  for (const claim of intake.sourceClaims) {
    if (claim.source === "resume" && claim.kind === "experience") {
      assumptions.push({
        subject: claim.area.label,
        basis: claim.detail ?? "Resume reports prior experience.",
        effect: "Treat as prior exposure and reduce unnecessary definition-level diagnosis; do not grant readiness, transfer, or durability.",
        authoritativeCompetence: false,
      });
    } else if (claim.source === "job_description" && claim.kind === "requirement") {
      assumptions.push({
        subject: claim.area.label,
        basis: claim.detail ?? "Job description requires this area.",
        effect: `Use it to set ${claim.importance ?? "important"} coverage priority only; learner competence remains unknown.`,
        authoritativeCompetence: false,
      });
    }
  }
  for (const area of intake.strengths) {
    assumptions.push({
      subject: area.label,
      basis: "Learner self-reports strength.",
      effect: "Prefer refresh/transfer-oriented diagnosis before reteaching; no mastery state is granted.",
      authoritativeCompetence: false,
    });
  }
  for (const area of intake.weakAreas) {
    assumptions.push({
      subject: area.label,
      basis: "Learner self-reports weakness.",
      effect: "Prefer acquisition/prerequisite repair until evidence supports a lighter path.",
      authoritativeCompetence: false,
    });
  }
  return assumptions.sort(
    (left, right) => left.subject.localeCompare(right.subject) || left.basis.localeCompare(right.basis),
  );
}

export interface BuildOnboardingProposalInput {
  intake: OnboardingIntake;
  catalog: KnowledgeCatalog;
  /** Explicit clock input. The planner never reads the wall clock. */
  now: string;
}

export function buildOnboardingProposal(input: BuildOnboardingProposalInput): OnboardingProposal {
  const intake = normalizeOnboardingIntake(input.intake);
  const now = normalizeNow(input.now);
  const unresolvedQuestions = planInformationNeeds(intake, input.catalog);
  const time = horizonFor(now, intake.deadlineAt);
  const candidates = collectCandidates(intake, input.catalog);
  addLongHorizonPrerequisites(candidates, input.catalog, intake.purpose, time.horizon);

  const allObjectiveMap = new Map<string, ObjectiveProposal[]>();
  const initialCoverage = [...candidates.values()]
    .sort(
      (left, right) =>
        IMPORTANCE_RANK[right.importance] - IMPORTANCE_RANK[left.importance] || left.key.localeCompare(right.key),
    )
    .map((candidate) => {
      const objectives =
        candidate.resolution.kind === "topic" || candidate.resolution.kind === "ambiguous"
          ? []
          : objectiveProposals(candidate, intake.purpose, time.horizon);
      allObjectiveMap.set(candidate.key, objectives);
      return coverageFor(candidate, objectives);
    });

  const perWeek = weeklyMinutes(intake);
  const estimatedAvailableMinutes =
    time.daysRemaining === null || perWeek <= 0
      ? null
      : Math.max(0, Math.floor((time.daysRemaining / 7) * perWeek));
  const coverage = applyTimeBudget(initialCoverage, estimatedAvailableMinutes, time.horizon)
    .sort(
      (left, right) =>
        IMPORTANCE_RANK[right.importance] - IMPORTANCE_RANK[left.importance] || left.key.localeCompare(right.key),
    );
  const includedKeys = new Set(
    coverage.filter((item) => item.disposition === "include").map((item) => item.key),
  );
  const objectives = [...allObjectiveMap.entries()]
    .filter(([conceptKey]) => includedKeys.has(conceptKey))
    .flatMap(([, objectiveList]) => objectiveList)
    .sort(
      (left, right) =>
        IMPORTANCE_RANK[right.importance] - IMPORTANCE_RANK[left.importance] || left.key.localeCompare(right.key),
    );

  const estimatedPlannedMinutes = coverage
    .filter((item) => item.disposition === "include")
    .reduce((sum, item) => sum + item.estimatedMinutes, 0);
  const deferredEstimatedMinutes = coverage
    .filter((item) => item.disposition === "defer")
    .reduce((sum, item) => sum + item.estimatedMinutes, 0);
  const timeBudget: ProposalTimeBudget = {
    horizon: time.horizon,
    now,
    deadlineAt: time.deadlineAt,
    daysRemaining: time.daysRemaining,
    minutesPerWeek: perWeek,
    estimatedAvailableMinutes,
    estimatedPlannedMinutes,
    deferredEstimatedMinutes,
    overBudgetMinutes:
      estimatedAvailableMinutes === null
        ? 0
        : Math.max(0, estimatedPlannedMinutes - estimatedAvailableMinutes),
  };

  return {
    status: unresolvedQuestions.some((need) => need.blocking)
      ? "collecting"
      : "ready_for_confirmation",
    confirmation: { required: true, state: "unconfirmed" },
    interpretedTarget: {
      role: intake.targetRole,
      outcome: intake.targetOutcome,
    },
    purpose: intake.purpose,
    timeBudget,
    coverage,
    objectives,
    diagnostics: diagnosticsFor(objectives),
    assumptions: assumptionsFor(intake),
    unresolvedQuestions,
  };
}
