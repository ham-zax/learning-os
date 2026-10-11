import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { z } from "zod";
import { codingCourseFile } from "./courses.js";
import {
  listCalibratedPredictionPacks,
  loadCalibratedPredictionPack,
  resolveCalibratedPredictionPack,
} from "./challenge-calibration.js";

export const ScaffoldStageSchema = z.enum(["worked_example", "completion"]);
export type ScaffoldStage = z.infer<typeof ScaffoldStageSchema>;
const text = z.string().trim().min(1).max(16_000);
const stage = z.object({
  material: z.string().regex(/^[a-z0-9-]+\.md$/),
  teacherNotes: text,
}).strict();
const commonFields = {
  version: z.literal(1),
  title: text,
  scopeNote: text,
  stages: z.object({ worked_example: stage, completion: stage }).strict(),
  checks: z.array(z.object({
    source: z.string().regex(/^[a-z0-9-]+\.mjs$/),
    expectedOutput: z.array(text).min(1).max(100),
  }).strict()).min(1).max(10),
};
export const PredictionScaffoldSchema = z.object({
  ...commonFields,
  objective: z.object({
    conceptId: text, capabilityId: z.literal("predict"), taskForm: z.literal("runtime_trace"),
  }).strict(),
}).strict();
const DebugScaffoldSchema = z.object({
  ...commonFields,
  objective: z.object({
    conceptId: text, capabilityId: z.literal("debug"), taskForm: z.literal("debugging"),
  }).strict(),
}).strict();

function readMaterial(file: string): string {
  if (statSync(file).size > 64 * 1024) throw new Error("Scaffold material exceeds 64 KiB");
  const content = readFileSync(file, "utf8");
  if (!content.trim()) throw new Error("Scaffold material is empty");
  return content;
}

type ScaffoldLocation = {
  id: string; course: string; directory: string; kind: "attached" | "standalone";
};

/** Attached prediction packs remain stable; standalone debug packs live under course/scaffolds. */
function scaffoldLocations(knowledgeRoot: string): ScaffoldLocation[] {
  const locations: ScaffoldLocation[] = listCalibratedPredictionPacks(knowledgeRoot)
    .filter((pack) => existsSync(join(knowledgeRoot, pack.course, pack.directory, "scaffold/scaffold.json")))
    .map((pack) => ({ id: pack.id, course: pack.course,
      directory: `${pack.directory}/scaffold`, kind: "attached" }));
  for (const course of readdirSync(knowledgeRoot, { withFileTypes: true })) {
    if (!course.isDirectory()) continue;
    const root = join(knowledgeRoot, course.name, "scaffolds");
    if (!existsSync(root)) continue;
    for (const pack of readdirSync(root, { withFileTypes: true })) {
      if (!pack.isDirectory() || !existsSync(join(root, pack.name, "scaffold.json"))) continue;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pack.name)) {
        throw new Error(`Invalid standalone scaffold ID: ${pack.name}`);
      }
      locations.push({ id: pack.name, course: course.name,
        directory: `scaffolds/${pack.name}`, kind: "standalone" });
    }
  }
  const seen = new Set<string>();
  for (const pack of locations) {
    if (seen.has(pack.id)) throw new Error(`Duplicate scaffold pack ID: ${pack.id}`);
    seen.add(pack.id);
  }
  return locations.sort((a, b) => a.id.localeCompare(b.id));
}

/** Authored instruction only. Discovery neither executes source nor creates learner state. */
export function loadPredictionScaffoldPack(knowledgeRoot: string, packId: string) {
  const locations = scaffoldLocations(knowledgeRoot);
  let location = locations.find((candidate) => candidate.id === packId);
  if (!location) {
    const legacy = resolveCalibratedPredictionPack(knowledgeRoot, packId);
    location = locations.find((candidate) => candidate.id === basename(legacy.directory));
  }
  if (!location) throw new Error(`Unknown scaffold pack: ${packId}`);
  const courseDirectory = join(knowledgeRoot, location.course);
  const directory = location.directory;
  const file = codingCourseFile(courseDirectory, `${directory}/scaffold.json`);
  const manifest = location.kind === "attached"
    ? PredictionScaffoldSchema.parse(JSON.parse(readMaterial(file)))
    : DebugScaffoldSchema.parse(JSON.parse(readMaterial(file)));
  if (location.kind === "attached") {
    const parent = loadCalibratedPredictionPack(knowledgeRoot, location.id);
    if (manifest.objective.conceptId !== parent.objective.conceptId ||
        manifest.objective.capabilityId !== parent.objective.capabilityId ||
        manifest.objective.taskForm !== parent.objective.taskForm) {
      throw new Error("Scaffold objective must match its calibrated prediction pack");
    }
  }
  for (const item of Object.values(manifest.stages)) {
    readMaterial(codingCourseFile(courseDirectory, `${directory}/${item.material}`));
  }
  for (const check of manifest.checks) {
    codingCourseFile(courseDirectory, `${directory}/${check.source}`);
  }
  return { packId: location.id, courseDirectory, directory, course: location.course, manifest };
}

export function listScaffoldPacks(knowledgeRoot: string) {
  return scaffoldLocations(knowledgeRoot).map((pack) => {
    const { packId, manifest } = loadPredictionScaffoldPack(knowledgeRoot, pack.id);
    return { packId, title: manifest.title, objective: manifest.objective,
      scopeNote: manifest.scopeNote, stages: ScaffoldStageSchema.options };
  });
}

/** Teacher authoring surface: teacherOnly includes answer keys; never forward it to learners. */
export function getScaffoldMaterial(knowledgeRoot: string, packId: string, stageInput: ScaffoldStage) {
  const selected = ScaffoldStageSchema.parse(stageInput);
  const pack = loadPredictionScaffoldPack(knowledgeRoot, packId);
  const item = pack.manifest.stages[selected];
  return {
    packId: pack.packId, stage: selected, title: pack.manifest.title,
    objective: pack.manifest.objective, scopeNote: pack.manifest.scopeNote,
    sourceRef: `knowledge/${pack.course}/${pack.directory}/${item.material}`,
    learnerMarkdown: readMaterial(codingCourseFile(pack.courseDirectory, `${pack.directory}/${item.material}`)),
    teacherOnly: { notes: item.teacherNotes },
    exposureType: selected === "worked_example" ? "worked_example_shown" as const : "explanation_shown" as const,
  };
}
