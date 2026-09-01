import type Database from "better-sqlite3";
import {
  ChallengeDefectScope,
  ChallengeRejectionReason,
  ChallengeAttemptDispositionRowSchema,
  SessionSchema,
} from "../db/types.js";
import type {
  ChallengeAttemptDispositionRow,
  Session,
} from "../db/types.js";
import {
  ChallengeIntentSchema,
} from "../selection/types.js";
import type {
  ChallengeIntent,
  RecentChallengeRef,
} from "../selection/types.js";
import {
  abandonUnsubmittedSession,
  closeSessionAfterRejectedAttempt,
  effectiveEvidenceIdsForAttempt,
  getAttempt,
  getChallenge,
  getChallengeAttemptDisposition,
  getChallengeAuthoringContract,
} from "./foundation.js";
import { reviseEvidence } from "./evidence.js";

export interface RejectActiveChallengeAttemptInput {
  reason: ChallengeRejectionReason;
  defectScope: ChallengeDefectScope;
  detail: string;
}

export interface ChallengeAttemptRejectionResult {
  disposition: ChallengeAttemptDispositionRow;
  session: Session;
  replacementIntent: ChallengeIntent;
  rejectedChallenge: RecentChallengeRef;
  invalidatedEvidenceIds: string[];
}

function requireDetail(value: string): string {
  const detail = value.trim();
  if (detail.length === 0) {
    throw new Error("Challenge rejection detail must not be empty");
  }
  return detail;
}

function insertDisposition(
  db: Database.Database,
  attemptId: number,
  disposition: ChallengeAttemptDispositionRow["disposition"],
  reason: ChallengeRejectionReason,
  defectScope: ChallengeDefectScope,
  detail: string,
): ChallengeAttemptDispositionRow {
  if (getChallengeAttemptDisposition(db, attemptId) !== null) {
    throw new Error(`Challenge attempt already has a terminal disposition: ${attemptId}`);
  }
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO challenge_attempt_dispositions (
       attempt_id, disposition, reason_code, defect_scope, detail, created_at
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(attemptId, disposition, reason, defectScope, detail, createdAt);
  return ChallengeAttemptDispositionRowSchema.parse(
    db.prepare(`SELECT * FROM challenge_attempt_dispositions WHERE attempt_id = ?`).get(attemptId),
  );
}

export function rejectActiveChallengeAttempt(
  db: Database.Database,
  sessionId: number,
  input: RejectActiveChallengeAttemptInput,
): ChallengeAttemptRejectionResult {
  const reason = ChallengeRejectionReason.parse(input.reason);
  const defectScope = ChallengeDefectScope.parse(input.defectScope);
  const detail = requireDetail(input.detail);

  return db.transaction(() => {
    const session = SessionSchema.parse(db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId));
    if (session.active_attempt_id === null || session.active_challenge_id === null || session.active_challenge_version === null) {
      throw new Error(`Session ${sessionId} has no active challenge attempt to reject`);
    }

    const attempt = getAttempt(db, session.active_attempt_id);
    if (!attempt) {
      throw new Error(`Active attempt not found: ${session.active_attempt_id}`);
    }
    if (
      attempt.session_id !== sessionId ||
      attempt.challenge_id !== session.active_challenge_id ||
      attempt.challenge_version !== session.active_challenge_version
    ) {
      throw new Error(`Session ${sessionId} active attempt does not match its frozen challenge reference`);
    }

    const challenge = getChallenge(db, session.active_challenge_id, session.active_challenge_version);
    if (!challenge) {
      throw new Error(
        `Frozen challenge version not found: ${session.active_challenge_id}@${session.active_challenge_version}`,
      );
    }
    const contract = getChallengeAuthoringContract(db, challenge.id, challenge.version);
    if (!contract) {
      throw new Error(
        `Challenge ${challenge.id}@${challenge.version} has no persisted authoring contract; ` +
        "same-intent replacement cannot be reconstructed safely",
      );
    }

    const rejectedChallenge: RecentChallengeRef = {
      challengeId: challenge.id,
      version: challenge.version,
      attemptId: attempt.id,
      taskForm: challenge.taskForm,
      novelty: challenge.targets[0]?.novelty ?? contract.novelty,
      performedAt: attempt.submitted_at ?? attempt.started_at,
    };
    const { contractVersion: _contractVersion, ...baseIntent } = contract;
    const replacementIntent = ChallengeIntentSchema.parse({
      ...baseIntent,
      avoidRecentChallenges: [
        rejectedChallenge,
        ...contract.avoidRecentChallenges.filter(
          (item) =>
            item.challengeId !== rejectedChallenge.challengeId ||
            item.version !== rejectedChallenge.version ||
            item.attemptId !== rejectedChallenge.attemptId,
        ),
      ],
    });

    if (attempt.submitted_at === null) {
      const disposition = insertDisposition(
        db,
        attempt.id,
        "rejected_before_submission",
        reason,
        defectScope,
        detail,
      );
      const closedSession = abandonUnsubmittedSession(db, sessionId);
      return {
        disposition,
        session: closedSession,
        replacementIntent,
        rejectedChallenge,
        invalidatedEvidenceIds: [],
      };
    }

    if (reason === "fails_selected_weakness") {
      throw new Error(
        "A selected-weakness mismatch alone does not invalidate an already-submitted assessment opportunity; " +
        "finish the normal evidence lifecycle and leave the weakness unresolved",
      );
    }

    const invalidatedEvidenceIds = effectiveEvidenceIdsForAttempt(db, attempt.id);
    for (const evidenceEventId of invalidatedEvidenceIds) {
      reviseEvidence(db, evidenceEventId, {
        action: "invalidate",
        reason: `Challenge attempt voided (${reason}): ${detail}`,
      });
    }

    const disposition = insertDisposition(
      db,
      attempt.id,
      "voided_after_submission",
      reason,
      defectScope,
      detail,
    );
    const closedSession = closeSessionAfterRejectedAttempt(db, sessionId, attempt.id);

    return {
      disposition,
      session: closedSession,
      replacementIntent,
      rejectedChallenge,
      invalidatedEvidenceIds,
    };
  })();
}
