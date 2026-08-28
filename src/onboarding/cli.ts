import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import type { Interface } from "node:readline";
import { resolveCatalogArea } from "./catalog.js";
import { normalizeAreaKey } from "./types.js";
import type {
  ExperienceDepth,
  InformationNeed,
  IntakeArea,
  KnowledgeCatalog,
  OnboardingIntake,
  OnboardingProposal,
  PreparationPurpose,
} from "./types.js";
import type { MissingConceptMaterialization } from "./apply.js";
import { createTeacherWorkspace } from "../workspace.js";

export interface OfflineOnboardingOptions {
  dataDir: string;
  knowledgeRoot: string;
}

function ask(rl: Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, (answer: string) => resolve(answer.trim())));
}

async function requireAnswer(rl: Interface, prompt: string): Promise<string> {
  while (true) {
    const answer = await ask(rl, prompt);
    if (answer) return answer;
    console.log("A value is required.");
  }
}

function parseArea(value: string): IntakeArea {
  const trimmed = value.trim();
  const slash = trimmed.indexOf("/");
  if (slash > 0 && slash < trimmed.length - 1) {
    const topicId = trimmed.slice(0, slash).trim();
    const conceptId = trimmed.slice(slash + 1).trim();
    return { label: conceptId, topicId, conceptId };
  }
  return { label: trimmed };
}

function parseAreas(value: string): IntakeArea[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map(parseArea);
}

function humanizeId(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function replaceArea(intake: OnboardingIntake, subject: string, replacement: IntakeArea): void {
  const target = normalizeAreaKey(subject);
  const replace = (areas: IntakeArea[] | undefined): IntakeArea[] | undefined =>
    areas?.map((area) =>
      normalizeAreaKey(area.label) === target ? replacement : area,
    );
  intake.stack = replace(intake.stack);
  intake.mustCover = replace(intake.mustCover);
  intake.weakAreas = replace(intake.weakAreas);
  intake.strengths = replace(intake.strengths);
  intake.currentStudyPlan = replace(intake.currentStudyPlan);
  intake.exclusions = replace(intake.exclusions);
  intake.depriorities = replace(intake.depriorities);
}

function findArea(intake: OnboardingIntake, subject: string): IntakeArea {
  const target = normalizeAreaKey(subject);
  const areas = [
    ...(intake.mustCover ?? []),
    ...(intake.stack ?? []),
    ...(intake.weakAreas ?? []),
    ...(intake.strengths ?? []),
  ];
  return areas.find((area) => normalizeAreaKey(area.label) === target) ?? { label: subject };
}

async function askPurpose(rl: Interface): Promise<PreparationPurpose> {
  while (true) {
    const value = (await ask(
      rl,
      "Purpose [interview | role_readiness | long_term_mastery]: ",
    )) as PreparationPurpose;
    if (["interview", "role_readiness", "long_term_mastery"].includes(value)) return value;
    console.log("Choose interview, role_readiness, or long_term_mastery.");
  }
}

async function askPositiveInteger(rl: Interface, prompt: string): Promise<number> {
  while (true) {
    const value = Number.parseInt(await ask(rl, prompt), 10);
    if (Number.isInteger(value) && value > 0) return value;
    console.log("Enter a positive whole number.");
  }
}

async function askDaysPerWeek(rl: Interface): Promise<number> {
  while (true) {
    const value = await askPositiveInteger(rl, "Study days per week [1-7]: ");
    if (value <= 7) return value;
    console.log("Enter a whole number from 1 to 7.");
  }
}

async function askDeadline(rl: Interface): Promise<string | null> {
  while (true) {
    const value = await ask(rl, "Deadline ISO date/time, or 'none': ");
    if (value.toLowerCase() === "none") return null;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    console.log("Enter a valid date/time or 'none'.");
  }
}

function catalogOptions(catalog: KnowledgeCatalog, subject: string): string[] {
  const resolution = resolveCatalogArea(catalog, { label: subject });
  if (resolution.kind === "topic") {
    return resolution.topic.concepts.map(
      (concept) => `${concept.topicId}/${concept.conceptId} — ${concept.title}`,
    );
  }
  if (resolution.kind === "ambiguous") {
    return resolution.concepts.map(
      (concept) => `${concept.topicId}/${concept.conceptId} — ${concept.title}`,
    );
  }
  return [];
}

async function answerInformationNeed(
  rl: Interface,
  intake: OnboardingIntake,
  need: InformationNeed,
  catalog: KnowledgeCatalog,
): Promise<void> {
  console.log(`\nMore information needed: ${need.reason}`);
  switch (need.code) {
    case "target_outcome":
      intake.targetOutcome = await requireAnswer(rl, "Target outcome: ");
      return;
    case "preparation_purpose":
      intake.purpose = await askPurpose(rl);
      return;
    case "deadline":
      intake.deadlineAt = await askDeadline(rl);
      return;
    case "time_budget": {
      const existing = intake.availability ?? {};
      if (
        existing.minutesPerDay !== undefined &&
        existing.minutesPerWeek === undefined &&
        existing.daysPerWeek === undefined
      ) {
        intake.availability = {
          ...existing,
          daysPerWeek: await askDaysPerWeek(rl),
        };
        return;
      }
      const minutesPerDay = await askPositiveInteger(rl, "Normal study minutes per day: ");
      intake.availability = {
        ...existing,
        minutesPerDay,
        daysPerWeek: existing.daysPerWeek ?? await askDaysPerWeek(rl),
      };
      return;
    }
    case "target_scope": {
      const areas = parseAreas(
        await requireAnswer(
          rl,
          "Specific coverage (comma-separated; prefer topic/concept for catalog items): ",
        ),
      );
      intake.mustCover = [...(intake.mustCover ?? []), ...areas];
      return;
    }
    case "concept_scope": {
      const subject = need.subject ?? "this area";
      const options = catalogOptions(catalog, subject);
      if (options.length > 0) {
        console.log("Available catalog concepts:");
        for (const option of options) console.log(`  ${option}`);
      }
      const exact = parseArea(
        await requireAnswer(rl, `Choose exact topic/concept for ${subject}: `),
      );
      if (!exact.topicId || !exact.conceptId) {
        throw new Error("Concept clarification requires topic/concept syntax.");
      }
      replaceArea(intake, subject, exact);
      return;
    }
    case "experience_depth": {
      const subject = need.subject ?? "this area";
      let depth: ExperienceDepth | null = null;
      while (!depth) {
        const value = await ask(rl, `Experience depth for ${subject} [none|exposed|working|deep]: `);
        if (["none", "exposed", "working", "deep"].includes(value)) {
          depth = value as ExperienceDepth;
        }
      }
      const area = findArea(intake, subject);
      intake.existingExperience = [
        ...(intake.existingExperience ?? []).filter(
          (candidate) => normalizeAreaKey(candidate.label) !== normalizeAreaKey(subject),
        ),
        { ...area, depth },
      ];
      return;
    }
    case "coverage_conflict": {
      const subject = need.subject ?? "this area";
      const keep = (await requireAnswer(
        rl,
        `${subject} is both required and excluded. Keep it? [yes/no]: `,
      )).toLowerCase();
      if (keep === "yes" || keep === "y") {
        intake.exclusions = (intake.exclusions ?? []).filter(
          (area) => normalizeAreaKey(area.label) !== normalizeAreaKey(subject),
        );
      } else {
        intake.mustCover = (intake.mustCover ?? []).filter(
          (area) => normalizeAreaKey(area.label) !== normalizeAreaKey(subject),
        );
      }
      return;
    }
  }
}

function displayProposal(proposal: OnboardingProposal): void {
  console.log("\nPreparation proposal\n");
  console.log(`Target: ${proposal.interpretedTarget.outcome ?? proposal.interpretedTarget.role ?? "(missing)"}`);
  console.log(`Purpose: ${proposal.purpose ?? "(missing)"}`);
  console.log(`Deadline: ${proposal.timeBudget.deadlineAt ?? "none"}`);
  console.log(`Weekly budget: ${proposal.timeBudget.minutesPerWeek} min`);
  console.log(
    `Planned/deferred: ${proposal.timeBudget.estimatedPlannedMinutes}/${proposal.timeBudget.deferredEstimatedMinutes} min`,
  );

  console.log("\nCoverage:");
  for (const item of proposal.coverage) {
    console.log(
      `  ${item.disposition.toUpperCase().padEnd(7)} ${item.label} — ${item.action}, ${item.importance}`,
    );
  }

  console.log("\nObjectives:");
  for (const objective of proposal.objectives) {
    console.log(
      `  ${objective.key} — ${objective.strategy}; ${objective.importance}; target ${objective.targetReadiness}` +
        `${objective.requireTransfer ? "; transfer" : ""}` +
        `${objective.requireDurability ? "; durability" : ""}`,
    );
  }

  if (proposal.assumptions.length > 0) {
    console.log("\nPlanning assumptions (NOT mastery evidence):");
    for (const assumption of proposal.assumptions) {
      console.log(`  ${assumption.subject}: ${assumption.effect}`);
    }
  }

  if (proposal.diagnostics.length > 0) {
    console.log("\nInitial evidence-producing diagnostics:");
    for (const diagnostic of proposal.diagnostics) {
      console.log(`  ${diagnostic.objectiveKey} — ${diagnostic.kind}`);
    }
  }
}

async function materializeMissingConcepts(
  rl: Interface,
  proposal: OnboardingProposal,
  catalog: KnowledgeCatalog,
): Promise<MissingConceptMaterialization[]> {
  const missing = proposal.coverage.filter(
    (coverage) => coverage.disposition === "include" && coverage.action === "create_missing",
  );
  const result: MissingConceptMaterialization[] = [];
  for (const coverage of missing) {
    console.log(`\nNo reusable catalog concept matched: ${coverage.label}`);
    console.log("The concept ID/title will be derived automatically; only learning-relevant metadata is needed.");

    let topicId = coverage.topicId;
    let topicName: string;
    if (topicId) {
      topicName = catalog.topics.find((topic) => topic.topicId === topicId)?.topicName ?? humanizeId(topicId);
    } else {
      const topicAnswer = await requireAnswer(
        rl,
        `Topic/group for ${coverage.label} (for example: postgres): `,
      );
      topicId = normalizeAreaKey(topicAnswer);
      topicName = catalog.topics.find((topic) => topic.topicId === topicId)?.topicName ?? topicAnswer;
    }

    const conceptId = coverage.suggestedConceptId ?? normalizeAreaKey(coverage.label);
    const prerequisites = parseAreas(
      await ask(rl, "Known prerequisite concepts (comma-separated, optional): "),
    ).map((area) => area.conceptId ?? normalizeAreaKey(area.label));
    result.push({
      coverageKey: coverage.key,
      topicId,
      topicName,
      conceptId,
      title: coverage.label,
      difficulty: 3,
      prerequisites,
      tags: [],
    });
  }
  return result;
}

export async function runOfflineOnboarding(options: OfflineOnboardingOptions): Promise<void> {
  const rl = createInterface({ input, output });
  const workspace = createTeacherWorkspace({
    dataDir: options.dataDir,
    knowledgeRoot: options.knowledgeRoot,
  });
  try {
    console.log(
      "Offline onboarding uses structured answers only. For resume/JD text, use ChatGPT or another compatible teacher to extract OnboardingIntake first.\n",
    );
    const targetOutcome = await requireAnswer(rl, "What are you preparing for? ");
    const purpose = await askPurpose(rl);
    const deadlineAt = await askDeadline(rl);
    const minutesPerDay = await askPositiveInteger(rl, "Normal study minutes per day: ");
    const daysPerWeek = await askDaysPerWeek(rl);
    const coverage = parseAreas(
      await requireAnswer(
        rl,
        "Must-cover areas (comma-separated; prefer topic/concept for catalog items): ",
      ),
    );
    const strengths = parseAreas(await ask(rl, "Known strengths (comma-separated, optional): "));
    const weaknesses = parseAreas(await ask(rl, "Known weak areas (comma-separated, optional): "));

    const intake: OnboardingIntake = {
      targetOutcome,
      purpose,
      deadlineAt,
      availability: { minutesPerDay, daysPerWeek },
      mustCover: coverage,
      strengths,
      weakAreas: weaknesses,
    };
    const catalog = workspace.loadKnowledgeCatalog();
    const planningNow = new Date().toISOString();

    let proposal: OnboardingProposal;
    while (true) {
      const needs = workspace.planOnboardingInformationNeeds(intake, catalog);
      const blocking = needs.find((need) => need.blocking);
      if (blocking) {
        await answerInformationNeed(rl, intake, blocking, catalog);
        continue;
      }

      proposal = workspace.buildOnboardingProposal({ intake, catalog, now: planningNow });
      if (proposal.status !== "ready_for_confirmation") {
        throw new Error("Onboarding is still collecting required information.");
      }
      const ambiguous = proposal.coverage.find((coverage) => coverage.action === "clarify_scope");
      if (!ambiguous) break;
      await answerInformationNeed(
        rl,
        intake,
        {
          code: "concept_scope",
          subject: ambiguous.label,
          blocking: true,
          changes: ["coverage", "priority", "strategy"],
          reason: `${ambiguous.label} is still broader than a concrete curriculum concept.`,
        },
        catalog,
      );
    }

    const missingConcepts = await materializeMissingConcepts(rl, proposal, catalog);
    displayProposal(proposal);

    const confirmation = (await ask(rl, "\nApply this plan and create a NEW learner profile? [y/N]: ")).toLowerCase();
    if (confirmation !== "y" && confirmation !== "yes") {
      console.log("Onboarding declined. No learner profile was created.");
      return;
    }

    const profileName = await requireAnswer(rl, "Learner profile display name: ");
    const applied = workspace.applyConfirmedOnboarding({
      intake,
      catalog,
      planningNow,
      proposal,
      confirmed: true,
      confirmedAt: new Date().toISOString(),
      profile: { displayName: profileName },
      missingConcepts,
    });
    console.log(`\nCreated and selected profile ${applied.profile.id}.`);
    console.log(`Goal: ${applied.goalId}`);
    console.log(`Activated objectives: ${applied.activatedObjectives.length}`);
    console.log(`Next action: ${applied.nextAction}`);
  } finally {
    rl.close();
  }
}
