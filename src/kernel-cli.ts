/**
 * JSON command surface over the teacher kernel, for agents that reach Learning OS
 * through a shell instead of importing TypeScript:
 *
 *   npm run -s kernel -- [--profile <id> | --db <path>] <method> [json-arg ...]
 *   npm run -s kernel -- methods
 *
 * Each JSON argument is passed positionally to the `createTeacherKernel(db)` method of
 * the same name, and the result is printed as one JSON value. Two extra methods cover
 * the calibrated packs, which need the knowledge root:
 *   findCalibratedCase <intent>
 *   buildCalibratedChallenge <{ packId, intent, caseId, challengeId, timeBudgetMinutes? }>
 *
 * This adds no behavior: every rule is still enforced by the kernel method it calls.
 */
import { fileURLToPath } from "node:url";
import { createDatabase } from "./db/database.js";
import {
  buildCalibratedPredictionChallenge,
  findCalibratedPredictionCase,
} from "./knowledge/challenge-calibration.js";
import { openProfileDatabase } from "./profile/index.js";
import { createTeacherKernel } from "./teacher.js";

const knowledgeRoot = fileURLToPath(new URL("../knowledge", import.meta.url));
const dataDir = fileURLToPath(new URL("../data", import.meta.url));

type Kernel = ReturnType<typeof createTeacherKernel>;
type Handler = (...args: unknown[]) => unknown;

function parseArgs(argv: string[]) {
  let profileId: string | undefined;
  let dbPath: string | undefined;
  const rest: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "--profile" || arg === "--db") {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error(`${arg} needs a value`);
      if (arg === "--profile") profileId = value;
      else dbPath = value;
    } else rest.push(arg);
  }
  const [method, ...jsonArgs] = rest;
  return { profileId, dbPath, method, jsonArgs };
}

function extraMethods(kernel: Kernel): Record<string, Handler> {
  return {
    findCalibratedCase: (intent) =>
      findCalibratedPredictionCase(knowledgeRoot, intent as never, kernel.getChallenge),
    buildCalibratedChallenge: (input) =>
      buildCalibratedPredictionChallenge({ ...(input as object), knowledgeRoot } as never),
  };
}

function main(): void {
  const { profileId, dbPath, method, jsonArgs } = parseArgs(process.argv.slice(2));
  if (!method) {
    throw new Error("Usage: npm run -s kernel -- [--profile <id> | --db <path>] <method> [json-arg ...]");
  }
  if (profileId && dbPath) throw new Error("Use either --profile or --db, not both");

  const db = dbPath ? createDatabase(dbPath) : openProfileDatabase(profileId, { dataDir });
  try {
    const kernel = createTeacherKernel(db);
    const methods: Record<string, Handler> = {
      ...(kernel as unknown as Record<string, Handler>),
      ...extraMethods(kernel),
    };
    if (method === "methods") {
      console.log(JSON.stringify(Object.keys(methods).sort()));
      return;
    }
    const handler = methods[method];
    if (typeof handler !== "function") throw new Error(`Unknown kernel method: ${method}`);
    const args = jsonArgs.map((arg, index) => {
      try {
        return JSON.parse(arg) as unknown;
      } catch {
        throw new Error(`Argument ${index + 1} is not valid JSON: ${arg}`);
      }
    });
    console.log(JSON.stringify(handler(...args) ?? null));
  } finally {
    db.close();
  }
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
}
