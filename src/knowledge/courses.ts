import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { z } from "zod";
import type { IntakeArea, KnowledgeCatalog, OnboardingIntake } from "../onboarding/types.js";

const text = z.string().trim().min(1);
const id = text.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const objectiveId = text.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*:(?:explain|predict|implement|debug|design)$/);
const resource = z
  .object({
    id,
    title: text,
    role: text,
    url: z.string().url().refine((value) => /^https?:\/\//.test(value)).optional(),
    /** Relative to the workspace root. May locate an existing sibling source repository. */
    localPath: text.optional(),
  })
  .strict()
  .refine((value) => value.url || value.localPath, "A resource needs a URL or local locator");

export const CodingCourseSchema = z.object({
  id,
  title: text,
  version: text,
  scope: text,
  entry: text,
  sourceMap: text,
  defaultUnits: z.array(id).min(1),
  sources: z.array(resource).min(1),
  units: z.array(z.object({
    id,
    title: text,
    file: text,
    lane: z.enum(["core", "react", "angular", "extension"]),
    outcome: text,
    objectiveIds: z.array(objectiveId).min(1),
    sourceIds: z.array(id).min(1),
  }).strict()).min(1),
}).strict();
export type CodingCourse = z.infer<typeof CodingCourseSchema>;
export interface LoadedCodingCourse {
  course: CodingCourse;
  directory: string;
}

/** Resolve authored content inside the course. Sources are references, never executable instructions. */
export function codingCourseFile(directory: string, ref: string): string {
  const file = ref.split("#", 1)[0];
  if (!file || isAbsolute(file)) throw new Error(`Course file must be relative: ${ref}`);
  const root = realpathSync(directory);
  const candidate = resolve(root, file);
  const inside = (path: string) => {
    const part = relative(root, path);
    return part !== ".." && !part.startsWith(`..${sep}`) && !isAbsolute(part);
  };
  if (
    !inside(candidate) ||
    !existsSync(candidate) ||
    !statSync(candidate).isFile() ||
    !inside(realpathSync(candidate))
  ) {
    throw new Error(`Missing or outside-course file: ${ref}`);
  }
  return candidate;
}

function unique(values: readonly string[], name: string): void {
  if (new Set(values).size !== values.length) throw new Error(`Duplicate ${name}`);
}

/** Read-only discovery: no database, enrollment, readiness or schedule is created. */
export function loadCodingCourses(
  knowledgeRoot: string,
  catalog: KnowledgeCatalog,
): LoadedCodingCourse[] {
  const courses: LoadedCodingCourse[] = [];
  const entries = readdirSync(knowledgeRoot, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const directory = join(knowledgeRoot, entry.name);
    const path = join(directory, "course.json");
    if (!existsSync(path)) continue;
    const course = CodingCourseSchema.parse(JSON.parse(readFileSync(path, "utf8")));
    const topic = catalog.topics.find((item) => item.topicId === course.id);
    if (!topic) throw new Error(`Course ${course.id} has no catalog topic`);
    const concepts = new Map(topic.concepts.map((item) => [item.conceptId, item]));
    unique(course.units.map((item) => item.id), "unit ID");
    unique(course.sources.map((item) => item.id), "resource ID");
    unique(course.defaultUnits, "default unit");
    const units = new Set(course.units.map((item) => item.id));
    const sources = new Set(course.sources.map((item) => item.id));
    if (course.defaultUnits.some((unit) => !units.has(unit))) {
      throw new Error(`Unknown default unit in ${course.id}`);
    }
    codingCourseFile(directory, course.entry);
    codingCourseFile(directory, course.sourceMap);
    for (const concept of concepts.values()) {
      // Do not let the catalog's INDEX fallback conceal missing concept references.
      codingCourseFile(directory, `concepts/${concept.conceptId}.md`);
    }
    for (const unit of course.units) {
      codingCourseFile(directory, unit.file);
      unique(unit.objectiveIds, `${unit.id} objective`);
      for (const objective of unit.objectiveIds) {
        const concept = concepts.get(objective.split(":")[0]);
        if (!concept) throw new Error(`Unknown course objective: ${objective}`);
      }
      if (unit.sourceIds.some((source) => !sources.has(source))) {
        throw new Error(`Unknown source in ${unit.id}`);
      }
    }
    courses.push({ course, directory });
  }
  unique(courses.map(({ course }) => course.id), "course ID");
  return courses;
}

export function findCodingCourse(courses: LoadedCodingCourse[], courseId: string): LoadedCodingCourse {
  const loaded = courses.find(({ course }) => course.id === courseId);
  if (!loaded) throw new Error(`Unknown coding course: ${courseId}`);
  return loaded;
}

export function selectCodingUnits(loaded: LoadedCodingCourse, unitIds?: readonly string[]) {
  const ids = unitIds ?? loaded.course.defaultUnits;
  if (!ids.length) throw new Error("Select at least one course unit");
  unique(ids, "selected unit");
  return ids.map((unitId) => {
    const unit = loaded.course.units.find((item) => item.id === unitId);
    if (!unit) throw new Error(`Unknown unit ${loaded.course.id}/${unitId}`);
    return unit;
  });
}

export function codingCourseIntake(
  loaded: LoadedCodingCourse,
  catalog: KnowledgeCatalog,
  intake: OnboardingIntake,
  unitIds?: readonly string[],
): OnboardingIntake {
  const topic = catalog.topics.find((item) => item.topicId === loaded.course.id)!;
  const selected = new Map<string, IntakeArea>();
  for (const unit of selectCodingUnits(loaded, unitIds)) {
    for (const objective of unit.objectiveIds) {
      const [conceptId, capability] = objective.split(":");
      const concept = topic.concepts.find((item) => item.conceptId === conceptId)!;
      const area = selected.get(conceptId) ?? {
        label: concept.title,
        topicId: topic.topicId,
        conceptId,
        capabilities: [],
      };
      const cap = capability as NonNullable<IntakeArea["capabilities"]>[number];
      if (!area.capabilities!.includes(cap)) area.capabilities!.push(cap);
      selected.set(conceptId, area);
    }
  }
  // Exact selected targets, not a broad topic expansion or an implicit claim of experience.
  return { ...intake, mustCover: [...selected.values(), ...(intake.mustCover ?? [])] };
}

export function codingCourseResources(loaded: LoadedCodingCourse, knowledgeRoot: string) {
  return loaded.course.sources.map((source) => {
    const localPath = source.localPath ? resolve(dirname(knowledgeRoot), source.localPath) : null;
    let localAvailable = false;
    try {
      localAvailable = localPath !== null && statSync(localPath).isFile();
    } catch {
      // Portable URL fallback remains available.
    }
    return { ...source, localPath, localAvailable };
  });
}
