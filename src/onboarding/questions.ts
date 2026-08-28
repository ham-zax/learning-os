import type {
  CatalogConceptCandidate,
  CatalogResolution,
  InformationNeed,
  IntakeArea,
  KnowledgeCatalog,
  NormalizedOnboardingIntake,
} from "./types.js";
import { normalizeAreaKey } from "./types.js";
import { resolveCatalogArea } from "./catalog.js";

function resolutionKey(catalog: KnowledgeCatalog, area: IntakeArea): string {
  const resolution = resolveCatalogArea(catalog, area);
  if (resolution.kind === "concept") {
    return `concept:${resolution.concept.topicId}/${resolution.concept.conceptId}`;
  }
  if (resolution.kind === "topic") return `topic:${resolution.topic.topicId}`;
  if (resolution.kind === "ambiguous") return `ambiguous:${normalizeAreaKey(area.label)}`;
  return `missing:${normalizeAreaKey(area.label)}`;
}

function materialRequirementAreas(intake: NormalizedOnboardingIntake): IntakeArea[] {
  const required = intake.sourceClaims
    .filter((claim) => claim.kind === "requirement" && claim.importance !== "supporting")
    .map((claim) => claim.area);
  return [
    ...intake.stack,
    ...intake.mustCover,
    ...intake.weakAreas,
    ...required,
  ];
}

function hasLearnerSignal(
  intake: NormalizedOnboardingIntake,
  catalog: KnowledgeCatalog,
  area: IntakeArea,
): boolean {
  const key = resolutionKey(catalog, area);
  const direct = [...intake.weakAreas, ...intake.strengths, ...intake.existingExperience].some(
    (candidate) => resolutionKey(catalog, candidate) === key,
  );
  if (direct) return true;
  return intake.sourceClaims.some(
    (claim) =>
      claim.source !== "job_description" &&
      ["experience", "strength", "weakness"].includes(claim.kind) &&
      resolutionKey(catalog, claim.area) === key,
  );
}

function isBroadTarget(value: string | null): boolean {
  if (!value) return false;
  const normalized = normalizeAreaKey(value);
  return new Set([
    "backend",
    "backend-engineer",
    "backend-developer",
    "software-engineer",
    "software-developer",
    "developer",
    "full-stack",
    "full-stack-engineer",
    "engineering",
  ]).has(normalized);
}

function catalogCandidates(resolution: CatalogResolution): CatalogConceptCandidate[] | undefined {
  const concepts =
    resolution.kind === "ambiguous"
      ? resolution.concepts
      : resolution.kind === "topic"
        ? resolution.topic.concepts
        : [];
  if (concepts.length === 0) return undefined;
  return concepts.map((concept) => ({
    topicId: concept.topicId,
    topicName: concept.topicName,
    conceptId: concept.conceptId,
    title: concept.title,
  }));
}

function addNeed(target: Map<string, InformationNeed>, need: InformationNeed): void {
  const key = `${need.code}/${need.subject ?? ""}`;
  const existing = target.get(key);
  if (!existing) {
    target.set(key, need);
    return;
  }
  const mergedCandidates = [...(existing.catalogCandidates ?? []), ...(need.catalogCandidates ?? [])]
    .filter(
      (candidate, index, all) =>
        all.findIndex(
          (other) =>
            other.topicId === candidate.topicId && other.conceptId === candidate.conceptId,
        ) === index,
    )
    .sort(
      (left, right) =>
        left.topicId.localeCompare(right.topicId) || left.conceptId.localeCompare(right.conceptId),
    );
  target.set(key, {
    ...existing,
    blocking: existing.blocking || need.blocking,
    changes: [...new Set([...existing.changes, ...need.changes])].sort(),
    reason: existing.reason === need.reason ? existing.reason : `${existing.reason} ${need.reason}`,
    ...(mergedCandidates.length > 0 ? { catalogCandidates: mergedCandidates } : {}),
  });
}

export function planInformationNeeds(
  intake: NormalizedOnboardingIntake,
  catalog: KnowledgeCatalog,
): InformationNeed[] {
  const needs = new Map<string, InformationNeed>();

  if (!intake.targetRole && !intake.targetOutcome) {
    addNeed(needs, {
      code: "target_outcome",
      subject: null,
      blocking: true,
      changes: ["coverage", "priority"],
      reason: "A concrete target role or outcome is required to choose relevant curriculum scope.",
    });
  }
  if (!intake.purpose) {
    addNeed(needs, {
      code: "preparation_purpose",
      subject: null,
      blocking: true,
      changes: ["strategy", "schedule"],
      reason: "Interview preparation and longer-term mastery use materially different preparation policy.",
    });
  }
  if (intake.purpose === "interview" && intake.deadlineAt === undefined) {
    addNeed(needs, {
      code: "deadline",
      subject: null,
      blocking: true,
      changes: ["schedule", "priority", "strategy"],
      reason: "Interview timing determines whether to cram high-value retrieval/transfer or build missing foundations first.",
    });
  }
  if (
    !intake.availability ||
    (intake.availability.minutesPerDay === undefined &&
      intake.availability.minutesPerWeek === undefined) ||
    (intake.availability.minutesPerDay !== undefined &&
      intake.availability.minutesPerWeek === undefined &&
      intake.availability.daysPerWeek === undefined)
  ) {
    addNeed(needs, {
      code: "time_budget",
      subject: null,
      blocking: true,
      changes: ["schedule", "coverage"],
      reason:
        intake.availability?.minutesPerDay !== undefined &&
        intake.availability.minutesPerWeek === undefined &&
        intake.availability.daysPerWeek === undefined
          ? "Study days per week are required to turn the daily budget into weekly capacity without assuming seven days."
          : "Available study time is required to decide what can fit before the target date.",
    });
  }

  const jdRequirements = intake.sourceClaims.filter((claim) => claim.kind === "requirement");
  const hasSpecificCoverage =
    intake.mustCover.length > 0 ||
    intake.weakAreas.length > 0 ||
    jdRequirements.length > 0 ||
    intake.stack.length > 1;
  if (
    (isBroadTarget(intake.targetRole) || isBroadTarget(intake.targetOutcome)) &&
    !hasSpecificCoverage
  ) {
    addNeed(needs, {
      code: "target_scope",
      subject: intake.targetRole ?? intake.targetOutcome,
      blocking: true,
      changes: ["coverage", "priority"],
      reason: "The target is too broad to choose a useful concept set without stack, domain, or interview-surface detail.",
    });
  }

  for (const area of materialRequirementAreas(intake)) {
    const resolution = resolveCatalogArea(catalog, area);
    if (resolution.kind === "topic" || resolution.kind === "ambiguous") {
      addNeed(needs, {
        code: "concept_scope",
        subject: area.label,
        blocking: true,
        changes: ["coverage", "depth", "strategy"],
        reason:
          resolution.kind === "topic"
            ? `The existing ${resolution.topic.topicName} library is broader than one objective; the relevant concepts must be identified.`
            : resolution.concepts.length === 1
              ? `A likely existing concept (${resolution.concepts[0].title}) matches this wording; confirm whether it is the intended scope.`
              : "The area maps to multiple existing concepts and needs an explicit concept choice.",
        catalogCandidates: catalogCandidates(resolution),
      });
    }
  }

  for (const claim of jdRequirements) {
    if (claim.importance === "supporting") continue;
    if (!hasLearnerSignal(intake, catalog, claim.area)) {
      addNeed(needs, {
        code: "experience_depth",
        subject: claim.area.label,
        blocking: true,
        changes: ["strategy", "depth"],
        reason: "The job requirement establishes importance, but learner exposure is unknown; learn versus diagnose/refresh would change.",
      });
    }
  }

  const materiallyRequiredKeys = new Set(
    [...intake.mustCover, ...jdRequirements.filter((claim) => claim.importance !== "supporting").map((claim) => claim.area)]
      .map((area) => resolutionKey(catalog, area)),
  );
  const strategyRelevantKeys = new Set(
    [
      ...intake.stack,
      ...intake.mustCover,
      ...intake.currentStudyPlan,
      ...intake.sourceClaims
        .filter((claim) => claim.kind === "requirement" || claim.kind === "coverage")
        .map((claim) => claim.area),
    ].map((area) => resolutionKey(catalog, area)),
  );
  for (const area of intake.existingExperience) {
    if (area.depth) continue;
    const key = resolutionKey(catalog, area);
    if (!strategyRelevantKeys.has(key)) continue;
    addNeed(needs, {
      code: "experience_depth",
      subject: area.label,
      blocking: materiallyRequiredKeys.has(key),
      changes: ["strategy", "depth"],
      reason: "Reported experience establishes exposure only; depth changes whether the plan should learn, refresh, or diagnose first.",
    });
  }
  for (const claim of intake.sourceClaims) {
    if (claim.source !== "resume" || claim.kind !== "experience" || claim.experienceDepth) continue;
    const key = resolutionKey(catalog, claim.area);
    if (!strategyRelevantKeys.has(key)) continue;
    addNeed(needs, {
      code: "experience_depth",
      subject: claim.area.label,
      blocking: materiallyRequiredKeys.has(key),
      changes: ["strategy", "depth"],
      reason: "Resume experience proves prior exposure only; depth must be clarified or checked diagnostically before choosing a refresh path.",
    });
  }

  const excluded = new Map(
    intake.exclusions.map((area) => [resolutionKey(catalog, area), area] as const),
  );
  for (const required of [
    ...intake.mustCover,
    ...jdRequirements.filter((claim) => claim.importance !== "supporting").map((claim) => claim.area),
  ]) {
    const conflict = excluded.get(resolutionKey(catalog, required));
    if (!conflict) continue;
    addNeed(needs, {
      code: "coverage_conflict",
      subject: required.label,
      blocking: true,
      changes: ["coverage", "priority"],
      reason: "The same area is both required and excluded; the learner must choose which constraint wins.",
    });
  }

  const order: Record<InformationNeed["code"], number> = {
    target_outcome: 0,
    preparation_purpose: 1,
    deadline: 2,
    time_budget: 3,
    target_scope: 4,
    coverage_conflict: 5,
    concept_scope: 6,
    experience_depth: 7,
  };
  return [...needs.values()].sort(
    (left, right) =>
      order[left.code] - order[right.code] ||
      Number(right.blocking) - Number(left.blocking) ||
      (left.subject ?? "").localeCompare(right.subject ?? ""),
  );
}
