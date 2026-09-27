import type Database from "better-sqlite3";

interface EvidenceMetricRow {
  result: string;
  novelty: string;
  retrieval_valid: number;
  delay_seconds: number | null;
  latest_revision_action: string | null;
}

export interface DogfoodMetricsInput {
  goalId: string;
  /** Minimum delay for a later retrieval; defaults to seven elapsed days. */
  delayedDays?: number;
}

export interface DogfoodMetrics {
  goalId: string;
  delayedDays: number;
  assessedEvents: number;
  effectiveAssessedEvents: number;
  delayedValidRetrievals: { total: number; correct: number };
  validCorrectTransfers: number;
  evidenceRevisions: number;
  /** Recorded answer-bearing exposures after assessment, not a count of chat turns. */
  repairExposures: number;
  reconstructionAnswers: number;
  abandonedEpisodes: number;
  limitations: string[];
}

/** Read-only pilot counts from existing durable observations; never promotes learner state. */
export function summarizeDogfoodMetrics(
  db: Database.Database,
  input: DogfoodMetricsInput,
): DogfoodMetrics {
  const goalId = input.goalId.trim();
  if (!goalId || !db.prepare("SELECT 1 FROM topics WHERE id = ?").get(goalId)) {
    throw new Error(`Goal not found: ${input.goalId}`);
  }
  const delayedDays = input.delayedDays ?? 7;
  if (!Number.isSafeInteger(delayedDays) || delayedDays <= 0) {
    throw new Error("delayedDays must be a positive safe integer");
  }
  const thresholdSeconds = delayedDays * 86400;
  const evidence = db.prepare(`
    SELECT evidence.result, evidence.novelty, evidence.retrieval_valid, evidence.delay_seconds,
      (SELECT revision.action FROM evidence_revisions revision
       WHERE revision.evidence_event_id = evidence.id ORDER BY revision.seq DESC LIMIT 1)
       AS latest_revision_action
    FROM evidence_events evidence
    JOIN sessions session ON session.id = evidence.session_id
    WHERE session.topic_id = ?
  `).all(goalId) as EvidenceMetricRow[];
  const effective = evidence.filter((event) => event.latest_revision_action !== "invalidate");
  const delayed = effective.filter((event) => event.retrieval_valid === 1 &&
    event.delay_seconds !== null && event.delay_seconds >= thresholdSeconds);

  function count(sql: string): number {
    return (db.prepare(sql).get(goalId) as { count: number }).count;
  }

  return {
    goalId,
    delayedDays,
    assessedEvents: evidence.length,
    effectiveAssessedEvents: effective.length,
    delayedValidRetrievals: {
      total: delayed.length,
      correct: delayed.filter((event) => event.result === "correct").length,
    },
    validCorrectTransfers: effective.filter((event) => event.novelty === "transfer" &&
      event.retrieval_valid === 1 && event.result === "correct").length,
    evidenceRevisions: count(`SELECT COUNT(*) AS count FROM evidence_revisions revision
      JOIN evidence_events evidence ON evidence.id = revision.evidence_event_id
      JOIN sessions session ON session.id = evidence.session_id WHERE session.topic_id = ?`),
    repairExposures: count(`SELECT COUNT(*) AS count FROM exposure_events exposure
      JOIN sessions session ON session.id = exposure.session_id
      WHERE session.topic_id = ? AND exposure.attempt_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM evidence_events evidence
        WHERE evidence.attempt_id = exposure.attempt_id
          AND evidence.objective_id = exposure.objective_id
          AND evidence.created_at <= exposure.occurred_at)`),
    reconstructionAnswers: count(`SELECT COUNT(*) AS count FROM attempt_subquestions question
      JOIN attempts attempt ON attempt.id = question.attempt_id
      JOIN sessions session ON session.id = attempt.session_id
      WHERE session.topic_id = ? AND question.purpose = 'reconstruction'
        AND question.response_text IS NOT NULL AND question.superseded_at IS NULL`),
    abandonedEpisodes: count(`SELECT COUNT(DISTINCT session.id) AS count FROM sessions session
      JOIN attempts attempt ON attempt.session_id = session.id
      WHERE session.topic_id = ? AND session.phase = 'complete'
        AND attempt.submitted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM challenge_attempt_dispositions disposition
          WHERE disposition.attempt_id = attempt.id)`),
    limitations: [
      "These are observed counts for one goal, not evidence of a teaching effect or a completion claim.",
      "Chat turns and learner effort outside durable attempts are not stored; repair exposures and reconstruction answers are narrower proxies.",
      "Delayed retrieval uses the recorded elapsed interval between evidence events; that interval is not active-study time.",
    ],
  };
}
