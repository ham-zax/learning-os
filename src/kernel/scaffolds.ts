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

/** Replay persisted material after a restart, including when curriculum files have changed. */
export function getSessionScaffoldPresentations(db: Database.Database, sessionId: number) {
  z.number().int().positive().parse(sessionId);
  const session = getSession(db, sessionId);
  if (!session) throw new Error("Scaffold session not found");
  if (session.active_attempt_id === null) return [];
  const rows = db.prepare(`
    SELECT exposure.seq, exposure.source_ref, exposure.exposure_type,
           artifact.id AS teaching_artifact_id, artifact.content
    FROM exposure_events exposure JOIN teaching_artifacts artifact
      ON artifact.id = exposure.teaching_artifact_id
    WHERE exposure.session_id = ? AND exposure.attempt_id = ?
    ORDER BY exposure.seq
  `).all(sessionId, session.active_attempt_id) as Array<{
    seq: number; source_ref: string | null; exposure_type: string; teaching_artifact_id: string; content: string;
  }>;
  return rows.filter((row) => row.source_ref &&
    /^knowledge\/[^/]+\/challenges\/[^/]+\/scaffold\/[a-z0-9-]+\.md$/.test(row.source_ref) &&
    ["worked_example_shown", "explanation_shown"].includes(row.exposure_type))
    .map((row) => ({
      sessionId, attemptId: session.active_attempt_id,
      sourceRef: row.source_ref!, stage: row.exposure_type === "worked_example_shown" ? "worked_example" : "completion",
      markdown: row.content, exposureSeqs: [row.seq], teachingArtifactId: row.teaching_artifact_id,
    }));
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
      exposureType: material.exposureType, sourceRef: material.sourceRef,
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
