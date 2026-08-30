#!/usr/bin/env node

/**
 * CLI entry point for the generic tutor engine.
 *
 * Commands:
 *   tutor <topic>              Auto-detect: session or ingestion mode
 *   tutor ingest <topic>       Run ingestion pipeline
 *   tutor init <topic> <file>  Initialize a topic from a manifest JSON
 *   tutor gaps                 Show skill gaps from job-hunter
 *   tutor interview <topic>    Start interview drill
 *   tutor goal <topic>         Configure/list active goal objectives
 *   tutor today <topic>        Build today's evidence-driven mission
 *   tutor onboard              Structured offline onboarding fallback
 *   tutor profile <command>    Create/list/select learner profiles
 *   tutor due                  Show due objectives
 *   tutor stats                Show objective-level topic summary
 *   tutor sync                 Sync gaps and signals
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { Command } from "commander";
import chalk from "chalk";

import type { createDatabase } from "./db/database.js";
import {
  createProfile,
  getActiveProfile,
  getProfile,
  listProfiles,
  openProfileDatabase,
  selectProfile,
} from "./profile/index.js";
import {
  getTopicSummary,
  initializeTopic,
} from "./state.js";
import {
  startSession,
  prepareOrdinaryChallenge,
  endSession,
} from "./session/engine.js";
import { openJobHunterDb, getSkillGaps } from "./integrations/job-hunter.js";
import { openAiFeedsDb, getHighScoredPapers } from "./integrations/ai-feeds.js";
import {
  ingestFromSource,
  generateConceptFiles,
  syncGaps,
  syncSignals,
} from "./ingest/orchestrator.js";
import { getTodayMission, resolveTodayAvailableMinutes } from "./plan/today.js";
import { getDueObjectives } from "./scheduler/index.js";
import { searchConcepts, findRelatedConcepts } from "./knowledge/search.js";
import { exportToAnki } from "./sync/anki-export.js";
import { syncToObsidian } from "./sync/obsidian-sync.js";
import { createLLMClient } from "./llm/client.js";
import type { LLMClient } from "./llm/client.js";
import { startCodingDrill, submitCodingSolution, formatCodingResult } from "./interview/coding.js";
import {
  startDesignDrill,
  submitPhase,
  getPhasePrompt,
  assessDesignDrill,
  formatDesignResult,
} from "./interview/system-design.js";
import {
  getTopic,
  getConceptsByTopic,
  createTopic,
  listTopics,
  updateTopic,
  getGoalObjectives,
  setGoalObjective,
} from "./db/database.js";
import {
  completeSessionFeedback,
  finishSessionInteraction,
  openAttempt,
  recordExposure,
  submitAttempt,
} from "./kernel/foundation.js";

import {
  loadConcept,
  sectionText,
  extraSectionHeadings,
} from "./knowledge/loader.js";
import { generateExploreSequence } from "./session/modes/explore.js";
import { generateTeachBackSession } from "./session/modes/teach-back.js";
import { generateQuizBatch } from "./session/modes/quiz.js";

import type { ConceptMap, ConceptProposal, ConceptFile } from "./knowledge/types.js";
import { DeliveryContext, GoalImportance, GoalTargetReadiness } from "./db/types.js";
import { runOfflineOnboarding } from "./onboarding/cli.js";

// ─── Config ──────────────────────────────────────────────────────────────────

const PROFILE_DATA_DIR = resolve("./data");
const JOB_HUNTER_DB_PATH = resolve("../job-hunter/data/job_hunter.db");
const AI_FEEDS_DB_PATH = resolve("../ai-feeds/db/ai-feeds.sqlite");
const KNOWLEDGE_DIR = resolve("./knowledge");
const VAULT_PATH = resolve("../vault");

interface TutorConfig {
  daily_minutes: number;
  knowledge_dir: string;
}

function loadConfig(): TutorConfig {
  try {
    const raw = readFileSync(resolve("./config.json"), "utf-8");
    return JSON.parse(raw) as TutorConfig;
  } catch {
    return { daily_minutes: 30, knowledge_dir: "./knowledge" };
  }
}

/** Create LLM client if configured, null otherwise. */
function tryCreateLLM(): LLMClient | null {
  try {
    const client = createLLMClient();
    return client.isConfigured() ? client : null;
  } catch {
    return null;
  }
}

// ─── Interactive helpers ─────────────────────────────────────────────────────

function createPrompt(): ReturnType<typeof createInterface> {
  return createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function askYesNo(
  rl: ReturnType<typeof createInterface>,
  question: string,
): Promise<boolean> {
  return ask(rl, `${question} [y/N] `).then(
    (answer) => answer.toLowerCase() === "y" || answer.toLowerCase() === "yes",
  );
}

// ─── Display helpers ─────────────────────────────────────────────────────────

function header(text: string): void {
  console.log(chalk.bold.underline(`\n${text}\n`));
}

function info(text: string): void {
  console.log(chalk.dim(text));
}

function success(text: string): void {
  console.log(chalk.green(text));
}

function warn(text: string): void {
  console.log(chalk.yellow(text));
}

function error(text: string): void {
  console.error(chalk.red(text));
}

function profileStoreOptions() {
  return { dataDir: PROFILE_DATA_DIR } as const;
}

function cliProfileOverride(): string | undefined {
  return program.opts<{ profile?: string }>().profile;
}

function openCliDatabase(): ReturnType<typeof createDatabase> {
  return openProfileDatabase(cliProfileOverride(), profileStoreOptions());
}

// ─── Topic auto-detection ────────────────────────────────────────────────────

function topicExists(db: ReturnType<typeof createDatabase>, topicId: string): boolean {
  const topic = getTopic(db, topicId);
  return topic !== undefined;
}

function topicHasConcepts(db: ReturnType<typeof createDatabase>, topicId: string): boolean {
  const concepts = getConceptsByTopic(db, topicId);
  return concepts.length > 0;
}

// ─── Concept map display ─────────────────────────────────────────────────────

function displayConceptMap(concepts: ConceptProposal[]): void {
  header("Proposed Concept Map");
  for (let i = 0; i < concepts.length; i++) {
    const c = concepts[i];
    const diffBar = "=".repeat(c.difficulty) + ".".repeat(5 - c.difficulty);
    console.log(
      `  ${chalk.bold(`${i + 1}.`)} ${c.title} ${chalk.dim(`[${diffBar}] ${c.estimatedMinutes}min`)}`,
    );
    if (c.prerequisites.length > 0) {
      console.log(chalk.dim(`     prereqs: ${c.prerequisites.join(", ")}`));
    }
  }
  console.log();
}

// ─── Concept file resolution ─────────────────────────────────────────────────

/**
 * Locate the markdown file backing a concept.  Topic packs use two layouts —
 * `<topic>/concepts/<id>.md` (kubernetes, llm, foundry) and `<topic>/<id>.md`
 * (system-design) — so both are tried.  Returns null when neither exists,
 * which is not an error: the session falls back to metadata only.
 */
function resolveConceptFile(
  knowledgeDir: string,
  topicId: string,
  conceptId: string,
): string | null {
  const candidates = [
    resolve(knowledgeDir, topicId, "concepts", `${conceptId}.md`),
    resolve(knowledgeDir, topicId, `${conceptId}.md`),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

/** Load a concept's markdown, or null if it is missing or unparseable. */
function tryLoadConceptFile(
  knowledgeDir: string,
  topicId: string,
  conceptId: string,
): ConceptFile | null {
  const filePath = resolveConceptFile(knowledgeDir, topicId, conceptId);
  if (!filePath) return null;
  try {
    return loadConcept(filePath);
  } catch {
    return null;
  }
}

/** Print a titled block of markdown, indented, skipping empty content. */
function reveal(label: string, content: string): void {
  if (!content.trim()) return;
  console.log(chalk.bold.cyan(`\n  ── ${label} ──\n`));
  for (const line of content.split("\n")) {
    console.log(line ? `  ${line}` : "");
  }
}

type MaterialRevealRecorder = (sourceRef: string, content: string) => void;

function revealWithExposure(
  label: string,
  content: string,
  sourceRef: string,
  recordMaterialExposure: MaterialRevealRecorder,
): void {
  if (!content.trim()) return;
  recordMaterialExposure(sourceRef, content);
  reveal(label, content);
}

/** Reveal any sections the typed fields don't claim (Common Patterns, References…). */
function revealExtraSections(
  file: ConceptFile,
  recordMaterialExposure: MaterialRevealRecorder,
): void {
  for (const heading of extraSectionHeadings(file)) {
    const content = file.sections[heading] ?? "";
    if (!content.trim()) continue;
    recordMaterialExposure(`section:${heading}`, content);
    reveal(heading, content);
  }
}

function challengeReferenceMaterial(file: ConceptFile | null): string[] {
  if (!file) return [];
  return [file.summary, ...file.keyPoints, file.deepDive].filter(
    (item) => item.trim().length > 0,
  );
}

// ─── Mode presenters ─────────────────────────────────────────────────────────

/**
 * Explore acquisition material before the frozen restatement response.
 * Every material reveal is recorded before it is shown.
 */
async function presentExploreAcquisition(
  rl: ReturnType<typeof createInterface>,
  file: ConceptFile | null,
  recordMaterialExposure: MaterialRevealRecorder,
): Promise<void> {
  if (!file) {
    await ask(rl, chalk.dim("\n  Press Enter when ready to answer..."));
    return;
  }

  const sequence = generateExploreSequence(file);

  for (const step of sequence.steps) {
    if (step.type === "question") {
      await ask(rl, chalk.yellow(`\n  ${step.content.replace(/\*\*/g, "")}\n  > `));
      continue;
    }

    const label =
      step.section === "keyPoints"
        ? "Key Points"
        : step.section === "deepDive"
          ? "Deep Dive"
          : "Summary";
    revealWithExposure(
      label,
      sectionText(file, step.section ?? ""),
      `section:${step.section ?? "material"}`,
      recordMaterialExposure,
    );
  }

  revealWithExposure(
    "Gotchas",
    sectionText(file, "misconceptions"),
    "section:misconceptions",
    recordMaterialExposure,
  );
  revealExtraSections(file, recordMaterialExposure);
}

function revealTeachBackReference(
  file: ConceptFile | null,
  recordMaterialExposure: MaterialRevealRecorder,
): void {
  if (!file) return;
  revealWithExposure("Summary", sectionText(file, "summary"), "section:summary", recordMaterialExposure);
  revealWithExposure(
    "Key Points",
    sectionText(file, "keyPoints"),
    "section:keyPoints",
    recordMaterialExposure,
  );
  revealWithExposure(
    "Deep Dive",
    sectionText(file, "deepDive"),
    "section:deepDive",
    recordMaterialExposure,
  );
  revealWithExposure(
    "Gotchas",
    sectionText(file, "misconceptions"),
    "section:misconceptions",
    recordMaterialExposure,
  );
}

function revealQuizReference(
  file: ConceptFile | null,
  recordMaterialExposure: MaterialRevealRecorder,
): void {
  if (!file) return;
  revealWithExposure("Summary", sectionText(file, "summary"), "section:summary", recordMaterialExposure);
  revealWithExposure(
    "Key Points",
    sectionText(file, "keyPoints"),
    "section:keyPoints",
    recordMaterialExposure,
  );
  revealWithExposure(
    "Gotchas",
    sectionText(file, "misconceptions"),
    "section:misconceptions",
    recordMaterialExposure,
  );
}

// ─── Session delivery context ────────────────────────────────────────────────

function normalizeSessionDeliveryContext(value: string): DeliveryContext {
  switch (value) {
    case "learn":
    case "practice":
    case "review":
      return value;
    case "explore":
      return "learn";
    case "quiz":
      return "review";
    case "teach-back":
      return "practice";
    default:
      throw new Error(
        `Unknown session delivery context "${value}". Use learn, practice, or review.`,
      );
  }
}

async function runSession(
  db: ReturnType<typeof createDatabase>,
  topicId: string,
  mode: DeliveryContext = "learn",
): Promise<void> {
  const sessionState = startSession(db, { topicId, mode });

  if (sessionState.concepts.length === 0) {
    warn("No concepts available for this session.");
    return;
  }

  const rl = createPrompt();

  console.log(
    chalk.bold(`\nSession started — ${mode} context, ${sessionState.concepts.length} concepts\n`),
  );

  const config = loadConfig();
  const knowledgeDir = resolve(config.knowledge_dir);
  let missingFiles = 0;

  for (const concept of sessionState.concepts) {
    console.log(chalk.bold.underline(`\nConcept: ${concept.title}`));
    console.log(chalk.dim(`  Difficulty: ${concept.difficulty}/5`));

    const file = tryLoadConceptFile(knowledgeDir, topicId, concept.id);
    if (!file) missingFiles++;

    let surfaceId: string;
    let prompt: string;

    if (mode === "learn") {
      const sequence = file ? generateExploreSequence(file) : null;
      surfaceId = sequence?.surfaceId ?? "restatement";
      prompt =
        sequence?.assessmentPrompt ??
        `Explain **${concept.title}** in your own words as if teaching someone new to it.`;
    } else if (mode === "practice") {
      const teachBack = file ? generateTeachBackSession(file) : null;
      surfaceId = teachBack?.surfaceId ?? "teach-back";
      prompt =
        teachBack?.openingPrompt ??
        `Explain **${concept.title}** to me like I'm new to this topic. Focus on the mechanism and intuition.`;
    } else if (mode === "review") {
      const question = file ? generateQuizBatch([file], 1).questions[0] : undefined;
      surfaceId = question?.surfaceId ?? "general-explanation";
      prompt =
        question?.question ??
        `Explain the key ideas behind **${concept.title}** in your own words.`;
    } else {
      throw new Error(`Delivery context ${mode} is not supported by ordinary sessions.`);
    }

    const prepared = prepareOrdinaryChallenge(db, concept, mode, {
      surfaceId,
      prompt,
      referenceMaterial: challengeReferenceMaterial(file),
    });
    const opened = openAttempt(
      db,
      prepared.challenge.id,
      prepared.challenge.version,
      sessionState.sessionId,
    );

    const recordLearnExposure: MaterialRevealRecorder = (sourceRef, content) => {
      recordExposure(db, sessionState.sessionId, {
        attemptId: opened.attempt.id,
        objectiveIds: [prepared.objectiveId],
        exposureType: "explanation_shown",
        sourceRef,
        teachingMaterial: { content, format: "markdown" },
      });
    };
    const recordPostResponseExposure: MaterialRevealRecorder = (sourceRef, content) => {
      recordExposure(db, sessionState.sessionId, {
        attemptId: opened.attempt.id,
        objectiveIds: [prepared.objectiveId],
        exposureType: "answer_revealed",
        sourceRef,
        teachingMaterial: { content, format: "markdown" },
      });
    };

    if (mode === "learn") {
      console.log(
        chalk.dim(`  Prerequisites: ${concept.prerequisites.join(", ") || "none"}`),
      );
      await presentExploreAcquisition(rl, file, recordLearnExposure);
    }

    const response = await ask(
      rl,
      chalk.yellow(`\n  ${opened.challenge.publicPrompt.replace(/\*\*/g, "")}\n  > `),
    );
    submitAttempt(db, opened.attempt.id, { responseText: response });

    if (mode === "practice") {
      revealTeachBackReference(file, recordPostResponseExposure);
    } else if (mode === "review") {
      revealQuizReference(file, recordPostResponseExposure);
    }

    info("  Response submitted. Assessment pending; no trusted evaluator is configured in this CLI.");
  }

  const summary = endSession(db, sessionState.sessionId);

  header("Session Complete");
  if (missingFiles > 0) {
    warn(
      `  ${missingFiles} of ${sessionState.concepts.length} concept(s) had no markdown file — ` +
        `those used a generic explanation prompt.`,
    );
  }
  console.log(`  Challenges attempted: ${summary.challengesAttempted}`);
  console.log(`  Submitted attempts: ${summary.submittedAttempts}`);
  console.log(`  Assessed attempts: ${summary.assessedAttempts}`);
  console.log(`  Awaiting assessment: ${summary.pendingAssessmentAttempts}`);
  console.log(`  Wall elapsed: ${Math.floor(summary.duration / 60)}m ${summary.duration % 60}s (not active study time)`);

  rl.close();
}

// ─── Ingestion mode ──────────────────────────────────────────────────────────

async function runIngestion(
  db: ReturnType<typeof createDatabase>,
  topicId: string,
  sourceType: "job-hunter" | "ai-feeds" | "manual",
  manualMaterial?: string,
): Promise<void> {
  const rl = createPrompt();

  // Ensure topic exists
  if (!topicExists(db, topicId)) {
    const topicName = topicId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    createTopic(db, { id: topicId, name: topicName });
    success(`Created topic: ${topicName}`);
  }

  let material = manualMaterial;

  if (sourceType === "manual" && !material) {
    console.log(chalk.dim("Enter concept material (one concept per line). Type END on a blank line to finish:\n"));
    const lines: string[] = [];
    let line: string;
    while ((line = await ask(rl, "")) !== "END") {
      lines.push(line);
    }
    material = lines.join("\n");
  }

  info(`\nIngesting from ${sourceType}...`);

  const result = await ingestFromSource({
    topic: topicId,
    source: { type: sourceType, data: material },
    jobHunterDbPath: JOB_HUNTER_DB_PATH,
    aiFeedsDbPath: AI_FEEDS_DB_PATH,
    manualMaterial: material,
  });

  if (result.validationErrors.length > 0) {
    for (const err of result.validationErrors) {
      error(`  Validation: ${err}`);
    }
  }

  if (result.concepts.length === 0) {
    warn("No concepts proposed from this source.");
    rl.close();
    return;
  }

  displayConceptMap(result.concepts);

  const approved = await askYesNo(rl, "Approve this concept map?");
  if (!approved) {
    warn("Ingestion cancelled.");
    rl.close();
    return;
  }

  info("\nGenerating concept files...");

  const conceptMap: ConceptMap = {
    topic: topicId,
    description: result.description,
    concepts: result.concepts,
  };

  // Use LLM enrichment if available
  const llm = tryCreateLLM();
  if (llm) {
    info("LLM enrichment enabled — generating rich content...");
  }

  const files = await generateConceptFiles(db, topicId, conceptMap, KNOWLEDGE_DIR, llm);
  success(`Generated ${files.length} concept file(s).`);

  for (const f of files) {
    console.log(chalk.dim(`  ${f}`));
  }

  console.log();
  rl.close();
}

// ─── Interview drills ────────────────────────────────────────────────────────

async function runCodingDrill(
  db: ReturnType<typeof createDatabase>,
  conceptId: string,
  difficulty?: number,
): Promise<void> {
  try {
    const state = startCodingDrill(db, { conceptId, difficulty });
    const { problem } = state;

    header(`Coding Problem: ${problem.title}`);
    console.log(`Difficulty: ${problem.difficulty}/5`);
    console.log(`Tags: ${problem.tags.join(", ") || "none"}`);
    console.log(`Time limit: ${Math.round(state.timeLimitMs / 60000)} minutes`);
    console.log();
    console.log(problem.description);
    console.log();

    if (problem.testCases.length > 0) {
      info("Descriptive scenarios (not executable verification):");
      for (const tc of problem.testCases) {
        console.log(chalk.dim(`  Input:  ${tc.input}`));
        console.log(chalk.dim(`  Output: ${tc.expectedOutput}`));
      }
      console.log();
    }

    warn("Submit your solution (type END on a blank line to finish):\n");

    const rl = createPrompt();
    const lines: string[] = [];
    let line: string;
    while ((line = await ask(rl, "")) !== "END") {
      lines.push(line);
    }
    rl.close();

    const code = lines.join("\n");
    if (!code.trim()) {
      warn("Empty submission — leaving the opened attempt unsubmitted.");
      return;
    }

    const llm = tryCreateLLM();
    info("\nSubmitting attempt; deterministic verification is separate from qualitative review.");
    const result = await submitCodingSolution(llm, db, state, code);
    const formattedResult = formatCodingResult(result);

    if (result.verificationOutput || result.qualitativeFeedback) {
      recordExposure(db, state.sessionId, {
        objectiveIds: [result.objectiveId],
        attemptId: result.attemptId,
        exposureType: "corrective_feedback_shown",
        sourceRef: "coding-post-submission-feedback",
        teachingMaterial: { content: formattedResult, format: "text" },
      });
      if (result.qualitativeFeedback?.optimalSolution) {
        recordExposure(db, state.sessionId, {
          objectiveIds: [result.objectiveId],
          attemptId: result.attemptId,
          exposureType: "solution_walkthrough",
          sourceRef: "coding-suggested-approach",
          teachingMaterial: {
            content: result.qualitativeFeedback.optimalSolution,
            format: "text",
          },
        });
      }
    }

    console.log(formattedResult);
    if (result.assessmentStatus === "recorded") {
      completeSessionFeedback(db, state.sessionId);
    } else {
      finishSessionInteraction(db, state.sessionId);
    }
  } catch (err) {
    error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

async function runDesignDrill(
  db: ReturnType<typeof createDatabase>,
  conceptId: string,
  difficulty?: number,
): Promise<void> {
  try {
    const state = startDesignDrill(db, { conceptId, difficulty });
    const rl = createPrompt();

    header(`System Design: ${state.problem.title}`);
    console.log(`Difficulty: ${state.problem.difficulty}/5`);
    console.log(`Tags: ${state.problem.tags.join(", ") || "none"}`);
    console.log();
    console.log(state.problem.description);
    console.log();

    let currentState = state;

    while (currentState.currentPhase !== "complete") {
      const prompt = getPhasePrompt(currentState);
      console.log(chalk.bold.underline(`\nPhase: ${prompt.phase}`));
      console.log(prompt.prompt);
      console.log();

      warn("Enter your response (type END on a blank line to finish):\n");
      const lines: string[] = [];
      let line: string;
      while ((line = await ask(rl, "")) !== "END") {
        lines.push(line);
      }

      const response = lines.join("\n");
      currentState = submitPhase(db, currentState, response);
      success(`  Phase "${prompt.phase}" recorded.`);
    }

    rl.close();

    const llm = tryCreateLLM();
    info("\nAttempt submitted; assessing the frozen rubric when a trusted evaluator is available.");
    const result = await assessDesignDrill(llm, db, currentState);
    const formattedResult = formatDesignResult(result);
    if (result.assessmentStatus === "recorded" && (result.criteria.length > 0 || result.feedback)) {
      recordExposure(db, currentState.sessionId, {
        objectiveIds: [result.objectiveId],
        attemptId: result.attemptId,
        exposureType: "corrective_feedback_shown",
        sourceRef: "system-design-rubric-feedback",
        teachingMaterial: { content: formattedResult, format: "text" },
      });
    }
    console.log(formattedResult);
    if (result.assessmentStatus === "recorded") {
      completeSessionFeedback(db, currentState.sessionId);
    } else {
      finishSessionInteraction(db, currentState.sessionId);
    }
  } catch (err) {
    error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

// ─── Commands ────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name("tutor")
  .description("AI tutor with spaced repetition, interview prep, and ecosystem integration")
  .version("0.1.0")
  .option("--profile <id>", "Use a learner profile for this command");

const profileCommand = program.command("profile").description("Manage learner profiles");

profileCommand
  .command("create")
  .description("Create and select a fresh learner profile")
  .argument("<name>", "Learner-facing display name")
  .option("--id <id>", "Filesystem-safe profile ID (derived from name by default)")
  .option("-d, --description <text>", "Short profile label or description")
  .action((name: string, opts: { id?: string; description?: string }) => {
    try {
      const profile = createProfile(
        { displayName: name, id: opts.id, description: opts.description },
        profileStoreOptions(),
      );
      selectProfile(profile.id, profileStoreOptions());
      success(`Created and selected profile ${profile.id} (${profile.displayName}).`);
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

profileCommand
  .command("list")
  .description("List local learner profiles")
  .action(() => {
    try {
      const profiles = listProfiles(profileStoreOptions());
      const active = getActiveProfile(profileStoreOptions());
      if (profiles.length === 0) {
        warn("No learner profiles exist yet. Create one with `tutor profile create <name>`.");
        return;
      }
      header("Learner Profiles");
      for (const profile of profiles) {
        const marker = profile.id === active?.id ? "*" : " ";
        const source = profile.source === "legacy" ? " [legacy]" : "";
        console.log(`${marker} ${profile.id.padEnd(20)} ${profile.displayName}${source}`);
      }
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

profileCommand
  .command("use")
  .description("Select the learner profile used by ordinary tutor commands")
  .argument("<id>", "Profile ID")
  .action((id: string) => {
    try {
      const profile = selectProfile(id, profileStoreOptions());
      success(`Selected profile ${profile.id} (${profile.displayName}).`);
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

profileCommand
  .command("show")
  .description("Show the selected learner profile")
  .argument("[id]", "Profile ID (defaults to selected profile)")
  .action((id?: string) => {
    try {
      const requestedId = id ?? cliProfileOverride();
      const profile = requestedId
        ? getProfile(requestedId, profileStoreOptions())
        : getActiveProfile(profileStoreOptions());
      if (!profile) {
        throw new Error(
          requestedId
            ? `Profile not found: ${requestedId}`
            : "No learner profile is selected.",
        );
      }
      header("Learner Profile");
      console.log(`  ID:          ${profile.id}`);
      console.log(`  Name:        ${profile.displayName}`);
      console.log(`  Created:     ${profile.createdAt}`);
      console.log(`  Source:      ${profile.source}`);
      console.log(`  Description: ${profile.description ?? "(none)"}`);
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

program
  .command("onboard")
  .description("Run structured offline onboarding and create a profile only after confirmation")
  .action(async () => {
    try {
      await runOfflineOnboarding({
        dataDir: PROFILE_DATA_DIR,
        knowledgeRoot: KNOWLEDGE_DIR,
      });
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

// tutor <topic> — auto-detect mode
program
  .argument("<topic>", "Topic to study (auto-detects session vs ingestion)")
  .option(
    "-m, --mode <mode>",
    "Session delivery context: learn, practice, review (legacy: explore, quiz, teach-back)",
    "learn",
  )
  .action(async (topic: string, opts: { mode: string }) => {
    const db = openCliDatabase();

    try {
      const topicId = topic.toLowerCase().replace(/\s+/g, "-");

      if (topicExists(db, topicId) && topicHasConcepts(db, topicId)) {
        // Normalize legacy spelling only at the CLI boundary.
        const mode = normalizeSessionDeliveryContext(opts.mode);
        await runSession(db, topicId, mode);
      } else {
        // Ingestion mode
        warn(`Topic "${topicId}" has no concepts yet. Entering ingestion mode.\n`);
        await runIngestion(db, topicId, "manual");
        // After ingestion, start a session
        if (topicHasConcepts(db, topicId)) {
          await runSession(db, topicId, "learn");
        }
      }
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    } finally {
      db.close();
    }
  });

// tutor ingest <topic>
program
  .command("ingest")
  .description("Run ingestion pipeline for a topic")
  .argument("<topic>", "Topic to ingest concepts for")
  .option("-f, --from <source>", "Source: job-hunter, ai-feeds, manual", "manual")
  .option("--material <text>", "Raw material text (for manual source)")
  .action(
    async (
      topic: string,
      opts: { from: string; material?: string },
    ) => {
      const db = openCliDatabase();

      try {
        const topicId = topic.toLowerCase().replace(/\s+/g, "-");
        const sourceType = opts.from as "job-hunter" | "ai-feeds" | "manual";
        await runIngestion(db, topicId, sourceType, opts.material);
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      } finally {
        db.close();
      }
    },
  );

// tutor init <topic> <manifest-path>
program
  .command("init")
  .description("Initialize a topic from a manifest JSON file")
  .argument("<topic>", "Topic ID (e.g., kubernetes)")
  .argument("<manifest-path>", "Path to manifest JSON file")
  .action(async (topicArg: string, manifestPath: string) => {
    const db = openCliDatabase();

    try {
      const topicId = topicArg.toLowerCase().replace(/\s+/g, "-");
      const resolvedPath = resolve(manifestPath);
      initializeTopic(db, topicId, resolvedPath);
      const topicRow = getTopic(db, topicId);
      const concepts = getConceptsByTopic(db, topicId);
      success(
        `Initialized topic "${topicRow?.name ?? topicId}" with ${concepts.length} concept(s).`,
      );
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    } finally {
      db.close();
    }
  });

// tutor gaps
program
  .command("gaps")
  .description("Show skill gaps from job-hunter")
  .option("-j, --job-id <id>", "Scope to a specific job listing")
  .option("-n, --top <n>", "Show top N gaps", "20")
  .action(async (opts: { jobId?: string; top: string }) => {
    const db = openCliDatabase();

    try {
      let jhDb: ReturnType<typeof openJobHunterDb>;
      try {
        jhDb = openJobHunterDb(JOB_HUNTER_DB_PATH);
      } catch {
        error(`Could not open job-hunter DB at ${JOB_HUNTER_DB_PATH}`);
        process.exitCode = 1;
        return;
      }

      const gaps = getSkillGaps(jhDb, opts.jobId);
      jhDb.close();

      if (gaps.length === 0) {
        warn("No skill gaps found.");
        return;
      }

      const topN = parseInt(opts.top, 10) || 20;
      const displayed = gaps.slice(0, topN);

      header("Skill Gaps");
      console.log(
        chalk.bold(
          "  " +
            "Skill".padEnd(30) +
            "Frequency".padEnd(12) +
            "Resources",
        ),
      );
      console.log("  " + "-".repeat(60));

      for (const gap of displayed) {
        console.log(
          `  ${gap.skill.padEnd(30)}${String(gap.frequency).padEnd(12)}${gap.resources.length}`,
        );
      }

      if (gaps.length > topN) {
        console.log(chalk.dim(`\n  ... and ${gaps.length - topN} more`));
      }
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    } finally {
      db.close();
    }
  });

// tutor interview <concept-id>
program
  .command("interview")
  .description("Start an interview drill")
  .argument("<concept-id>", "Concept ID to interview")
  .option("-t, --type <type>", "Interview type: coding or system-design", "coding")
  .option("-d, --difficulty <n>", "Difficulty level (1-5)")
  .action(async (conceptId: string, opts: { type: string; difficulty?: string }) => {
    const db = openCliDatabase();

    try {
      const difficulty = opts.difficulty ? parseInt(opts.difficulty, 10) : undefined;

      if (opts.type === "system-design") {
        await runDesignDrill(db, conceptId, difficulty);
      } else {
        await runCodingDrill(db, conceptId, difficulty);
      }
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    } finally {
      db.close();
    }
  });

// tutor goal <topic> [objective]
program
  .command("goal")
  .description("Configure or list objective requirements for a topic-backed goal")
  .argument("<topic>", "Goal/topic ID")
  .argument("[objective]", "Learning objective ID to configure")
  .option("--importance <level>", "Importance: core, important, supporting")
  .option("--target <readiness>", "Target readiness: guided or independent")
  .option("--transfer", "Require demonstrated transfer")
  .option("--durability", "Require demonstrated delayed retrieval")
  .option("--inactive", "Keep the objective configured but inactive")
  .action(
    async (
      topic: string,
      objective: string | undefined,
      opts: {
        importance?: string;
        target?: string;
        transfer?: boolean;
        durability?: boolean;
        inactive?: boolean;
      },
    ) => {
      const db = openCliDatabase();
      try {
        const goalId = topic.toLowerCase().replace(/\s+/g, "-");
        const topicRow = getTopic(db, goalId);
        if (!topicRow) {
          throw new Error(`Goal topic not found: ${goalId}`);
        }

        if (objective) {
          const importance = opts.importance === undefined
            ? undefined
            : GoalImportance.parse(opts.importance);
          const targetReadiness = opts.target === undefined
            ? undefined
            : GoalTargetReadiness.parse(opts.target);
          const configured = setGoalObjective(db, {
            goalId,
            objectiveId: objective,
            isActive: !opts.inactive,
            importance,
            targetReadiness,
            requireTransfer: opts.transfer === true,
            requireDurability: opts.durability === true,
          });
          success(
            `${configured.objective_id} → ${configured.importance}, target ${configured.target_readiness}` +
              `${configured.require_transfer ? ", transfer" : ""}` +
              `${configured.require_durability ? ", durability" : ""}` +
              `${configured.is_active ? "" : ", inactive"}`,
          );
          return;
        }

        header(`Goal: ${topicRow.name}`);
        console.log(`  Goal ID:  ${topicRow.id}`);
        console.log(`  Goal:     ${topicRow.goal ?? "(not set)"}`);
        console.log(`  Deadline: ${topicRow.deadline ?? "(none)"}`);

        const configured = getGoalObjectives(db, goalId, { includeInactive: true });
        if (configured.length > 0) {
          console.log();
          console.log(chalk.bold("  Configured objectives:"));
          for (const item of configured) {
            console.log(
              `  ${item.objective_id}  ${item.importance}/${item.target_readiness}` +
                `${item.require_transfer ? " transfer" : ""}` +
                `${item.require_durability ? " durability" : ""}` +
                `${item.is_active ? "" : " inactive"}`,
            );
          }
        } else {
          warn("\n  No goal objectives configured yet.");
        }

        const available = db
          .prepare(
            `SELECT objective.id, objective.capability_id, concept.title
             FROM learning_objectives objective
             JOIN concepts concept ON concept.id = objective.concept_id
             WHERE concept.topic_id = ?
             ORDER BY concept.title, objective.capability_id`,
          )
          .all(goalId) as Array<{ id: string; capability_id: string; title: string }>;
        if (available.length > 0) {
          console.log();
          console.log(chalk.bold("  Topic-local objectives:"));
          for (const item of available) {
            console.log(`  ${item.id}  ${item.capability_id}  ${item.title}`);
          }
        } else {
          warn("\n  No learning objectives exist yet; run learning/interview work first.");
        }
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      } finally {
        db.close();
      }
    },
  );

// tutor today <topic>
program
  .command("today")
  .description("Build today's bounded evidence-driven mission for a topic-backed goal")
  .argument("<topic>", "Goal/topic ID")
  .option("-m, --minutes <n>", "Available minutes")
  .option("--context <context>", "Override the main delivery context")
  .option("--transfer-context <context>", "Override the transfer delivery context")
  .option(
    "--retest <weakness-key>",
    "Make a resolved weakness eligible for retest today (repeatable)",
    (value: string, previous: string[]) => [...previous, value],
    [] as string[],
  )
  .action(
    async (
      topic: string,
      opts: {
        minutes?: string;
        context?: string;
        transferContext?: string;
        retest: string[];
      },
    ) => {
      const db = openCliDatabase();
      try {
        const goalId = topic.toLowerCase().replace(/\s+/g, "-");
        const topicRow = getTopic(db, goalId);
        if (!topicRow) {
          throw new Error(`Goal topic not found: ${goalId}`);
        }
        const explicitMinutes = opts.minutes
          ? Number.parseInt(opts.minutes, 10)
          : undefined;
        const configuredMinutes = resolveTodayAvailableMinutes(
          db,
          goalId,
          explicitMinutes,
          loadConfig().daily_minutes,
        );
        const mainContext = opts.context === undefined
          ? undefined
          : DeliveryContext.parse(opts.context);
        const transferContext = opts.transferContext === undefined
          ? undefined
          : DeliveryContext.parse(opts.transferContext);
        const mission = getTodayMission(db, {
          goalId,
          availableMinutes: configuredMinutes,
          now: new Date().toISOString(),
          mainDeliveryContext: mainContext,
          transferDeliveryContext: transferContext,
          retestEligibleWeaknessKeys: opts.retest,
        });

        header(`Today: ${topicRow.name}`);
        if (mission.goal) console.log(`  Goal: ${mission.goal}`);
        if (mission.deadlineAt) console.log(`  Deadline: ${mission.deadlineAt}`);
        console.log(
          `  Planned: ${mission.plannedMinutes}/${mission.availableMinutes} min` +
            (mission.unallocatedMinutes > 0
              ? ` (${mission.unallocatedMinutes} min intentionally unallocated)`
              : ""),
        );

        if (mission.items.length === 0) {
          const active = getGoalObjectives(db, goalId);
          if (active.length === 0) {
            warn(
              "\n  No active goal objectives. Configure one with `tutor goal <topic> <objective>`.",
            );
          } else if (mission.blocked.length > 0) {
            warn("\n  No eligible mission item; active objectives are prerequisite-blocked.");
          } else {
            success("\n  No actionable goal work is due or currently below target.");
          }
        } else {
          console.log();
          mission.items.forEach((item, index) => {
            const label = item.kind.toUpperCase().padEnd(9);
            console.log(
              chalk.bold(
                `  ${index + 1}. ${label} ${String(item.minutes).padStart(2)}m  ${item.objectiveId}`,
              ),
            );
            console.log(
              chalk.dim(
                `     ${item.intent.capabilityId} / ${item.intent.taskForm} / ` +
                  `${item.intent.deliveryContext} / ${item.intent.novelty}`,
              ),
            );
            console.log(`     ${item.reason}`);
            if (item.intent.requiresChangedSurface) {
              console.log(chalk.dim("     Requires a materially changed surface before freezing."));
            }
          });
        }

        if (mission.blocked.length > 0) {
          console.log();
          console.log(chalk.bold("  Blocked candidates:"));
          for (const item of mission.blocked) {
            console.log(`  ${item.objectiveId}: ${item.blockers.join("; ")}`);
          }
        }
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      } finally {
        db.close();
      }
    },
  );

// tutor due
program
  .command("due")
  .description("Show learning objectives due for review")
  .option("-t, --topic <topic>", "Filter by topic")
  .action(async (opts: { topic?: string }) => {
    const db = openCliDatabase();

    try {
      const topicId = opts.topic?.toLowerCase().replace(/\s+/g, "-");
      const due = getDueObjectives(db, { topicId });

      if (due.length === 0) {
        success("No learning objectives are due for review. You're all caught up!");
        return;
      }

      header(`Due Objectives (${due.length})`);
      console.log(
        chalk.bold(
          "  " +
            "Objective".padEnd(42) +
            "Concept".padEnd(28) +
            "Capability".padEnd(14) +
            "Due",
        ),
      );
      console.log("  " + "-".repeat(110));

      for (const item of due) {
        console.log(
          `  ${item.objectiveId.padEnd(42)}${item.conceptTitle.slice(0, 26).padEnd(28)}${item.capabilityId.padEnd(14)}${item.dueAt}`,
        );
      }
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    } finally {
      db.close();
    }
  });

// tutor stats
program
  .command("stats")
  .description("Show topic statistics")
  .option("-t, --topic <topic>", "Topic to show stats for")
  .action(async (opts: { topic?: string }) => {
    const db = openCliDatabase();

    try {
      if (opts.topic) {
        const topicId = opts.topic.toLowerCase().replace(/\s+/g, "-");
        const summary = getTopicSummary(db, topicId);

        header(`Topic: ${summary.topic}`);
        console.log(`  Concepts:   ${summary.totalConcepts}`);
        console.log(`  Objectives: ${summary.totalObjectives}`);
        console.log();
        console.log("  Objective readiness:");
        console.log(`    Unknown:     ${chalk.dim(String(summary.unknown))}`);
        console.log(`    Exposed:     ${chalk.yellow(String(summary.exposed))}`);
        console.log(`    Guided:      ${chalk.cyan(String(summary.guided))}`);
        console.log(`    Independent: ${chalk.green(String(summary.independent))}`);
        console.log();
        console.log(`  Due for review:   ${chalk.bold(String(summary.dueCount))}`);
        console.log(`  Overdue:          ${chalk.red(String(summary.overdueCount))}`);
        if (summary.lastSession) {
          console.log(`  Last session:     ${summary.lastSession}`);
        }
      } else {
        // Show all topics
        const topics = listTopics(db);

        if (topics.length === 0) {
          warn("No topics found. Run `tutor ingest <topic>` to get started.");
          return;
        }

        header("All Topics");
        console.log(
          chalk.bold(
            "  " +
              "Topic".padEnd(25) +
              "Concepts".padEnd(10) +
              "Objectives".padEnd(12) +
              "Due".padEnd(6) +
              "Last Session",
          ),
        );
        console.log("  " + "-".repeat(70));

        for (const t of topics) {
          const summary = getTopicSummary(db, t.id);
          console.log(
            `  ${summary.topic.padEnd(25)}${String(summary.totalConcepts).padEnd(10)}${String(summary.totalObjectives).padEnd(12)}${String(summary.dueCount).padEnd(6)}${summary.lastSession ?? "never"}`,
          );
        }
      }
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    } finally {
      db.close();
    }
  });

// tutor sync
program
  .command("sync")
  .description("Sync gaps from job-hunter, signals from ai-feeds, or export to Anki/Obsidian")
  .option("-t, --topic <topic>", "Topic to export (required for anki/obsidian)")
  .option("--anki <path>", "Export to Anki TSV format at the given path")
  .option("--obsidian <vault>", "Sync to Obsidian vault at the given path")
  .action(async (opts: { topic?: string; anki?: string; obsidian?: string }) => {
    const db = openCliDatabase();

    try {
      // Anki export
      if (opts.anki) {
        if (!opts.topic) {
          error("--topic is required for Anki export.");
          process.exitCode = 1;
          return;
        }
        const topicId = opts.topic.toLowerCase().replace(/\s+/g, "-");
        const count = await exportToAnki({
          db,
          topicId,
          outputPath: resolve(opts.anki),
        });
        success(`Exported ${count} card(s) to ${opts.anki}`);
        return;
      }

      // Obsidian sync
      if (opts.obsidian) {
        if (!opts.topic) {
          error("--topic is required for Obsidian sync.");
          process.exitCode = 1;
          return;
        }
        const topicId = opts.topic.toLowerCase().replace(/\s+/g, "-");
        const result = await syncToObsidian({
          db,
          topicId,
          vaultPath: resolve(opts.obsidian),
        });
        success(
          `Synced ${result.synced} concept(s) and ${result.revisionNotesSynced} revision note(s) to ${result.outputPath}`,
        );
        return;
      }

      // Default: sync gaps and signals
      info("Syncing skill gaps from job-hunter...");
      const gapCount = await syncGaps(db, JOB_HUNTER_DB_PATH);
      success(`  Synced ${gapCount} skill gap(s).`);

      info("Syncing signals from ai-feeds...");
      const signalCount = await syncSignals(db, AI_FEEDS_DB_PATH);
      success(`  Synced ${signalCount} signal(s).`);

      console.log();
      success(`Total: ${gapCount} gaps, ${signalCount} signals synced.`);
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    } finally {
      db.close();
    }
  });

// tutor search
program
  .command("search")
  .description("Search for concepts by query")
  .argument("<query>", "Search query")
  .option("-t, --topic <topic>", "Scope to a specific topic")
  .action(async (query: string, opts: { topic?: string }) => {
    const db = openCliDatabase();

    try {
      if (!opts.topic) {
        error("--topic is required for search.");
        process.exitCode = 1;
        return;
      }

      const topicId = opts.topic.toLowerCase().replace(/\s+/g, "-");
      const results = searchConcepts(db, topicId, query);

      if (results.length === 0) {
        warn(`No concepts found matching "${query}".`);
        return;
      }

      header(`Search Results (${results.length})`);
      for (const r of results) {
        console.log(
          `  ${chalk.bold(r.title)} ${chalk.dim(`(${r.matchReason}, score: ${r.score.toFixed(1)})`)}`,
        );
        console.log(chalk.dim(`    ID: ${r.conceptId}`));
      }
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    } finally {
      db.close();
    }
  });

// ─── Parse and run ───────────────────────────────────────────────────────────

program.parseAsync().catch((err: unknown) => {
  error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
