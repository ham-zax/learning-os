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
 *   tutor due                  Show due concepts
 *   tutor stats                Show topic summary
 *   tutor plan <topic>         Generate learning plan
 *   tutor sync                 Sync gaps and signals
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { Command } from "commander";
import chalk from "chalk";

import { createDatabase } from "./db/database.js";
import {
  getTopicSummary,
  initializeTopic,
  getDueConcepts as getDueConceptsFromState,
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
import { generateLearningPlan } from "./plan/planner.js";
import { generateEnhancedPlan } from "./plan/nexus-planner.js";
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
  gradeDesignDrill,
  formatDesignResult,
} from "./interview/system-design.js";
import {
  getTopic,
  getConceptsByTopic,
  createTopic,
  listTopics,
} from "./db/database.js";
import { openAttempt, recordExposure, submitAttempt } from "./kernel/foundation.js";

import {
  loadConcept,
  sectionText,
  extraSectionHeadings,
} from "./knowledge/loader.js";
import { generateExploreSequence } from "./session/modes/explore.js";
import { generateTeachBackSession } from "./session/modes/teach-back.js";
import { generateQuizBatch } from "./session/modes/quiz.js";

import type { ConceptMap, ConceptProposal, ConceptFile } from "./knowledge/types.js";
import type { DeliveryContext } from "./db/types.js";

// ─── Config ──────────────────────────────────────────────────────────────────

const DB_PATH = resolve("./data/tutor.db");
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

type MaterialRevealRecorder = (sourceRef: string) => void;

function revealWithExposure(
  label: string,
  content: string,
  sourceRef: string,
  recordMaterialExposure: MaterialRevealRecorder,
): void {
  if (!content.trim()) return;
  recordMaterialExposure(sourceRef);
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
    recordMaterialExposure(`section:${heading}`);
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
    console.log(
      chalk.dim(`  Difficulty: ${concept.difficulty}/5 | Legacy status: ${concept.status}`),
    );

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

    const recordLearnExposure: MaterialRevealRecorder = (sourceRef) => {
      recordExposure(db, sessionState.sessionId, {
        attemptId: opened.attempt.id,
        objectiveIds: [prepared.objectiveId],
        exposureType: "explanation_shown",
        sourceRef,
      });
    };
    const recordPostResponseExposure: MaterialRevealRecorder = (sourceRef) => {
      recordExposure(db, sessionState.sessionId, {
        attemptId: opened.attempt.id,
        objectiveIds: [prepared.objectiveId],
        exposureType: "answer_revealed",
        sourceRef,
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
  console.log(`  Duration: ${Math.floor(summary.duration / 60)}m ${summary.duration % 60}s`);

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
  difficulty?: number,
): Promise<void> {
  try {
    const state = startCodingDrill(db, { difficulty });
    const { problem } = state;

    header(`Coding Problem: ${problem.title}`);
    console.log(`Difficulty: ${problem.difficulty}/5`);
    console.log(`Tags: ${problem.tags.join(", ") || "none"}`);
    console.log(`Time limit: ${Math.round(state.timeLimitMs / 60000)} minutes`);
    console.log();
    console.log(problem.description);
    console.log();

    if (problem.testCases.length > 0) {
      info("Test cases:");
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
      warn("Empty submission — skipping grading.");
      return;
    }

    info("\nGrading...");

    const llm = tryCreateLLM();
    if (!llm) {
      warn("LLM provider is not configured in this Phase 0 baseline — skipping grading.");
      console.log(chalk.dim(`Problem ID: ${problem.id}`));
      rl.close();
      return;
    }

    const result = await submitCodingSolution(llm, db, state, code);
    console.log(formatCodingResult(result));
    rl.close();
  } catch (err) {
    error(err instanceof Error ? err.message : String(err));
  }
}

async function runDesignDrill(
  db: ReturnType<typeof createDatabase>,
  difficulty?: number,
): Promise<void> {
  try {
    const state = startDesignDrill(db, { difficulty });
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
      if (prompt.followUp) {
        console.log(chalk.dim(`  Hint: ${prompt.followUp}`));
      }
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

    info("\nGrading all phases...");
    const llm = tryCreateLLM();
    if (!llm) {
      warn("LLM provider is not configured in this Phase 0 baseline — skipping grading.");
      console.log(chalk.dim(`Problem ID: ${state.problem.id}`));
      return;
    }

    const result = await gradeDesignDrill(llm, db, currentState);
    console.log(formatDesignResult(result));
  } catch (err) {
    error(err instanceof Error ? err.message : String(err));
  }
}

// ─── Commands ────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name("tutor")
  .description("AI tutor with spaced repetition, interview prep, and ecosystem integration")
  .version("0.1.0");

// tutor <topic> — auto-detect mode
program
  .argument("<topic>", "Topic to study (auto-detects session vs ingestion)")
  .option(
    "-m, --mode <mode>",
    "Session delivery context: learn, practice, review (legacy: explore, quiz, teach-back)",
    "learn",
  )
  .action(async (topic: string, opts: { mode: string }) => {
    const db = createDatabase(DB_PATH);

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
      const db = createDatabase(DB_PATH);

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
    const db = createDatabase(DB_PATH);

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
    const db = createDatabase(DB_PATH);

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

// tutor interview <topic>
program
  .command("interview")
  .description("Start an interview drill")
  .argument("<topic>", "Topic or problem category")
  .option("-t, --type <type>", "Interview type: coding or system-design", "coding")
  .option("-d, --difficulty <n>", "Difficulty level (1-5)")
  .action(async (_topic: string, opts: { type: string; difficulty?: string }) => {
    const db = createDatabase(DB_PATH);

    try {
      const difficulty = opts.difficulty ? parseInt(opts.difficulty, 10) : undefined;

      if (opts.type === "system-design") {
        await runDesignDrill(db, difficulty);
      } else {
        await runCodingDrill(db, difficulty);
      }
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    } finally {
      db.close();
    }
  });

// tutor due
program
  .command("due")
  .description("Show concepts due for review")
  .option("-t, --topic <topic>", "Filter by topic")
  .action(async (opts: { topic?: string }) => {
    const db = createDatabase(DB_PATH);

    try {
      const topicId = opts.topic?.toLowerCase().replace(/\s+/g, "-");
      const due = getDueConceptsFromState(db, topicId);

      if (due.length === 0) {
        success("No concepts due for review. You're all caught up!");
        return;
      }

      header(`Due Concepts (${due.length})`);
      console.log(
        chalk.bold(
          "  " +
            "ID".padEnd(35) +
            "Title".padEnd(30) +
            "Status".padEnd(12) +
            "Next Review",
        ),
      );
      console.log("  " + "-".repeat(90));

      for (const c of due) {
        console.log(
          `  ${c.id.padEnd(35)}${c.title.slice(0, 28).padEnd(30)}${c.status.padEnd(12)}${c.next_review ?? "new"}`,
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
    const db = createDatabase(DB_PATH);

    try {
      if (opts.topic) {
        const topicId = opts.topic.toLowerCase().replace(/\s+/g, "-");
        const summary = getTopicSummary(db, topicId);

        header(`Topic: ${summary.topic}`);
        console.log(`  Phase:    ${summary.phase}/5`);
        console.log(`  Total:    ${summary.total} concepts`);
        console.log();
        console.log("  Status breakdown:");
        console.log(`    Unseen:    ${chalk.dim(String(summary.unseen))}`);
        console.log(`    Learning:  ${chalk.yellow(String(summary.learning))}`);
        console.log(`    Reviewing: ${chalk.cyan(String(summary.reviewing))}`);
        console.log(`    Mastered:  ${chalk.green(String(summary.mastered))}`);
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
              "Phase".padEnd(8) +
              "Concepts".padEnd(10) +
              "Due".padEnd(6) +
              "Last Session",
          ),
        );
        console.log("  " + "-".repeat(70));

        for (const t of topics) {
          const summary = getTopicSummary(db, t.id);
          console.log(
            `  ${summary.topic.padEnd(25)}${String(summary.phase).padEnd(8)}${String(summary.total).padEnd(10)}${String(summary.dueCount).padEnd(6)}${summary.lastSession ?? "never"}`,
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

// tutor plan <topic>
program
  .command("plan")
  .description("Generate a learning plan for a topic")
  .argument("<topic>", "Topic to plan")
  .requiredOption("-g, --goal <text>", "Learning goal")
  .option("--deadline <date>", "Deadline (YYYY-MM-DD)")
  .action(async (topic: string, opts: { goal: string; deadline?: string }) => {
    const db = createDatabase(DB_PATH);

    try {
      const topicId = topic.toLowerCase().replace(/\s+/g, "-");

      if (!topicExists(db, topicId)) {
        error(`Topic "${topicId}" not found. Run ingestion first.`);
        process.exitCode = 1;
        return;
      }

      const config = loadConfig();
      const llm = tryCreateLLM();

      const result = await generateEnhancedPlan({
        db,
        topicId,
        goal: opts.goal,
        deadline: opts.deadline,
        dailyMinutes: config.daily_minutes,
        llmClient: llm,
      });

      const plan = result.plan;

      header(`Learning Plan: ${plan.topic}`);
      console.log(`Goal: ${plan.goal}`);
      if (plan.deadline) {
        console.log(`Deadline: ${plan.deadline}`);
      }
      console.log(`Sessions: ${plan.sessions.length}`);

      if (result.rationale) {
        console.log();
        info(`Strategy: ${result.rationale}`);
      }
      if (result.focusAreas.length > 0) {
        info(`Focus areas: ${result.focusAreas.join(", ")}`);
      }
      console.log();

      for (const session of plan.sessions) {
        const dateStr = session.targetDate ? session.targetDate : "flexible";
        console.log(
          chalk.bold(
            `  Session ${session.sessionNumber}`.padEnd(18) +
              `${session.mode}`.padEnd(14) +
              `${session.estimatedMinutes}min`.padEnd(10) +
              dateStr,
          ),
        );
        console.log(chalk.dim(`    Concepts: ${session.conceptIds.join(", ")}`));
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
    const db = createDatabase(DB_PATH);

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
        success(`Synced ${result.synced} concept(s) to ${result.outputPath}`);
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
    const db = createDatabase(DB_PATH);

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

program.parse();
