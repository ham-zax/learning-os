import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { z } from "zod";
import { getSession } from "../db/database.js";
import { getScaffoldMaterial, ScaffoldStageSchema } from "../knowledge/scaffolds.js";
import {
  getAttempt, getChallenge, getChallengeAttemptDisposition, getLearningObjective, recordExposure,
} from "./foundation.js";

export const ScaffoldPresentationInputSchema = z.object({
  packId: z.string().min(1).max(200),
  stage: ScaffoldStageSchema,
  requireReconstruction: z.boolean().optional(),
}).strict();
export type ScaffoldPresentationInput = z.infer<typeof ScaffoldPresentationInputSchema>;

/**
 * Scaffold source references are tagged at their trusted presentation boundary.
 * The public recordExposure sourceRef remains free-form; a plain curriculum path
 * must never be treated as an authenticated scaffold presentation.
 */
const SCAFFOLD_REF_PREFIX = "scaffold:v1:";
const sha256 = (content: string) => createHash("sha256").update(content, "utf8").digest("hex");
const slug = "[a-z0-9]+(?:-[a-z0-9]+)*";
const scaffoldPath = new RegExp(
  `^knowledge/(${slug})/(?:(?:challenges/(${slug})/scaffold)|(?:scaffolds/(${slug})))/(${slug}\\.md)$`,
);

type Provenance = {
  stage: "worked_example" | "completion";
  sourceRef: string;
  conceptId: string;
  capabilityId: "predict" | "debug";
  taskForm: "runtime_trace" | "debugging";
  contentSha256: string;
};

function encodeScaffoldProvenance(material: ReturnType<typeof getScaffoldMaterial>): string {
  const { packId, stage, objective, sourceRef, learnerMarkdown } = material;
  return `${SCAFFOLD_REF_PREFIX}${packId}:${stage}:${objective.conceptId}:${objective.capabilityId}:${objective.taskForm}:${sha256(learnerMarkdown)}:${sourceRef}`;
}

/**
 * Only these ten exact old-format paths were published before the v1 tag.
 * Old rows have no author marker: even a perfect path+objective match cannot
 * prove whether prepareScaffoldPresentation or generic recordExposure wrote one.
 */
const legacyPacks = [
  { course: "backend-systems", pack: "database-transactions-predict",
    conceptId: "database-transactions-and-concurrent-correctness", kind: "attached",
    workedSha: "dc216160a6f82e0a6088821d0767e50c540aee62a41a32d5f458dbafeb329b3b",
    completionSha: "9710c8c1077dfb77edf3a58872d4c2e05adc32c1df99cb57261a4c7dcd920d90" },
  { course: "backend-systems", pack: "retries-idempotency-predict",
    conceptId: "retries-idempotency-and-uncertain-outcomes", kind: "attached",
    workedSha: "fdf05f2aa8dc00ddd5deaf03157b66f38221affd1d82d670beb15e5b0b73b76b",
    completionSha: "c1a4cb5b76b5a8f51df32ee9414acf6097c823368548f75962edc3e779c4453d" },
  { course: "frontend-revision", pack: "js-async-await-predict",
    conceptId: "js-async-await", kind: "attached",
    workedSha: "0308f475f47aea8f094ddf6a1b09f5e3052660abe0e0e01d3da70d8b79aa1df7",
    completionSha: "3104971a455f477c48113c256689b3ff8471b9c72f7d6db848a3e408653b5f5b" },
  { course: "frontend-revision", pack: "js-promises-predict",
    conceptId: "js-promises", kind: "attached",
    workedSha: "ad13b71d357f10a82105488fd185bcd89ea15114fa7e7a7c4c0ab07d952b8f28",
    completionSha: "69ca806c9cf70af8d10959f603fb4c79ec9a5442f54275629d5e25d75b6afd55" },
  { course: "backend-systems", pack: "database-transactions-debug",
    conceptId: "database-transactions-and-concurrent-correctness", kind: "standalone",
    workedSha: "d652c0e3bdc875b2e55928d08d32adc0848b5366bf49120d7bdd8e648493a603",
    completionSha: "e745c95e4cafaf521b5c15962401b431c15cf240d8bc32ebad165b9f2d81b2ae" },
] as const;

function decodeScaffoldProvenance(sourceRef: string): Provenance | null {
  if (sourceRef.startsWith(SCAFFOLD_REF_PREFIX)) {
    const parts = sourceRef.slice(SCAFFOLD_REF_PREFIX.length).split(":");
    if (parts.length !== 7) return null;
    const [packId, stage, conceptId, capabilityId, taskForm, contentSha256, path] = parts;
    if (!packId || !conceptId || !path || !ScaffoldStageSchema.safeParse(stage).success ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(packId) ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(conceptId) ||
        !/^[a-f0-9]{64}$/.test(contentSha256)) return null;
    const match = scaffoldPath.exec(path);
    if (!match || (match[2] ?? match[3]) !== packId ||
        match[4] !== (stage === "worked_example" ? "worked-example.md" : "completion.md")) {
      return null;
    }
    const attached = match[2] !== undefined;
    if (attached ? capabilityId !== "predict" || taskForm !== "runtime_trace"
      : capabilityId !== "debug" || taskForm !== "debugging") return null;
    return {
      stage: stage as Provenance["stage"], sourceRef: path, conceptId,
      capabilityId: capabilityId as Provenance["capabilityId"],
      taskForm: taskForm as Provenance["taskForm"], contentSha256,
    };
  }
  // Historical rows: exact five published packs and exact stage filenames only.
  for (const pack of legacyPacks) {
    const directory = pack.kind === "attached"
      ? `challenges/${pack.pack}/scaffold` : `scaffolds/${pack.pack}`;
    for (const [stage, filename] of [
      ["worked_example", "worked-example.md"], ["completion", "completion.md"],
    ] as const) {
      if (sourceRef === `knowledge/${pack.course}/${directory}/${filename}`) {
        return {
          stage, sourceRef, conceptId: pack.conceptId,
          capabilityId: pack.kind === "attached" ? "predict" : "debug",
          taskForm: pack.kind === "attached" ? "runtime_trace" : "debugging",
          contentSha256: stage === "worked_example" ? pack.workedSha : pack.completionSha,
        };
      }
    }
  }
  return null;
}

/** Replay persisted material after a restart, including when curriculum files have changed. */
export function getSessionScaffoldPresentations(db: Database.Database, sessionId: number) {
  z.number().int().positive().parse(sessionId);
  const session = getSession(db, sessionId);
  if (!session) throw new Error("Scaffold session not found");
  if (session.active_attempt_id === null) return [];
  const attempt = getAttempt(db, session.active_attempt_id);
  const challenge = attempt?.challenge_id && attempt.challenge_version
    ? getChallenge(db, attempt.challenge_id, attempt.challenge_version) : null;
  if (!challenge) return [];
  const rows = db.prepare(`
    SELECT exposure.seq, exposure.objective_id, exposure.challenge_id, exposure.challenge_version,
           exposure.source_ref, exposure.exposure_type,
           artifact.id AS teaching_artifact_id, artifact.content, artifact.content_format
    FROM exposure_events exposure JOIN teaching_artifacts artifact
      ON artifact.id = exposure.teaching_artifact_id
    WHERE exposure.session_id = ? AND exposure.attempt_id = ?
    ORDER BY exposure.seq
  `).all(sessionId, session.active_attempt_id) as Array<{
    seq: number; objective_id: string; challenge_id: string | null; challenge_version: number | null;
    source_ref: string | null; exposure_type: string;
    teaching_artifact_id: string; content: string; content_format: string;
  }>;
  return rows.flatMap((row) => {
    const provenance = row.source_ref && decodeScaffoldProvenance(row.source_ref);
    if (!provenance || row.content_format !== "markdown" ||
        sha256(row.content) !== provenance.contentSha256 ||
        row.challenge_id !== challenge.id || row.challenge_version !== challenge.version ||
        challenge.taskForm !== provenance.taskForm ||
        !challenge.targets.some((target) => target.objectiveId === row.objective_id) ||
        row.exposure_type !== (provenance.stage === "worked_example" ? "worked_example_shown" : "explanation_shown")) {
      return [];
    }
    const objective = getLearningObjective(db, row.objective_id);
    if (!objective || objective.concept_id !== provenance.conceptId ||
        objective.capability_id !== provenance.capabilityId) return [];
    return [{
      sessionId, attemptId: session.active_attempt_id,
      sourceRef: provenance.sourceRef, stage: provenance.stage,
      markdown: row.content, exposureSeqs: [row.seq], teachingArtifactId: row.teaching_artifact_id,
    }];
  });
}

/** Persist the exact instruction before returning learner-visible material. */
export function prepareScaffoldPresentation(
  db: Database.Database, knowledgeRoot: string, sessionId: number, input: ScaffoldPresentationInput,
) {
  z.number().int().positive().parse(sessionId);
  const parsed = ScaffoldPresentationInputSchema.parse(input);
  const material = getScaffoldMaterial(knowledgeRoot, parsed.packId, parsed.stage);
  return db.transaction(() => {
    const session = getSession(db, sessionId);
    const presenting = session && session.ended_at === null && (
      (session.phase === "awaiting_response" && session.pending_action === "collect_response") ||
      (session.phase === "feedback" && session.pending_action === "present_feedback")
    );
    if (!presenting || session.active_attempt_id === null) {
      throw new Error("Scaffold presentation requires an active response or feedback session");
    }
    const attempt = getAttempt(db, session.active_attempt_id);
    if (!attempt || attempt.session_id !== sessionId || !attempt.challenge_id || !attempt.challenge_version ||
        getChallengeAttemptDisposition(db, attempt.id)) {
      throw new Error("Scaffold presentation requires the session's active attempt");
    }
    if ((session.phase === "awaiting_response") !== (attempt.submitted_at === null)) {
      throw new Error("Scaffold session phase does not match the active attempt");
    }
    const challenge = getChallenge(db, attempt.challenge_id, attempt.challenge_version);
    if (!challenge || session.active_challenge_id !== challenge.id ||
        session.active_challenge_version !== challenge.version || challenge.taskForm !== material.objective.taskForm) {
      throw new Error("Scaffold does not match the active frozen challenge");
    }
    if (session.phase === "awaiting_response" &&
        (challenge.deliveryContext === "interview" || challenge.deliveryContext === "mock")) {
      throw new Error("Interview and mock scaffolding is available only during feedback");
    }
    const targets = challenge.targets.filter((target) => {
      const objective = getLearningObjective(db, target.objectiveId);
      return objective?.concept_id === material.objective.conceptId &&
        objective.capability_id === material.objective.capabilityId;
    });
    if (targets.length !== 1) throw new Error("Scaffold requires exactly one matching challenge objective");
    const exposures = recordExposure(db, sessionId, {
      attemptId: attempt.id, objectiveIds: [targets[0].objectiveId],
      exposureType: material.exposureType, sourceRef: encodeScaffoldProvenance(material),
      teachingMaterial: { content: material.learnerMarkdown, format: "markdown" },
      requireReconstruction: parsed.requireReconstruction,
    });
    return {
      sessionId, attemptId: attempt.id, packId: material.packId, stage: material.stage,
      sourceRef: material.sourceRef, markdown: material.learnerMarkdown,
      exposureSeqs: exposures.map((event) => event.seq),
      teachingArtifactId: exposures[0].teaching_artifact_id,
    };
  })();
}
