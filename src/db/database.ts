/**
 * SQLite database setup, schema creation, and migrations for the tutor engine.
 *
 * Uses better-sqlite3 in WAL mode with PRAGMA user_version for migration tracking.
 */

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import {
  AttemptSchema,
  GoalObjectiveSchema,
  GoalPreparationSchema,
  ReviewSchema,
  SessionSchema,
} from "./types.js";
import type {
  Topic,
  Concept,
  Session,
  Review,
  SyncedGap,
  SyncedSignal,
  Problem,
  Attempt,
  DeliveryContext,
  GoalObjective,
  GoalImportance,
  GoalTargetReadiness,
  GoalPreparation,
  PreparationPurpose,
  PreparationStrategy,
  InitialDiagnosticKind,
} from "./types.js";

const CURRENT_VERSION = 9;

// ─── Schema DDL ──────────────────────────────────────────────────────────────

const TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS topics (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    phase       INTEGER NOT NULL DEFAULT 1,
    goal        TEXT,
    deadline    TEXT,
    created_at  TEXT,
    last_session TEXT
  );

  CREATE TABLE IF NOT EXISTS concepts (
    id           TEXT PRIMARY KEY,
    topic_id     TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    difficulty   INTEGER NOT NULL DEFAULT 1,
    prerequisites TEXT NOT NULL DEFAULT '[]',
    tags         TEXT NOT NULL DEFAULT '[]',
    file_path    TEXT,
    status       TEXT NOT NULL DEFAULT 'unseen',
    ef           REAL NOT NULL DEFAULT 2.5,
    interval     INTEGER NOT NULL DEFAULT 0,
    repetitions  INTEGER NOT NULL DEFAULT 0,
    next_review  TEXT,
    last_grade   INTEGER,
    source       TEXT,
    source_id    TEXT,
    created_at   TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id         TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    mode             TEXT NOT NULL,
    started_at       TEXT,
    ended_at         TEXT,
    concepts_reviewed TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
    concept_id TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    grade      INTEGER NOT NULL,
    mode       TEXT NOT NULL,
    response   TEXT,
    feedback   TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS synced_gaps (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id    TEXT NOT NULL,
    skill     TEXT NOT NULL,
    frequency INTEGER NOT NULL DEFAULT 1,
    source    TEXT NOT NULL DEFAULT 'job-hunter',
    synced_at TEXT,
    UNIQUE(job_id, skill)
  );

  CREATE TABLE IF NOT EXISTS synced_signals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id   TEXT NOT NULL,
    title       TEXT NOT NULL,
    url         TEXT,
    score       REAL,
    concept_ids TEXT NOT NULL DEFAULT '[]',
    source      TEXT NOT NULL DEFAULT 'ai-feeds',
    synced_at   TEXT,
    UNIQUE(source_id, source)
  );

  CREATE TABLE IF NOT EXISTS problems (
    id           TEXT PRIMARY KEY,
    type         TEXT NOT NULL,
    title        TEXT NOT NULL,
    description  TEXT NOT NULL,
    difficulty   INTEGER NOT NULL DEFAULT 1,
    tags         TEXT NOT NULL DEFAULT '[]',
    test_cases   TEXT NOT NULL DEFAULT '[]',
    rubric       TEXT,
    concept_id   TEXT REFERENCES concepts(id) ON DELETE SET NULL,
    source       TEXT,
    external_id  TEXT
  );

  CREATE TABLE IF NOT EXISTS attempts (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_id          TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    response            TEXT NOT NULL,
    score               REAL,
    feedback            TEXT,
    time_spent_seconds  INTEGER,
    created_at          TEXT
  );
`;

// ─── Indexes ─────────────────────────────────────────────────────────────────

const INDEXES_SQL = `
  CREATE INDEX IF NOT EXISTS idx_concepts_topic_id   ON concepts(topic_id);
  CREATE INDEX IF NOT EXISTS idx_concepts_next_review ON concepts(next_review);
  CREATE INDEX IF NOT EXISTS idx_concepts_status      ON concepts(status);
  CREATE INDEX IF NOT EXISTS idx_sessions_topic_id    ON sessions(topic_id);
  CREATE INDEX IF NOT EXISTS idx_reviews_session_id   ON reviews(session_id);
  CREATE INDEX IF NOT EXISTS idx_reviews_concept_id   ON reviews(concept_id);
  CREATE INDEX IF NOT EXISTS idx_attempts_problem_id  ON attempts(problem_id);
  CREATE INDEX IF NOT EXISTS idx_synced_gaps_job_id   ON synced_gaps(job_id);
`;

// ─── Migrations ──────────────────────────────────────────────────────────────

type Migration = {
  version: number;
  up: (db: Database.Database) => void;
};

const migrations: Migration[] = [
  {
    version: 1,
    up: (db) => {
      db.exec(TABLES_SQL);
      db.exec(INDEXES_SQL);
    },
  },
  {
    version: 2,
    up: (db) => {
      db.transaction(() => {
        const unknownSessionModes = db
          .prepare(
            `SELECT DISTINCT mode FROM sessions
             WHERE mode NOT IN ('learn', 'practice', 'review', 'interview', 'mock', 'explore', 'quiz', 'teach-back')
             ORDER BY mode`,
          )
          .all() as Array<{ mode: string }>;
        const unknownReviewModes = db
          .prepare(
            `SELECT DISTINCT mode FROM reviews
             WHERE mode NOT IN ('learn', 'practice', 'review', 'interview', 'mock', 'explore', 'quiz', 'teach-back')
             ORDER BY mode`,
          )
          .all() as Array<{ mode: string }>;

        if (unknownSessionModes.length > 0 || unknownReviewModes.length > 0) {
          const details = [
            ...unknownSessionModes.map((row) => `sessions.mode=${row.mode}`),
            ...unknownReviewModes.map((row) => `reviews.mode=${row.mode}`),
          ];
          throw new Error(
            `Cannot migrate delivery context with unknown persisted values: ${details.join(", ")}`,
          );
        }

        db.exec(`
          UPDATE sessions
          SET mode = CASE mode
            WHEN 'explore' THEN 'learn'
            WHEN 'quiz' THEN 'review'
            WHEN 'teach-back' THEN 'practice'
            ELSE mode
          END
          WHERE mode IN ('explore', 'quiz', 'teach-back');

          UPDATE reviews
          SET mode = CASE mode
            WHEN 'explore' THEN 'learn'
            WHEN 'quiz' THEN 'review'
            WHEN 'teach-back' THEN 'practice'
            ELSE mode
          END
          WHERE mode IN ('explore', 'quiz', 'teach-back');
        `);
      })();
    },
  },
  {
    version: 3,
    up: (db) => {
      db.transaction(() => {
        db.exec(`
          CREATE TABLE capabilities (
            id          TEXT PRIMARY KEY,
            description TEXT NOT NULL,
            is_core     INTEGER NOT NULL CHECK (is_core IN (0, 1)),
            created_at  TEXT NOT NULL
          );

          CREATE TABLE learning_objectives (
            id            TEXT PRIMARY KEY,
            concept_id    TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
            capability_id TEXT NOT NULL REFERENCES capabilities(id) ON DELETE RESTRICT,
            created_at    TEXT NOT NULL,
            updated_at    TEXT NOT NULL,
            UNIQUE(concept_id, capability_id)
          );

          CREATE TABLE objective_projections (
            objective_id                  TEXT PRIMARY KEY REFERENCES learning_objectives(id) ON DELETE CASCADE,
            readiness                     TEXT NOT NULL DEFAULT 'unknown'
              CHECK (readiness IN ('unknown', 'exposed', 'guided', 'independent')),
            historical_highest_readiness  TEXT NOT NULL DEFAULT 'unknown'
              CHECK (historical_highest_readiness IN ('unknown', 'exposed', 'guided', 'independent')),
            transfer_state                TEXT NOT NULL DEFAULT 'untested'
              CHECK (transfer_state IN ('untested', 'not_demonstrated', 'demonstrated', 'contradicted')),
            durability_state              TEXT NOT NULL DEFAULT 'untested'
              CHECK (durability_state IN ('untested', 'not_demonstrated', 'demonstrated', 'contradicted')),
            blocking_misconception_count  INTEGER NOT NULL DEFAULT 0 CHECK (blocking_misconception_count >= 0),
            recent_failure                INTEGER NOT NULL DEFAULT 0 CHECK (recent_failure IN (0, 1)),
            last_qualifying_evidence_at   TEXT,
            last_event_seq                INTEGER NOT NULL DEFAULT 0 CHECK (last_event_seq >= 0),
            projector_version             TEXT NOT NULL DEFAULT 'v1',
            rebuilt_at                    TEXT NOT NULL
          );

          CREATE TABLE challenge_versions (
            challenge_id          TEXT NOT NULL,
            version               INTEGER NOT NULL CHECK (version > 0),
            source_problem_id     TEXT,
            public_prompt         TEXT NOT NULL,
            task_form             TEXT NOT NULL
              CHECK (task_form IN ('explanation', 'runtime_trace', 'implementation', 'debugging', 'design')),
            delivery_context      TEXT NOT NULL
              CHECK (delivery_context IN ('learn', 'practice', 'review', 'interview', 'mock')),
            time_budget_minutes   INTEGER CHECK (time_budget_minutes IS NULL OR time_budget_minutes > 0),
            rubric_id             TEXT NOT NULL,
            rubric_version        INTEGER NOT NULL CHECK (rubric_version > 0),
            hint_ladder_json      TEXT NOT NULL,
            verification_required INTEGER NOT NULL CHECK (verification_required IN (0, 1)),
            verification_basis    TEXT NOT NULL
              CHECK (verification_basis IN ('deterministic_execution', 'frozen_rubric', 'human', 'mixed')),
            private_solution_ref  TEXT,
            is_frozen             INTEGER NOT NULL DEFAULT 0 CHECK (is_frozen IN (0, 1)),
            created_at            TEXT NOT NULL,
            PRIMARY KEY(challenge_id, version)
          );

          CREATE TABLE challenge_targets (
            challenge_id       TEXT NOT NULL,
            version            INTEGER NOT NULL,
            objective_id       TEXT NOT NULL REFERENCES learning_objectives(id) ON DELETE RESTRICT,
            novelty            TEXT NOT NULL CHECK (novelty IN ('same', 'variant', 'transfer')),
            criterion_ids_json TEXT NOT NULL,
            position           INTEGER NOT NULL CHECK (position >= 0),
            PRIMARY KEY(challenge_id, version, objective_id),
            UNIQUE(challenge_id, version, position),
            FOREIGN KEY(challenge_id, version)
              REFERENCES challenge_versions(challenge_id, version) ON DELETE RESTRICT
          );

          CREATE TABLE challenge_criteria (
            challenge_id             TEXT NOT NULL,
            version                  INTEGER NOT NULL,
            criterion_id             TEXT NOT NULL,
            objective_id             TEXT NOT NULL,
            required                 INTEGER NOT NULL CHECK (required IN (0, 1)),
            description              TEXT NOT NULL,
            acceptable_variants_json TEXT NOT NULL DEFAULT '[]',
            position                 INTEGER NOT NULL CHECK (position >= 0),
            PRIMARY KEY(challenge_id, version, criterion_id),
            UNIQUE(challenge_id, version, position),
            FOREIGN KEY(challenge_id, version)
              REFERENCES challenge_versions(challenge_id, version) ON DELETE RESTRICT,
            FOREIGN KEY(challenge_id, version, objective_id)
              REFERENCES challenge_targets(challenge_id, version, objective_id) ON DELETE RESTRICT
          );

          CREATE TABLE attempts_v3 (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            problem_id          TEXT REFERENCES problems(id) ON DELETE CASCADE,
            challenge_id        TEXT,
            challenge_version   INTEGER,
            session_id          INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
            response_text       TEXT,
            artifact_ref_json   TEXT,
            score               REAL,
            feedback            TEXT,
            time_spent_seconds  INTEGER,
            started_at          TEXT NOT NULL,
            submitted_at        TEXT,
            created_at          TEXT NOT NULL,
            CHECK (
              (challenge_id IS NULL AND challenge_version IS NULL) OR
              (challenge_id IS NOT NULL AND challenge_version IS NOT NULL)
            ),
            FOREIGN KEY(challenge_id, challenge_version)
              REFERENCES challenge_versions(challenge_id, version) ON DELETE RESTRICT
          );

          INSERT INTO attempts_v3 (
            id,
            problem_id,
            response_text,
            score,
            feedback,
            time_spent_seconds,
            started_at,
            submitted_at,
            created_at
          )
          SELECT
            id,
            problem_id,
            response,
            score,
            feedback,
            time_spent_seconds,
            COALESCE(created_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            COALESCE(created_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            COALESCE(created_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
          FROM attempts;

          DROP TABLE attempts;
          ALTER TABLE attempts_v3 RENAME TO attempts;

          CREATE TABLE hint_observations (
            seq                INTEGER PRIMARY KEY AUTOINCREMENT,
            attempt_id         INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
            level              INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
            scope_kind         TEXT NOT NULL CHECK (scope_kind IN ('objective', 'criteria', 'all_targets')),
            objective_id       TEXT REFERENCES learning_objectives(id) ON DELETE RESTRICT,
            criterion_ids_json TEXT,
            recorded_at        TEXT NOT NULL,
            CHECK (
              (scope_kind = 'objective' AND objective_id IS NOT NULL AND criterion_ids_json IS NULL) OR
              (scope_kind = 'criteria' AND objective_id IS NULL AND criterion_ids_json IS NOT NULL) OR
              (scope_kind = 'all_targets' AND objective_id IS NULL AND criterion_ids_json IS NULL)
            )
          );

          CREATE TABLE exposure_events (
            seq               INTEGER PRIMARY KEY AUTOINCREMENT,
            objective_id      TEXT NOT NULL REFERENCES learning_objectives(id) ON DELETE RESTRICT,
            session_id        INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
            challenge_id      TEXT,
            challenge_version INTEGER,
            attempt_id        INTEGER REFERENCES attempts(id) ON DELETE SET NULL,
            exposure_type     TEXT NOT NULL CHECK (
              exposure_type IN (
                'explanation_shown',
                'answer_revealed',
                'worked_example_shown',
                'corrective_feedback_shown',
                'solution_walkthrough'
              )
            ),
            source_ref        TEXT,
            occurred_at       TEXT NOT NULL,
            CHECK (
              (challenge_id IS NULL AND challenge_version IS NULL) OR
              (challenge_id IS NOT NULL AND challenge_version IS NOT NULL)
            ),
            FOREIGN KEY(challenge_id, challenge_version)
              REFERENCES challenge_versions(challenge_id, version) ON DELETE RESTRICT
          );

          CREATE INDEX idx_learning_objectives_concept
            ON learning_objectives(concept_id);
          CREATE INDEX idx_learning_objectives_capability
            ON learning_objectives(capability_id);
          CREATE INDEX idx_challenge_targets_objective
            ON challenge_targets(objective_id, challenge_id, version);
          CREATE INDEX idx_attempts_problem_id
            ON attempts(problem_id);
          CREATE INDEX idx_attempts_challenge
            ON attempts(challenge_id, challenge_version);
          CREATE INDEX idx_attempts_session_id
            ON attempts(session_id);
          CREATE INDEX idx_hint_observations_attempt
            ON hint_observations(attempt_id, seq);
          CREATE INDEX idx_exposure_events_objective_time
            ON exposure_events(objective_id, occurred_at, seq);

          CREATE TRIGGER challenge_versions_no_update_after_freeze
          BEFORE UPDATE ON challenge_versions
          WHEN OLD.is_frozen = 1
          BEGIN
            SELECT RAISE(ABORT, 'frozen challenge versions are immutable');
          END;

          CREATE TRIGGER challenge_versions_no_delete_after_freeze
          BEFORE DELETE ON challenge_versions
          WHEN OLD.is_frozen = 1
          BEGIN
            SELECT RAISE(ABORT, 'frozen challenge versions are immutable');
          END;

          CREATE TRIGGER challenge_targets_no_insert_after_freeze
          BEFORE INSERT ON challenge_targets
          WHEN (
            SELECT is_frozen FROM challenge_versions
            WHERE challenge_id = NEW.challenge_id AND version = NEW.version
          ) = 1
          BEGIN
            SELECT RAISE(ABORT, 'frozen challenge targets are immutable');
          END;

          CREATE TRIGGER challenge_targets_no_update_after_freeze
          BEFORE UPDATE ON challenge_targets
          WHEN (
            SELECT is_frozen FROM challenge_versions
            WHERE challenge_id = OLD.challenge_id AND version = OLD.version
          ) = 1
          BEGIN
            SELECT RAISE(ABORT, 'frozen challenge targets are immutable');
          END;

          CREATE TRIGGER challenge_targets_no_delete_after_freeze
          BEFORE DELETE ON challenge_targets
          WHEN (
            SELECT is_frozen FROM challenge_versions
            WHERE challenge_id = OLD.challenge_id AND version = OLD.version
          ) = 1
          BEGIN
            SELECT RAISE(ABORT, 'frozen challenge targets are immutable');
          END;

          CREATE TRIGGER challenge_criteria_no_insert_after_freeze
          BEFORE INSERT ON challenge_criteria
          WHEN (
            SELECT is_frozen FROM challenge_versions
            WHERE challenge_id = NEW.challenge_id AND version = NEW.version
          ) = 1
          BEGIN
            SELECT RAISE(ABORT, 'frozen challenge criteria are immutable');
          END;

          CREATE TRIGGER challenge_criteria_no_update_after_freeze
          BEFORE UPDATE ON challenge_criteria
          WHEN (
            SELECT is_frozen FROM challenge_versions
            WHERE challenge_id = OLD.challenge_id AND version = OLD.version
          ) = 1
          BEGIN
            SELECT RAISE(ABORT, 'frozen challenge criteria are immutable');
          END;

          CREATE TRIGGER challenge_criteria_no_delete_after_freeze
          BEFORE DELETE ON challenge_criteria
          WHEN (
            SELECT is_frozen FROM challenge_versions
            WHERE challenge_id = OLD.challenge_id AND version = OLD.version
          ) = 1
          BEGIN
            SELECT RAISE(ABORT, 'frozen challenge criteria are immutable');
          END;

          CREATE TRIGGER attempts_require_frozen_challenge
          BEFORE INSERT ON attempts
          WHEN NEW.challenge_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM challenge_versions
            WHERE challenge_id = NEW.challenge_id
              AND version = NEW.challenge_version
              AND is_frozen = 1
          )
          BEGIN
            SELECT RAISE(ABORT, 'attempts require a frozen challenge version');
          END;

          CREATE TRIGGER attempts_challenge_identity_immutable
          BEFORE UPDATE OF challenge_id, challenge_version, started_at ON attempts
          BEGIN
            SELECT RAISE(ABORT, 'attempt challenge identity is immutable');
          END;

          CREATE TRIGGER attempts_submission_payload_immutable
          BEFORE UPDATE OF response_text, artifact_ref_json, submitted_at ON attempts
          WHEN OLD.submitted_at IS NOT NULL
          BEGIN
            SELECT RAISE(ABORT, 'submitted attempt work is immutable');
          END;

          CREATE TRIGGER hint_observations_require_challenge_attempt
          BEFORE INSERT ON hint_observations
          WHEN NOT EXISTS (
            SELECT 1 FROM attempts
            WHERE id = NEW.attempt_id AND challenge_id IS NOT NULL
          )
          BEGIN
            SELECT RAISE(ABORT, 'hint observations require a frozen challenge attempt');
          END;

          CREATE TRIGGER hint_observations_no_update
          BEFORE UPDATE ON hint_observations
          BEGIN
            SELECT RAISE(ABORT, 'hint observations are append-only');
          END;

          CREATE TRIGGER hint_observations_no_delete
          BEFORE DELETE ON hint_observations
          BEGIN
            SELECT RAISE(ABORT, 'hint observations are append-only');
          END;

          CREATE TRIGGER hint_observations_only_before_submission
          BEFORE INSERT ON hint_observations
          WHEN EXISTS (
            SELECT 1 FROM attempts
            WHERE id = NEW.attempt_id AND submitted_at IS NOT NULL
          )
          BEGIN
            SELECT RAISE(ABORT, 'cannot record hints after attempt submission');
          END;

          CREATE TRIGGER exposure_events_no_update
          BEFORE UPDATE ON exposure_events
          BEGIN
            SELECT RAISE(ABORT, 'exposure events are append-only');
          END;

          CREATE TRIGGER exposure_events_no_delete
          BEFORE DELETE ON exposure_events
          BEGIN
            SELECT RAISE(ABORT, 'exposure events are append-only');
          END;
        `);

        const createdAt = new Date().toISOString();
        const insertCapability = db.prepare(
          `INSERT INTO capabilities (id, description, is_core, created_at)
           VALUES (?, ?, 1, ?)`,
        );
        const capabilities = [
          ["explain", "State the mechanism and relevant boundaries."],
          ["predict", "Anticipate behavior before seeing the result."],
          ["implement", "Produce a correct working implementation."],
          ["debug", "Locate and repair a failure from symptoms and evidence."],
          ["design", "Choose and justify a solution under constraints."],
        ] as const;
        for (const [id, description] of capabilities) {
          insertCapability.run(id, description, createdAt);
        }
      })();
    },
  },
  {
    version: 4,
    up: (db) => {
      db.transaction(() => {
        db.exec(`
          ALTER TABLE attempts ADD COLUMN verification_output_json TEXT;

          CREATE TABLE evidence_events (
            seq                   INTEGER PRIMARY KEY AUTOINCREMENT,
            id                    TEXT NOT NULL UNIQUE,
            objective_id          TEXT NOT NULL REFERENCES learning_objectives(id) ON DELETE RESTRICT,
            supersedes_event_id   TEXT REFERENCES evidence_events(id) ON DELETE RESTRICT,
            session_id            INTEGER REFERENCES sessions(id) ON DELETE RESTRICT,
            problem_id            TEXT REFERENCES problems(id) ON DELETE RESTRICT,
            attempt_id            INTEGER REFERENCES attempts(id) ON DELETE RESTRICT,
            task_id               TEXT NOT NULL,
            task_version          INTEGER NOT NULL CHECK (task_version > 0),
            rubric_id             TEXT,
            rubric_version        INTEGER CHECK (rubric_version IS NULL OR rubric_version > 0),
            task_form             TEXT NOT NULL
              CHECK (task_form IN ('explanation', 'runtime_trace', 'implementation', 'debugging', 'design')),
            delivery_context      TEXT NOT NULL
              CHECK (delivery_context IN ('learn', 'practice', 'review', 'interview', 'mock')),
            result                TEXT NOT NULL
              CHECK (result IN ('correct', 'partially_correct', 'incorrect', 'ungradable')),
            hint_level            INTEGER NOT NULL CHECK (hint_level BETWEEN 0 AND 5),
            novelty               TEXT NOT NULL CHECK (novelty IN ('same', 'variant', 'transfer')),
            retrieval_valid       INTEGER NOT NULL CHECK (retrieval_valid IN (0, 1)),
            delay_anchor_at       TEXT,
            delay_seconds         INTEGER CHECK (delay_seconds IS NULL OR delay_seconds >= 0),
            assessment_basis      TEXT NOT NULL
              CHECK (assessment_basis IN ('deterministic_execution', 'frozen_rubric', 'human', 'mixed')),
            evaluator_type        TEXT NOT NULL
              CHECK (evaluator_type IN ('kernel', 'agent', 'llm', 'human')),
            criteria_json         TEXT NOT NULL,
            observed_errors_json TEXT NOT NULL DEFAULT '[]',
            rationale             TEXT NOT NULL,
            performed_at          TEXT NOT NULL,
            created_at            TEXT NOT NULL
          );

          CREATE TABLE evidence_revisions (
            seq               INTEGER PRIMARY KEY AUTOINCREMENT,
            evidence_event_id TEXT NOT NULL REFERENCES evidence_events(id) ON DELETE RESTRICT,
            action            TEXT NOT NULL CHECK (action IN ('invalidate', 'restore')),
            reason            TEXT NOT NULL,
            created_at        TEXT NOT NULL
          );

          CREATE TABLE misconceptions (
            id                  TEXT PRIMARY KEY,
            concept_id          TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
            description         TEXT NOT NULL,
            correction_strategy TEXT,
            is_blocking         INTEGER NOT NULL CHECK (is_blocking IN (0, 1)),
            created_at          TEXT NOT NULL
          );

          CREATE TABLE misconception_observations (
            seq               INTEGER PRIMARY KEY AUTOINCREMENT,
            misconception_id  TEXT NOT NULL REFERENCES misconceptions(id) ON DELETE RESTRICT,
            objective_id      TEXT NOT NULL REFERENCES learning_objectives(id) ON DELETE RESTRICT,
            evidence_event_id TEXT NOT NULL REFERENCES evidence_events(id) ON DELETE RESTRICT,
            disposition       TEXT NOT NULL CHECK (disposition IN ('observed', 'cleared')),
            created_at        TEXT NOT NULL
          );

          CREATE TABLE weakness_projections (
            key               TEXT PRIMARY KEY,
            objective_id      TEXT NOT NULL REFERENCES learning_objectives(id) ON DELETE CASCADE,
            category          TEXT NOT NULL,
            lifecycle         TEXT NOT NULL
              CHECK (lifecycle IN ('new', 'recurring', 'improving', 'resolved', 'retest')),
            last_event_seq    INTEGER NOT NULL CHECK (last_event_seq >= 0),
            projector_version TEXT NOT NULL,
            rebuilt_at        TEXT NOT NULL,
            UNIQUE(objective_id, category)
          );

          CREATE INDEX idx_evidence_objective_performed
            ON evidence_events(objective_id, performed_at, seq);
          CREATE INDEX idx_evidence_objective_created
            ON evidence_events(objective_id, created_at);
          CREATE INDEX idx_evidence_attempt_objective
            ON evidence_events(attempt_id, objective_id);
          CREATE INDEX idx_evidence_retrieval_objective
            ON evidence_events(retrieval_valid, objective_id);
          CREATE INDEX idx_evidence_revisions_event
            ON evidence_revisions(evidence_event_id, seq);
          CREATE INDEX idx_misconception_observations_objective
            ON misconception_observations(objective_id, seq);
          CREATE INDEX idx_misconception_observations_evidence
            ON misconception_observations(evidence_event_id, seq);
          CREATE INDEX idx_weakness_projections_objective
            ON weakness_projections(objective_id);

          CREATE TRIGGER evidence_events_no_update
          BEFORE UPDATE ON evidence_events
          BEGIN
            SELECT RAISE(ABORT, 'evidence events are append-only');
          END;

          CREATE TRIGGER evidence_events_no_delete
          BEFORE DELETE ON evidence_events
          BEGIN
            SELECT RAISE(ABORT, 'evidence events are append-only');
          END;

          CREATE TRIGGER evidence_events_snapshot_matches_attempt
          BEFORE INSERT ON evidence_events
          WHEN NEW.attempt_id IS NOT NULL AND NOT EXISTS (
            SELECT 1
            FROM attempts attempt
            JOIN challenge_versions challenge
              ON challenge.challenge_id = attempt.challenge_id
             AND challenge.version = attempt.challenge_version
             AND challenge.is_frozen = 1
            JOIN challenge_targets target
              ON target.challenge_id = challenge.challenge_id
             AND target.version = challenge.version
             AND target.objective_id = NEW.objective_id
            WHERE attempt.id = NEW.attempt_id
              AND attempt.challenge_id = NEW.task_id
              AND attempt.challenge_version = NEW.task_version
              AND challenge.rubric_id = NEW.rubric_id
              AND challenge.rubric_version = NEW.rubric_version
              AND challenge.task_form = NEW.task_form
              AND challenge.delivery_context = NEW.delivery_context
              AND target.novelty = NEW.novelty
              AND (NEW.session_id IS attempt.session_id OR NEW.session_id = attempt.session_id)
              AND (
                NEW.problem_id = challenge.source_problem_id OR
                (
                  NEW.problem_id IS NULL AND
                  (
                    challenge.source_problem_id IS NULL OR
                    NOT EXISTS (
                      SELECT 1 FROM problems source_problem
                      WHERE source_problem.id = challenge.source_problem_id
                    )
                  )
                )
              )
          )
          BEGIN
            SELECT RAISE(ABORT, 'evidence snapshot must match the frozen challenge attempt');
          END;

          CREATE TRIGGER evidence_events_single_effective_attempt_objective
          BEFORE INSERT ON evidence_events
          WHEN NEW.attempt_id IS NOT NULL AND EXISTS (
            SELECT 1
            FROM evidence_events existing
            WHERE existing.attempt_id = NEW.attempt_id
              AND existing.objective_id = NEW.objective_id
              AND COALESCE((
                SELECT revision.action
                FROM evidence_revisions revision
                WHERE revision.evidence_event_id = existing.id
                ORDER BY revision.seq DESC
                LIMIT 1
              ), 'restore') <> 'invalidate'
          )
          BEGIN
            SELECT RAISE(ABORT, 'attempt objective already has effective evidence');
          END;

          CREATE TRIGGER evidence_revisions_no_update
          BEFORE UPDATE ON evidence_revisions
          BEGIN
            SELECT RAISE(ABORT, 'evidence revisions are append-only');
          END;

          CREATE TRIGGER evidence_revisions_no_delete
          BEFORE DELETE ON evidence_revisions
          BEGIN
            SELECT RAISE(ABORT, 'evidence revisions are append-only');
          END;

          CREATE TRIGGER evidence_revisions_restore_conflict
          BEFORE INSERT ON evidence_revisions
          WHEN NEW.action = 'restore' AND EXISTS (
            SELECT 1
            FROM evidence_events target
            JOIN evidence_events other
              ON other.attempt_id = target.attempt_id
             AND other.objective_id = target.objective_id
             AND other.id <> target.id
            WHERE target.id = NEW.evidence_event_id
              AND target.attempt_id IS NOT NULL
              AND COALESCE((
                SELECT revision.action
                FROM evidence_revisions revision
                WHERE revision.evidence_event_id = other.id
                ORDER BY revision.seq DESC
                LIMIT 1
              ), 'restore') <> 'invalidate'
          )
          BEGIN
            SELECT RAISE(ABORT, 'restoring evidence would create conflicting effective evidence');
          END;

          CREATE TRIGGER misconception_observations_no_update
          BEFORE UPDATE ON misconception_observations
          BEGIN
            SELECT RAISE(ABORT, 'misconception observations are append-only');
          END;

          CREATE TRIGGER misconception_observations_no_delete
          BEFORE DELETE ON misconception_observations
          BEGIN
            SELECT RAISE(ABORT, 'misconception observations are append-only');
          END;

          CREATE TRIGGER misconception_observations_match_evidence_objective
          BEFORE INSERT ON misconception_observations
          WHEN NOT EXISTS (
            SELECT 1
            FROM evidence_events evidence
            WHERE evidence.id = NEW.evidence_event_id
              AND evidence.objective_id = NEW.objective_id
          )
          BEGIN
            SELECT RAISE(ABORT, 'misconception observation objective must match source evidence');
          END;

          CREATE TRIGGER attempts_verification_requires_submission
          BEFORE UPDATE OF verification_output_json ON attempts
          WHEN NEW.verification_output_json IS NOT NULL AND NEW.submitted_at IS NULL
          BEGIN
            SELECT RAISE(ABORT, 'verification output requires a submitted attempt');
          END;

          CREATE TRIGGER attempts_verification_output_immutable
          BEFORE UPDATE OF verification_output_json ON attempts
          WHEN OLD.verification_output_json IS NOT NULL
          BEGIN
            SELECT RAISE(ABORT, 'attempt verification output is immutable once recorded');
          END;
        `);
      })();
    },
  },
  {
    version: 5,
    up: (db) => {
      db.transaction(() => {
        db.exec(`
          CREATE TABLE review_events (
            seq               INTEGER PRIMARY KEY AUTOINCREMENT,
            objective_id      TEXT NOT NULL REFERENCES learning_objectives(id) ON DELETE RESTRICT,
            evidence_event_id TEXT NOT NULL UNIQUE REFERENCES evidence_events(id) ON DELETE RESTRICT,
            rating            TEXT NOT NULL CHECK (rating IN ('Again', 'Hard', 'Good')),
            mapper_version    TEXT NOT NULL,
            reviewed_at       TEXT NOT NULL,
            scheduler_version TEXT NOT NULL,
            parameters_json   TEXT NOT NULL
          );

          CREATE TABLE review_cards (
            objective_id      TEXT PRIMARY KEY REFERENCES learning_objectives(id) ON DELETE CASCADE,
            due_at            TEXT NOT NULL,
            card_json         TEXT NOT NULL,
            last_rating       TEXT CHECK (last_rating IS NULL OR last_rating IN ('Again', 'Hard', 'Good')),
            source_review_seq INTEGER NOT NULL CHECK (source_review_seq > 0),
            scheduler_version TEXT NOT NULL,
            updated_at        TEXT NOT NULL
          );

          CREATE INDEX idx_review_events_objective_time
            ON review_events(objective_id, reviewed_at, seq);
          CREATE INDEX idx_review_cards_due
            ON review_cards(due_at, objective_id);

          CREATE TRIGGER review_events_no_update
          BEFORE UPDATE ON review_events
          BEGIN
            SELECT RAISE(ABORT, 'review events are append-only');
          END;

          CREATE TRIGGER review_events_no_delete
          BEFORE DELETE ON review_events
          BEGIN
            SELECT RAISE(ABORT, 'review events are append-only');
          END;

          CREATE TRIGGER review_events_match_source_evidence
          BEFORE INSERT ON review_events
          WHEN NOT EXISTS (
            SELECT 1
            FROM evidence_events evidence
            WHERE evidence.id = NEW.evidence_event_id
              AND evidence.objective_id = NEW.objective_id
              AND evidence.performed_at = NEW.reviewed_at
              AND evidence.retrieval_valid = 1
              AND evidence.result <> 'ungradable'
          )
          BEGIN
            SELECT RAISE(ABORT, 'review event must match qualifying source evidence');
          END;
        `);
      })();
    },
  },
  {
    version: 6,
    up: (db) => {
      db.transaction(() => {
        db.exec(`
          ALTER TABLE sessions ADD COLUMN phase TEXT NOT NULL DEFAULT 'idle'
            CHECK (phase IN (
              'idle',
              'challenge_prepared',
              'awaiting_response',
              'awaiting_verification',
              'awaiting_assessment',
              'feedback',
              'complete'
            ));
          ALTER TABLE sessions ADD COLUMN pending_action TEXT NOT NULL DEFAULT 'none'
            CHECK (pending_action IN (
              'none',
              'collect_response',
              'run_verification',
              'assess_response',
              'present_feedback'
            ));
          ALTER TABLE sessions ADD COLUMN active_challenge_id TEXT;
          ALTER TABLE sessions ADD COLUMN active_challenge_version INTEGER;
          ALTER TABLE sessions ADD COLUMN active_attempt_id INTEGER REFERENCES attempts(id) ON DELETE SET NULL;

          UPDATE sessions
          SET phase = CASE
                WHEN ended_at IS NULL THEN 'idle'
                WHEN EXISTS (
                  SELECT 1
                  FROM attempts attempt
                  JOIN challenge_versions challenge
                    ON challenge.challenge_id = attempt.challenge_id
                   AND challenge.version = attempt.challenge_version
                  WHERE attempt.session_id = sessions.id
                    AND attempt.submitted_at IS NOT NULL
                    AND challenge.verification_required = 1
                    AND attempt.verification_output_json IS NULL
                    AND (
                      SELECT COUNT(*)
                      FROM challenge_targets target
                      WHERE target.challenge_id = attempt.challenge_id
                        AND target.version = attempt.challenge_version
                    ) > (
                      SELECT COUNT(DISTINCT evidence.objective_id)
                      FROM evidence_events evidence
                      WHERE evidence.attempt_id = attempt.id
                        AND COALESCE((
                          SELECT revision.action
                          FROM evidence_revisions revision
                          WHERE revision.evidence_event_id = evidence.id
                          ORDER BY revision.seq DESC
                          LIMIT 1
                        ), 'restore') <> 'invalidate'
                    )
                ) THEN 'awaiting_verification'
                WHEN EXISTS (
                  SELECT 1
                  FROM attempts attempt
                  WHERE attempt.session_id = sessions.id
                    AND attempt.submitted_at IS NOT NULL
                    AND attempt.challenge_id IS NOT NULL
                    AND (
                      SELECT COUNT(*)
                      FROM challenge_targets target
                      WHERE target.challenge_id = attempt.challenge_id
                        AND target.version = attempt.challenge_version
                    ) > (
                      SELECT COUNT(DISTINCT evidence.objective_id)
                      FROM evidence_events evidence
                      WHERE evidence.attempt_id = attempt.id
                        AND COALESCE((
                          SELECT revision.action
                          FROM evidence_revisions revision
                          WHERE revision.evidence_event_id = evidence.id
                          ORDER BY revision.seq DESC
                          LIMIT 1
                        ), 'restore') <> 'invalidate'
                    )
                ) THEN 'awaiting_assessment'
                ELSE 'complete'
              END,
              pending_action = CASE
                WHEN ended_at IS NULL THEN 'none'
                WHEN EXISTS (
                  SELECT 1
                  FROM attempts attempt
                  JOIN challenge_versions challenge
                    ON challenge.challenge_id = attempt.challenge_id
                   AND challenge.version = attempt.challenge_version
                  WHERE attempt.session_id = sessions.id
                    AND attempt.submitted_at IS NOT NULL
                    AND challenge.verification_required = 1
                    AND attempt.verification_output_json IS NULL
                    AND (
                      SELECT COUNT(*) FROM challenge_targets target
                      WHERE target.challenge_id = attempt.challenge_id
                        AND target.version = attempt.challenge_version
                    ) > (
                      SELECT COUNT(DISTINCT evidence.objective_id)
                      FROM evidence_events evidence
                      WHERE evidence.attempt_id = attempt.id
                        AND COALESCE((
                          SELECT revision.action FROM evidence_revisions revision
                          WHERE revision.evidence_event_id = evidence.id
                          ORDER BY revision.seq DESC LIMIT 1
                        ), 'restore') <> 'invalidate'
                    )
                ) THEN 'run_verification'
                WHEN EXISTS (
                  SELECT 1 FROM attempts attempt
                  WHERE attempt.session_id = sessions.id
                    AND attempt.submitted_at IS NOT NULL
                    AND attempt.challenge_id IS NOT NULL
                    AND (
                      SELECT COUNT(*) FROM challenge_targets target
                      WHERE target.challenge_id = attempt.challenge_id
                        AND target.version = attempt.challenge_version
                    ) > (
                      SELECT COUNT(DISTINCT evidence.objective_id)
                      FROM evidence_events evidence
                      WHERE evidence.attempt_id = attempt.id
                        AND COALESCE((
                          SELECT revision.action FROM evidence_revisions revision
                          WHERE revision.evidence_event_id = evidence.id
                          ORDER BY revision.seq DESC LIMIT 1
                        ), 'restore') <> 'invalidate'
                    )
                ) THEN 'assess_response'
                ELSE 'none'
              END,
              active_challenge_id = NULL,
              active_challenge_version = NULL,
              active_attempt_id = NULL;
        `);
      })();
    },
  },
  {
    version: 7,
    up: (db) => {
      db.transaction(() => {
        db.exec(`
          CREATE TABLE goal_objectives (
            goal_id            TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
            objective_id       TEXT NOT NULL REFERENCES learning_objectives(id) ON DELETE CASCADE,
            is_active          INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
            importance         TEXT NOT NULL CHECK (importance IN ('core', 'important', 'supporting')),
            target_readiness   TEXT NOT NULL CHECK (target_readiness IN ('guided', 'independent')),
            require_transfer   INTEGER NOT NULL DEFAULT 0 CHECK (require_transfer IN (0, 1)),
            require_durability INTEGER NOT NULL DEFAULT 0 CHECK (require_durability IN (0, 1)),
            created_at         TEXT NOT NULL,
            updated_at         TEXT NOT NULL,
            PRIMARY KEY(goal_id, objective_id)
          );

          CREATE INDEX idx_goal_objectives_active
            ON goal_objectives(goal_id, is_active, importance, objective_id);
          CREATE INDEX idx_goal_objectives_objective
            ON goal_objectives(objective_id, goal_id);
        `);
      })();
    },
  },
  {
    version: 8,
    up: (db) => {
      db.transaction(() => {
        db.exec(`
          ALTER TABLE goal_objectives ADD COLUMN preparation_strategy TEXT
            CHECK (preparation_strategy IS NULL OR preparation_strategy IN ('learn', 'refresh', 'diagnose_first', 'transfer_practice'));
          ALTER TABLE goal_objectives ADD COLUMN initial_diagnostic_kind TEXT
            CHECK (initial_diagnostic_kind IS NULL OR initial_diagnostic_kind IN ('baseline', 'refresh_check', 'strength_check', 'prerequisite_check', 'transfer_check'));

          CREATE TABLE goal_preparation (
            goal_id           TEXT PRIMARY KEY REFERENCES topics(id) ON DELETE CASCADE,
            purpose           TEXT NOT NULL CHECK (purpose IN ('interview', 'role_readiness', 'long_term_mastery')),
            target_role       TEXT,
            target_outcome    TEXT,
            minutes_per_day   INTEGER CHECK (minutes_per_day IS NULL OR minutes_per_day > 0),
            days_per_week     INTEGER CHECK (days_per_week IS NULL OR (days_per_week BETWEEN 1 AND 7)),
            minutes_per_week  INTEGER CHECK (minutes_per_week IS NULL OR minutes_per_week > 0),
            confirmed_at      TEXT NOT NULL,
            created_at        TEXT NOT NULL,
            updated_at        TEXT NOT NULL
          );
        `);
      })();
    },
  },
  {
    version: 9,
    up: (db) => {
      db.transaction(() => {
        db.exec(`
          ALTER TABLE goal_preparation ADD COLUMN active_focus_label TEXT;
          ALTER TABLE goal_preparation ADD COLUMN active_focus_objective_ids TEXT NOT NULL DEFAULT '[]';
        `);
      })();
    },
  },
];

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create (or open) the SQLite database at the given path, enable WAL mode,
 * run any pending migrations, and return the database instance.
 */
export function createDatabase(dbPath: string): Database.Database {
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  let db: Database.Database;
  try {
    db = new Database(dbPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Could not locate the bindings file") || message.includes("better_sqlite3.node")) {
      throw new Error(
        "Learning OS could not load the better-sqlite3 native binding. Reinstall dependencies with lifecycle scripts enabled (run `npm ci` from the repository root).",
      );
    }
    throw err;
  }

  // Performance pragmas
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");

  migrate(db);

  return db;
}

/**
 * Run all pending migrations against the database.  Uses PRAGMA user_version
 * to track which migrations have already been applied.
 */
export function migrate(db: Database.Database): void {
  const currentVersion = db.pragma("user_version", { simple: true }) as number;

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      migration.up(db);
      db.pragma(`user_version = ${migration.version}`);
    }
  }
}

// ─── CRUD: Topics ─────────────────────────────────────────────────────────

export function createTopic(
  db: Database.Database,
  input: { id: string; name: string; goal?: string; deadline?: string },
): Topic {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO topics (id, name, goal, deadline, created_at)
     VALUES (@id, @name, @goal, @deadline, @created_at)`,
  ).run({
    id: input.id,
    name: input.name,
    goal: input.goal ?? null,
    deadline: input.deadline ?? null,
    created_at: now,
  });
  return getTopic(db, input.id)!;
}

export function getTopic(
  db: Database.Database,
  id: string,
): Topic | undefined {
  return db.prepare(`SELECT * FROM topics WHERE id = ?`).get(id) as
    | Topic
    | undefined;
}

export function listTopics(db: Database.Database): Topic[] {
  return db.prepare(`SELECT * FROM topics ORDER BY created_at DESC`).all() as Topic[];
}

export function updateTopic(
  db: Database.Database,
  id: string,
  updates: Partial<Pick<Topic, "name" | "goal" | "deadline" | "phase" | "last_session">>,
): void {
  const allowed = ["name", "goal", "deadline", "phase", "last_session"] as const;
  const entries = Object.entries(updates).filter(([k]) =>
    (allowed as readonly string[]).includes(k),
  );
  if (entries.length === 0) return;
  const sets = entries.map(([k]) => `${k} = @${k}`).join(", ");
  db.prepare(`UPDATE topics SET ${sets} WHERE id = @id`).run({ id, ...Object.fromEntries(entries) });
}

// ─── CRUD: Goal objectives ─────────────────────────────────────────────────

export interface SetGoalObjectiveInput {
  goalId: string;
  objectiveId: string;
  isActive?: boolean;
  importance?: GoalImportance;
  targetReadiness?: GoalTargetReadiness;
  requireTransfer?: boolean;
  requireDurability?: boolean;
  preparationStrategy?: PreparationStrategy;
  initialDiagnosticKind?: InitialDiagnosticKind;
}

export function setGoalObjective(
  db: Database.Database,
  input: SetGoalObjectiveInput,
): GoalObjective {
  if (!getTopic(db, input.goalId)) {
    throw new Error(`Goal topic not found: ${input.goalId}`);
  }

  const objectiveExists = db
    .prepare(`SELECT 1 FROM learning_objectives WHERE id = ?`)
    .get(input.objectiveId);
  if (!objectiveExists) {
    throw new Error(`Learning objective not found: ${input.objectiveId}`);
  }

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO goal_objectives (
       goal_id,
       objective_id,
       is_active,
       importance,
       target_readiness,
       require_transfer,
       require_durability,
       preparation_strategy,
       initial_diagnostic_kind,
       created_at,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(goal_id, objective_id) DO UPDATE SET
       is_active = excluded.is_active,
       importance = excluded.importance,
       target_readiness = excluded.target_readiness,
       require_transfer = excluded.require_transfer,
       require_durability = excluded.require_durability,
       preparation_strategy = COALESCE(excluded.preparation_strategy, goal_objectives.preparation_strategy),
       initial_diagnostic_kind = COALESCE(excluded.initial_diagnostic_kind, goal_objectives.initial_diagnostic_kind),
       updated_at = excluded.updated_at`,
  ).run(
    input.goalId,
    input.objectiveId,
    input.isActive === false ? 0 : 1,
    input.importance ?? "important",
    input.targetReadiness ?? "independent",
    input.requireTransfer ? 1 : 0,
    input.requireDurability ? 1 : 0,
    input.preparationStrategy ?? null,
    input.initialDiagnosticKind ?? null,
    now,
    now,
  );

  return getGoalObjective(db, input.goalId, input.objectiveId)!;
}

export function getGoalObjective(
  db: Database.Database,
  goalId: string,
  objectiveId: string,
): GoalObjective | undefined {
  const row = db
    .prepare(`SELECT * FROM goal_objectives WHERE goal_id = ? AND objective_id = ?`)
    .get(goalId, objectiveId);
  return row === undefined ? undefined : GoalObjectiveSchema.parse(row);
}

export function getGoalObjectives(
  db: Database.Database,
  goalId: string,
  options: { includeInactive?: boolean } = {},
): GoalObjective[] {
  const rows = options.includeInactive
    ? db
        .prepare(
          `SELECT * FROM goal_objectives
           WHERE goal_id = ?
           ORDER BY CASE importance WHEN 'core' THEN 0 WHEN 'important' THEN 1 ELSE 2 END,
                    objective_id`,
        )
        .all(goalId)
    : db
        .prepare(
          `SELECT * FROM goal_objectives
           WHERE goal_id = ? AND is_active = 1
           ORDER BY CASE importance WHEN 'core' THEN 0 WHEN 'important' THEN 1 ELSE 2 END,
                    objective_id`,
        )
        .all(goalId);
  return GoalObjectiveSchema.array().parse(rows);
}

export interface SetGoalPreparationInput {
  goalId: string;
  purpose: PreparationPurpose;
  targetRole?: string | null;
  targetOutcome?: string | null;
  minutesPerDay?: number | null;
  daysPerWeek?: number | null;
  minutesPerWeek?: number | null;
  confirmedAt: string;
}

export function setGoalPreparation(
  db: Database.Database,
  input: SetGoalPreparationInput,
): GoalPreparation {
  if (!getTopic(db, input.goalId)) {
    throw new Error(`Goal topic not found: ${input.goalId}`);
  }
  const confirmedAt = new Date(input.confirmedAt);
  if (Number.isNaN(confirmedAt.getTime())) {
    throw new Error(`Invalid onboarding confirmation time: ${input.confirmedAt}`);
  }
  for (const [label, value] of [
    ["minutesPerDay", input.minutesPerDay],
    ["minutesPerWeek", input.minutesPerWeek],
  ] as const) {
    if (value !== undefined && value !== null && (!Number.isInteger(value) || value <= 0)) {
      throw new Error(`${label} must be a positive integer when provided`);
    }
  }
  if (
    input.daysPerWeek !== undefined &&
    input.daysPerWeek !== null &&
    (!Number.isInteger(input.daysPerWeek) || input.daysPerWeek < 1 || input.daysPerWeek > 7)
  ) {
    throw new Error("daysPerWeek must be an integer from 1 to 7 when provided");
  }
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO goal_preparation (
       goal_id,
       purpose,
       target_role,
       target_outcome,
       minutes_per_day,
       days_per_week,
       minutes_per_week,
       confirmed_at,
       created_at,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(goal_id) DO UPDATE SET
       purpose = excluded.purpose,
       target_role = excluded.target_role,
       target_outcome = excluded.target_outcome,
       minutes_per_day = excluded.minutes_per_day,
       days_per_week = excluded.days_per_week,
       minutes_per_week = excluded.minutes_per_week,
       confirmed_at = excluded.confirmed_at,
       updated_at = excluded.updated_at`,
  ).run(
    input.goalId,
    input.purpose,
    input.targetRole ?? null,
    input.targetOutcome ?? null,
    input.minutesPerDay ?? null,
    input.daysPerWeek ?? null,
    input.minutesPerWeek ?? null,
    confirmedAt.toISOString(),
    now,
    now,
  );
  return getGoalPreparation(db, input.goalId)!;
}

export function getGoalPreparation(
  db: Database.Database,
  goalId: string,
): GoalPreparation | undefined {
  const row = db.prepare(`SELECT * FROM goal_preparation WHERE goal_id = ?`).get(goalId);
  return row === undefined ? undefined : GoalPreparationSchema.parse(row);
}

export interface SetGoalStudyFocusInput {
  goalId: string;
  label?: string | null;
  objectiveIds: readonly string[];
}

export function setGoalStudyFocus(
  db: Database.Database,
  input: SetGoalStudyFocusInput,
): GoalPreparation {
  const preparation = getGoalPreparation(db, input.goalId);
  if (!preparation) {
    throw new Error(`Goal preparation not found: ${input.goalId}`);
  }
  const objectiveIds = [...new Set(input.objectiveIds)];
  if (objectiveIds.length === 0) {
    throw new Error("Study focus requires at least one active goal objective");
  }
  const activeObjectiveIds = new Set(
    getGoalObjectives(db, input.goalId).map((objective) => objective.objective_id),
  );
  for (const objectiveId of objectiveIds) {
    if (!activeObjectiveIds.has(objectiveId)) {
      throw new Error(`Study focus objective is not active for goal ${input.goalId}: ${objectiveId}`);
    }
  }
  const label = input.label?.trim() || null;
  db.prepare(
    `UPDATE goal_preparation
     SET active_focus_label = ?, active_focus_objective_ids = ?, updated_at = ?
     WHERE goal_id = ?`,
  ).run(label, JSON.stringify(objectiveIds), new Date().toISOString(), input.goalId);
  return getGoalPreparation(db, input.goalId)!;
}

export function clearGoalStudyFocus(
  db: Database.Database,
  goalId: string,
): GoalPreparation {
  if (!getGoalPreparation(db, goalId)) {
    throw new Error(`Goal preparation not found: ${goalId}`);
  }
  db.prepare(
    `UPDATE goal_preparation
     SET active_focus_label = NULL, active_focus_objective_ids = '[]', updated_at = ?
     WHERE goal_id = ?`,
  ).run(new Date().toISOString(), goalId);
  return getGoalPreparation(db, goalId)!;
}

// ─── CRUD: Concepts ───────────────────────────────────────────────────────

export function createConcept(
  db: Database.Database,
  input: {
    id: string;
    topicId: string;
    title: string;
    difficulty?: number;
    prerequisites?: string[];
    tags?: string[];
    source?: string;
    sourceId?: string;
  },
): Concept {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO concepts (id, topic_id, title, difficulty, prerequisites, tags, source, source_id, created_at)
     VALUES (@id, @topic_id, @title, @difficulty, @prerequisites, @tags, @source, @source_id, @created_at)`,
  ).run({
    id: input.id,
    topic_id: input.topicId,
    title: input.title,
    difficulty: input.difficulty ?? 1,
    prerequisites: JSON.stringify(input.prerequisites ?? []),
    tags: JSON.stringify(input.tags ?? []),
    source: input.source ?? null,
    source_id: input.sourceId ?? null,
    created_at: now,
  });
  return getConcept(db, input.id)!;
}

/**
 * Parse JSON fields in a concept row.
 * SQLite stores JSON arrays as TEXT, so we need to parse them.
 */
function parseConcept(row: any): Concept {
  if (!row) return row;
  return {
    ...row,
    prerequisites: typeof row.prerequisites === 'string' ? JSON.parse(row.prerequisites) : row.prerequisites ?? [],
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags ?? [],
  };
}

export function getConcept(
  db: Database.Database,
  id: string,
): Concept | undefined {
  const row = db.prepare(`SELECT * FROM concepts WHERE id = ?`).get(id);
  return parseConcept(row) as Concept | undefined;
}

export function getConceptsByTopic(
  db: Database.Database,
  topicId: string,
): Concept[] {
  const rows = db
    .prepare(`SELECT * FROM concepts WHERE topic_id = ? ORDER BY created_at`)
    .all(topicId);
  return rows.map(parseConcept) as Concept[];
}

export function updateConcept(
  db: Database.Database,
  id: string,
  updates: Partial<
    Pick<
      Concept,
      | "title"
      | "difficulty"
      | "prerequisites"
      | "tags"
      | "file_path"
      | "status"
      | "ef"
      | "interval"
      | "repetitions"
      | "next_review"
      | "last_grade"
      | "source"
      | "source_id"
    >
  >,
): void {
  const allowed = [
    "title",
    "difficulty",
    "prerequisites",
    "tags",
    "file_path",
    "status",
    "ef",
    "interval",
    "repetitions",
    "next_review",
    "last_grade",
    "source",
    "source_id",
  ] as const;
  const entries = Object.entries(updates).filter(([k]) =>
    (allowed as readonly string[]).includes(k),
  );
  if (entries.length === 0) return;
  const serialised = entries.map(([k, v]) => {
    if ((k === "prerequisites" || k === "tags") && Array.isArray(v)) {
      return [k, JSON.stringify(v)];
    }
    return [k, v];
  });
  const sets = serialised.map(([k]) => `${k} = @${k}`).join(", ");
  db.prepare(`UPDATE concepts SET ${sets} WHERE id = @id`).run({
    id,
    ...Object.fromEntries(serialised),
  });
}

// ─── CRUD: Sessions ───────────────────────────────────────────────────────

export function createSession(
  db: Database.Database,
  input: { topicId: string; mode: DeliveryContext },
): Session {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO sessions (topic_id, mode, started_at)
       VALUES (@topic_id, @mode, @started_at)`,
    )
    .run({
      topic_id: input.topicId,
      mode: input.mode,
      started_at: now,
    });
  return getSession(db, Number(info.lastInsertRowid))!;
}

export function getSession(
  db: Database.Database,
  id: number,
): Session | undefined {
  const row = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id);
  return row === undefined ? undefined : SessionSchema.parse(row);
}

export function updateSession(
  db: Database.Database,
  id: number,
  updates: { endedAt?: string; conceptsReviewed?: string[] },
): void {
  const entries: [string, unknown][] = [];
  if (updates.endedAt !== undefined) {
    entries.push(["ended_at", updates.endedAt]);
  }
  if (updates.conceptsReviewed !== undefined) {
    entries.push(["concepts_reviewed", JSON.stringify(updates.conceptsReviewed)]);
  }
  if (entries.length === 0) return;
  const sets = entries.map(([k]) => `${k} = @${k}`).join(", ");
  db.prepare(`UPDATE sessions SET ${sets} WHERE id = @id`).run({
    id,
    ...Object.fromEntries(entries),
  });
}

// ─── CRUD: Reviews ────────────────────────────────────────────────────────

export function createReview(
  db: Database.Database,
  input: {
    sessionId: number | null;
    conceptId: string;
    grade: number;
    mode: DeliveryContext;
    response?: string;
    feedback?: string;
  },
): Review {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO reviews (session_id, concept_id, grade, mode, response, feedback, created_at)
       VALUES (@session_id, @concept_id, @grade, @mode, @response, @feedback, @created_at)`,
    )
    .run({
      session_id: input.sessionId,
      concept_id: input.conceptId,
      grade: input.grade,
      mode: input.mode,
      response: input.response ?? null,
      feedback: input.feedback ?? null,
      created_at: now,
    });
  const row = db
    .prepare(`SELECT * FROM reviews WHERE id = ?`)
    .get(Number(info.lastInsertRowid));
  return ReviewSchema.parse(row);
}

export function getReviewsBySession(
  db: Database.Database,
  sessionId: number,
): Review[] {
  const rows = db
    .prepare(`SELECT * FROM reviews WHERE session_id = ? ORDER BY created_at`)
    .all(sessionId);
  return ReviewSchema.array().parse(rows);
}

// ─── CRUD: Synced Gaps ────────────────────────────────────────────────────

export function upsertGap(
  db: Database.Database,
  input: { jobId: string; skill: string; frequency?: number; source?: string },
): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO synced_gaps (job_id, skill, frequency, source, synced_at)
     VALUES (@job_id, @skill, @frequency, @source, @synced_at)
     ON CONFLICT(job_id, skill) DO UPDATE SET
       frequency = excluded.frequency,
       source = excluded.source,
       synced_at = excluded.synced_at`,
  ).run({
    job_id: input.jobId,
    skill: input.skill,
    frequency: input.frequency ?? 1,
    source: input.source ?? "job-hunter",
    synced_at: now,
  });
}

export function getGaps(
  db: Database.Database,
  jobId?: string,
): SyncedGap[] {
  if (jobId) {
    return db
      .prepare(`SELECT * FROM synced_gaps WHERE job_id = ? ORDER BY skill`)
      .all(jobId) as SyncedGap[];
  }
  return db.prepare(`SELECT * FROM synced_gaps ORDER BY job_id, skill`).all() as SyncedGap[];
}

// ─── CRUD: Synced Signals ─────────────────────────────────────────────────

export function upsertSignal(
  db: Database.Database,
  input: {
    sourceId: string;
    title: string;
    url?: string;
    score?: number;
    source?: string;
  },
): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO synced_signals (source_id, title, url, score, source, synced_at)
     VALUES (@source_id, @title, @url, @score, @source, @synced_at)
     ON CONFLICT(source_id, source) DO UPDATE SET
       title = excluded.title,
       url = excluded.url,
       score = excluded.score,
       synced_at = excluded.synced_at`,
  ).run({
    source_id: input.sourceId,
    title: input.title,
    url: input.url ?? null,
    score: input.score ?? null,
    source: input.source ?? "ai-feeds",
    synced_at: now,
  });
}

export function getSignals(
  db: Database.Database,
  minScore?: number,
): SyncedSignal[] {
  if (minScore !== undefined) {
    return db
      .prepare(
        `SELECT * FROM synced_signals WHERE score >= ? ORDER BY score DESC`,
      )
      .all(minScore) as SyncedSignal[];
  }
  return db
    .prepare(`SELECT * FROM synced_signals ORDER BY score DESC`)
    .all() as SyncedSignal[];
}

// ─── CRUD: Problems ───────────────────────────────────────────────────────

export function createProblem(
  db: Database.Database,
  input: {
    id: string;
    type: string;
    title: string;
    description: string;
    difficulty?: number;
    tags?: string[];
    testCases?: Record<string, unknown>[];
    rubric?: string;
    conceptId?: string;
    source?: string;
    externalId?: string;
  },
): Problem {
  db.prepare(
    `INSERT INTO problems (id, type, title, description, difficulty, tags, test_cases, rubric, concept_id, source, external_id)
     VALUES (@id, @type, @title, @description, @difficulty, @tags, @test_cases, @rubric, @concept_id, @source, @external_id)`,
  ).run({
    id: input.id,
    type: input.type,
    title: input.title,
    description: input.description,
    difficulty: input.difficulty ?? 1,
    tags: JSON.stringify(input.tags ?? []),
    test_cases: JSON.stringify(input.testCases ?? []),
    rubric: input.rubric ?? null,
    concept_id: input.conceptId ?? null,
    source: input.source ?? null,
    external_id: input.externalId ?? null,
  });
  return getProblem(db, input.id)!;
}

export function getProblem(
  db: Database.Database,
  id: string,
): Problem | undefined {
  return db.prepare(`SELECT * FROM problems WHERE id = ?`).get(id) as
    | Problem
    | undefined;
}

export function getProblemsByConcept(
  db: Database.Database,
  conceptId: string,
): Problem[] {
  return db
    .prepare(`SELECT * FROM problems WHERE concept_id = ? ORDER BY difficulty`)
    .all(conceptId) as Problem[];
}

// ─── CRUD: Attempts ───────────────────────────────────────────────────────

export function createLegacyAttempt(
  db: Database.Database,
  input: {
    problemId: string;
    responseText: string;
    score?: number;
    feedback?: string;
    timeSpentSeconds?: number;
  },
): Attempt {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO attempts (
         problem_id,
         response_text,
         score,
         feedback,
         time_spent_seconds,
         started_at,
         submitted_at,
         created_at
       )
       VALUES (
         @problem_id,
         @response_text,
         @score,
         @feedback,
         @time_spent_seconds,
         @started_at,
         @submitted_at,
         @created_at
       )`,
    )
    .run({
      problem_id: input.problemId,
      response_text: input.responseText,
      score: input.score ?? null,
      feedback: input.feedback ?? null,
      time_spent_seconds: input.timeSpentSeconds ?? null,
      started_at: now,
      submitted_at: now,
      created_at: now,
    });
  const row = db
    .prepare(`SELECT * FROM attempts WHERE id = ?`)
    .get(Number(info.lastInsertRowid));
  return AttemptSchema.parse(row);
}

export function getAttemptsByProblem(
  db: Database.Database,
  problemId: string,
): Attempt[] {
  const rows = db
    .prepare(`SELECT * FROM attempts WHERE problem_id = ? ORDER BY created_at`)
    .all(problemId);
  return AttemptSchema.array().parse(rows);
}
