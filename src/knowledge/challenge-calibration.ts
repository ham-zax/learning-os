import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { ChallengeSpecSchema } from "../db/types.js";
import type { ChallengeSpec } from "../db/types.js";
import { ChallengeIntentSchema } from "../selection/types.js";
import type { ChallengeIntent } from "../selection/types.js";
import { codingCourseFile } from "./courses.js";

/**
 * Calibrated packs are discovered from `knowledge/<course>/challenges/<pack>/calibration.json`,
 * so adding a pack is a content change. A pack ID is its directory name; the first packs keep
 * their original short IDs as aliases.
 */
const PACK_ALIASES: Record<string, string> = {
  "async-predict": "js-async-await-predict",
  "transaction-predict": "database-transactions-predict",
  "idempotency-predict": "retries-idempotency-predict",
};

export type CalibratedPredictionPackId = string;

interface PackLocation {
  id: CalibratedPredictionPackId;
  course: string;
  directory: string;
}

/** Lists every calibrated prediction pack under the knowledge root. */
function isDraftPack(file: string): boolean {
  try {
    return (JSON.parse(readFileSync(file, "utf8")) as { draft?: unknown }).draft === true;
  } catch {
    return false;
  }
}

/** Lists every published (non-draft) calibrated prediction pack under the knowledge root. */
export function listCalibratedPredictionPacks(knowledgeRoot: string): PackLocation[] {
  const packs: PackLocation[] = [];
  for (const course of readdirSync(knowledgeRoot, { withFileTypes: true })) {
    if (!course.isDirectory()) continue;
    const challenges = join(knowledgeRoot, course.name, "challenges");
    if (!existsSync(challenges)) continue;
    for (const pack of readdirSync(challenges, { withFileTypes: true })) {
      const file = join(challenges, pack.name, "calibration.json");
      if (!pack.isDirectory() || !existsSync(file) || isDraftPack(file)) continue;
      packs.push({ id: pack.name, course: course.name, directory: `challenges/${pack.name}` });
    }
  }
  const ids = packs.map((pack) => pack.id);
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate) throw new Error(`Calibrated pack ID is not unique across courses: ${duplicate}`);
  return packs.sort((a, b) => a.id.localeCompare(b.id));
}

export function resolveCalibratedPredictionPack(
  knowledgeRoot: string,
  packId: CalibratedPredictionPackId,
): PackLocation {
  const id = PACK_ALIASES[packId] ?? packId;
  const pack = listCalibratedPredictionPacks(knowledgeRoot).find((candidate) => candidate.id === id);
  if (!pack) throw new Error(`Unknown calibrated prediction pack: ${packId}`);
  return { ...pack, id: packId };
}

export interface CalibratedPredictionCaseRef {
  packId: CalibratedPredictionPackId;
  caseId: string;
}

const CriterionSchema = z.object({
  id: z.string().min(1),
  required: z.boolean(),
  description: z.string().min(1),
}).strict();

const WrongModelSchema = z.object({
  claim: z.string().min(1),
  predictedOutput: z.array(z.string()).min(1).optional(),
  predictedFinal: z.string().min(1).optional(),
  predictedFirstUpdate: z.string().min(1).optional(),
}).strict().refine((model) => model.predictedOutput || model.predictedFinal || model.predictedFirstUpdate,
  "A wrong model needs an observable contrasting prediction");

export const PredictionCalibrationSchema = z.object({
  /** Set by `npm run pack:new`; a draft pack is never offered to a teacher or executed by tests. */
  draft: z.boolean().optional(),
  objective: z.object({
    conceptId: z.string().min(1),
    capabilityId: z.literal("predict"),
    taskForm: z.literal("runtime_trace"),
  }).strict(),
  environment: z.string().min(1),
  cases: z.array(z.object({
    id: z.string().min(1),
    novelty: z.enum(["same", "variant", "transfer"]),
    surface: z.string().min(1),
    source: z.string().regex(/^[a-z0-9-]+\.mjs$/),
    question: z.string().min(1),
    criteria: z.array(CriterionSchema).min(1),
    expectedOutput: z.array(z.string()).min(1),
    wrongModels: z.array(WrongModelSchema).min(1),
  }).strict()).min(1),
}).strict();

export type PredictionCalibration = z.infer<typeof PredictionCalibrationSchema>;
export type PredictionCase = PredictionCalibration["cases"][number];
export const AsyncPredictCalibrationSchema = PredictionCalibrationSchema;
export type AsyncPredictCalibration = PredictionCalibration;
export type AsyncPredictCase = PredictionCase;

export function loadCalibratedPredictionPack(
  knowledgeRoot: string,
  packId: CalibratedPredictionPackId,
): PredictionCalibration {
  const config = resolveCalibratedPredictionPack(knowledgeRoot, packId);
  const courseDirectory = join(knowledgeRoot, config.course);
  const file = codingCourseFile(courseDirectory, `${config.directory}/calibration.json`);
  const pack = PredictionCalibrationSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  const caseIds = pack.cases.map((item) => item.id);
  if (new Set(caseIds).size !== caseIds.length) throw new Error(`Duplicate calibration case ID in ${packId}`);
  if (pack.cases.map((item) => item.novelty).sort().join(",") !== "same,transfer,variant") {
    throw new Error(`Calibrated pack ${packId} needs one same, variant, and transfer case`);
  }
  for (const item of pack.cases) {
    const criterionIds = item.criteria.map((criterion) => criterion.id);
    if (new Set(criterionIds).size !== criterionIds.length) {
      throw new Error(`Duplicate criterion in calibrated case ${item.id}`);
    }
    codingCourseFile(courseDirectory, `${config.directory}/${item.source}`);
  }
  return pack;
}

export function loadAsyncPredictCalibration(knowledgeRoot: string): PredictionCalibration {
  return loadCalibratedPredictionPack(knowledgeRoot, "async-predict");
}

/** Find a matching authored case while respecting recent frozen code surfaces. */
export function findCalibratedPredictionCase(
  knowledgeRoot: string,
  selectedIntent: ChallengeIntent,
  getChallenge: (challengeId: string, version: number) => ChallengeSpec | undefined,
): CalibratedPredictionCaseRef | null {
  const intent = ChallengeIntentSchema.parse(selectedIntent);
  if (intent.capabilityId !== "predict" || intent.taskForm !== "runtime_trace") return null;
  const recentPrompts = intent.avoidRecentChallenges.map((recent) => {
    const previous = getChallenge(recent.challengeId, recent.version);
    if (!previous) throw new Error(`Recent challenge is unavailable: ${recent.challengeId}/${recent.version}`);
    return previous.publicPrompt;
  });
  for (const config of listCalibratedPredictionPacks(knowledgeRoot)) {
    const pack = loadCalibratedPredictionPack(knowledgeRoot, config.id);
    if (pack.objective.conceptId !== intent.conceptId) continue;
    const item = pack.cases.find((candidate) => candidate.novelty === intent.novelty);
    if (!item) continue;
    const source = codingCourseFile(join(knowledgeRoot, config.course),
      `${config.directory}/${item.source}`);
    const code = readFileSync(source, "utf8").trimEnd();
    if (recentPrompts.some((prompt) => prompt.includes(code))) continue;
    return { packId: legacyPackId(config.id), caseId: item.id };
  }
  return null;
}

function legacyPackId(id: string): CalibratedPredictionPackId {
  return Object.entries(PACK_ALIASES).find(([, directory]) => directory === id)?.[0] ?? id;
}

export interface BuildCalibratedChallengeInput {
  knowledgeRoot: string;
  packId: CalibratedPredictionPackId;
  intent: ChallengeIntent;
  caseId: string;
  challengeId: string;
  version?: number;
  timeBudgetMinutes?: number;
}

export interface BuiltCalibratedChallenge {
  challenge: ChallengeSpec;
  /** Teacher-only calibration. Never include this in the learner-visible prompt. */
  calibration: Pick<PredictionCase, "surface" | "expectedOutput" | "wrongModels">;
}

/** Materializes one example under a selected intent; it does not select the learner's next work. */
export function buildCalibratedPredictionChallenge(input: BuildCalibratedChallengeInput): BuiltCalibratedChallenge {
  const intent = ChallengeIntentSchema.parse(input.intent);
  const config = resolveCalibratedPredictionPack(input.knowledgeRoot, input.packId);
  const pack = loadCalibratedPredictionPack(input.knowledgeRoot, input.packId);
  if (pack.draft) throw new Error(`Calibrated pack ${input.packId} is still a draft`);
  if (intent.conceptId !== pack.objective.conceptId ||
      intent.capabilityId !== pack.objective.capabilityId ||
      intent.taskForm !== pack.objective.taskForm) {
    throw new Error("Selected intent does not match the calibrated prediction objective and task form");
  }
  const item = pack.cases.find((candidate) => candidate.id === input.caseId);
  if (!item) throw new Error(`Unknown prediction calibration case: ${input.caseId}`);
  if (item.novelty !== intent.novelty) {
    throw new Error(`Calibrated case novelty ${item.novelty} does not match selected novelty ${intent.novelty}`);
  }
  const source = codingCourseFile(join(input.knowledgeRoot, config.course),
    `${config.directory}/${item.source}`);
  const code = readFileSync(source, "utf8").trimEnd();
  const challenge = ChallengeSpecSchema.parse({
    id: input.challengeId,
    version: input.version ?? 1,
    timeBudgetMinutes: input.timeBudgetMinutes,
    publicPrompt: `${pack.environment}\n\n\`\`\`js\n${code}\n\`\`\`\n\n${item.question}`,
    taskForm: intent.taskForm,
    deliveryContext: intent.deliveryContext,
    targets: [{ objectiveId: intent.objectiveId, novelty: intent.novelty,
      criterionIds: item.criteria.map((criterion) => criterion.id) }],
    rubric: { id: `${input.challengeId}-rubric`, version: input.version ?? 1,
      criteria: item.criteria.map((criterion) => ({ ...criterion, objectiveId: intent.objectiveId })) },
    verification: { required: true, basis: "deterministic_execution" },
    privateSolutionRef: `knowledge/${config.course}/${config.directory}/calibration.json`,
  });
  return { challenge, calibration: {
    surface: item.surface,
    expectedOutput: item.expectedOutput,
    wrongModels: item.wrongModels,
  } };
}

/** Compatibility name for the first calibrated objective. */
export function buildCalibratedAsyncPredictChallenge(
  input: Omit<BuildCalibratedChallengeInput, "packId">,
): BuiltCalibratedChallenge {
  return buildCalibratedPredictionChallenge({ ...input, packId: "async-predict" });
}
