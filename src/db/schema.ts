export const CURRENT_SCHEMA_VERSION = 22;

export const CURRENT_SCHEMA_SQL = String.raw`
CREATE TABLE topics (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    goal        TEXT,
    deadline    TEXT,
    created_at  TEXT,
    last_session TEXT
  );
CREATE TABLE concepts (
    id           TEXT PRIMARY KEY,
    topic_id     TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    difficulty   INTEGER NOT NULL DEFAULT 1,
    prerequisites TEXT NOT NULL DEFAULT '[]',
    tags         TEXT NOT NULL DEFAULT '[]',
    file_path    TEXT,
    source       TEXT,
    source_id    TEXT,
    created_at   TEXT
  );
CREATE TABLE sessions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id         TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    mode             TEXT NOT NULL,
    started_at       TEXT,
    ended_at         TEXT,
    phase TEXT NOT NULL DEFAULT 'idle'
            CHECK (phase IN (
              'idle',
              'challenge_prepared',
              'awaiting_response',
              'awaiting_verification',
              'awaiting_assessment',
              'feedback',
              'complete'
            )), pending_action TEXT NOT NULL DEFAULT 'none'
            CHECK (pending_action IN (
              'none',
              'collect_response',
              'run_verification',
              'assess_response',
              'present_feedback'
            )), active_challenge_id TEXT, active_challenge_version INTEGER, active_attempt_id INTEGER REFERENCES attempts(id) ON DELETE SET NULL, reconstruction_status TEXT NOT NULL DEFAULT 'not_required'
            CHECK (reconstruction_status IN ('not_required', 'required', 'completed', 'opted_out')));
CREATE TABLE synced_gaps (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id    TEXT NOT NULL,
    skill     TEXT NOT NULL,
    frequency INTEGER NOT NULL DEFAULT 1,
    source    TEXT NOT NULL DEFAULT 'job-hunter',
    synced_at TEXT,
    UNIQUE(job_id, skill)
  );
CREATE TABLE synced_signals (
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
CREATE TABLE problems (
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
CREATE TABLE capabilities (
            id          TEXT PRIMARY KEY,
            description TEXT NOT NULL,
            is_core     INTEGER NOT NULL CHECK (is_core IN (0, 1)),
            created_at  TEXT NOT NULL
          );
INSERT INTO capabilities (id, description, is_core, created_at) VALUES
  ('explain', 'State the mechanism and relevant boundaries.', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('predict', 'Anticipate behavior before seeing the result.', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('implement', 'Produce a correct working implementation.', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('debug', 'Locate and repair a failure from symptoms and evidence.', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('design', 'Choose and justify a solution under constraints.', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
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
CREATE TABLE "attempts" (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            challenge_id        TEXT,
            challenge_version   INTEGER,
            session_id          INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
            response_text       TEXT,
            artifact_ref_json   TEXT,
            time_spent_seconds  INTEGER,
            started_at          TEXT NOT NULL,
            submitted_at        TEXT,
            created_at          TEXT NOT NULL, verification_output_json TEXT, reconstruction_response_text TEXT,
            CHECK (
              (challenge_id IS NULL AND challenge_version IS NULL) OR
              (challenge_id IS NOT NULL AND challenge_version IS NOT NULL)
            ),
            FOREIGN KEY(challenge_id, challenge_version)
              REFERENCES challenge_versions(challenge_id, version) ON DELETE RESTRICT
          );
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
            occurred_at       TEXT NOT NULL, teaching_artifact_id TEXT
            REFERENCES teaching_artifacts(id) ON DELETE RESTRICT,
            CHECK (
              (challenge_id IS NULL AND challenge_version IS NULL) OR
              (challenge_id IS NOT NULL AND challenge_version IS NOT NULL)
            ),
            FOREIGN KEY(challenge_id, challenge_version)
              REFERENCES challenge_versions(challenge_id, version) ON DELETE RESTRICT
          );
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
CREATE TABLE goal_objectives (
            goal_id            TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
            objective_id       TEXT NOT NULL REFERENCES learning_objectives(id) ON DELETE CASCADE,
            is_active          INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
            importance         TEXT NOT NULL CHECK (importance IN ('core', 'important', 'supporting')),
            target_readiness   TEXT NOT NULL CHECK (target_readiness IN ('guided', 'independent')),
            require_transfer   INTEGER NOT NULL DEFAULT 0 CHECK (require_transfer IN (0, 1)),
            require_durability INTEGER NOT NULL DEFAULT 0 CHECK (require_durability IN (0, 1)),
            created_at         TEXT NOT NULL,
            updated_at         TEXT NOT NULL, preparation_strategy TEXT
            CHECK (preparation_strategy IS NULL OR preparation_strategy IN ('learn', 'refresh', 'diagnose_first', 'transfer_practice')), initial_diagnostic_kind TEXT
            CHECK (initial_diagnostic_kind IS NULL OR initial_diagnostic_kind IN ('baseline', 'refresh_check', 'strength_check', 'prerequisite_check', 'transfer_check')),
            PRIMARY KEY(goal_id, objective_id)
          );
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
CREATE TABLE teaching_artifacts (
            id             TEXT PRIMARY KEY,
            content        TEXT NOT NULL,
            content_format TEXT NOT NULL CHECK (content_format IN ('text', 'markdown')),
            created_at     TEXT NOT NULL
          );
CREATE TABLE study_focus_episodes (
            id                     TEXT PRIMARY KEY,
            goal_id                TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
            label                  TEXT,
            target_objective_ids   TEXT NOT NULL,
            resolved_objective_ids TEXT NOT NULL,
            opened_at              TEXT NOT NULL,
            closed_at              TEXT
          );
CREATE TABLE revision_notes (
            id                TEXT PRIMARY KEY,
            scope_kind        TEXT NOT NULL CHECK (
              scope_kind IN (
                'profile', 'goal', 'concept', 'objective', 'session',
                'current_focus', 'focus_episode'
              )
            ),
            scope_json        TEXT NOT NULL,
            title             TEXT NOT NULL,
            markdown          TEXT NOT NULL,
            source_state_json TEXT NOT NULL,
            source_refs_json  TEXT NOT NULL,
            generated_at      TEXT NOT NULL
          );
CREATE TABLE interaction_preferences (
            singleton          INTEGER PRIMARY KEY CHECK (singleton = 1),
            input_mode         TEXT NOT NULL DEFAULT 'default'
              CHECK (input_mode IN ('default', 'speech_to_text')),
            question_chunking  TEXT NOT NULL DEFAULT 'default'
              CHECK (question_chunking IN ('default', 'atomic')),
            source             TEXT NOT NULL CHECK (source = 'learner_explicit'),
            updated_at         TEXT NOT NULL
          );
CREATE TABLE challenge_attempt_dispositions (
            attempt_id       INTEGER PRIMARY KEY REFERENCES attempts(id) ON DELETE RESTRICT,
            disposition      TEXT NOT NULL CHECK (
              disposition IN ('rejected_before_submission', 'voided_after_submission')
            ),
            reason_code      TEXT NOT NULL CHECK (
              reason_code IN (
                'ambiguous', 'unanswerable', 'answer_leaking', 'objective_mismatch',
                'task_form_mismatch', 'fails_selected_weakness', 'changed_surface_violation',
                'invalid_rubric', 'verification_mismatch', 'other_contract_violation'
              )
            ),
            defect_scope     TEXT NOT NULL CHECK (
              defect_scope IN ('attempt_context', 'challenge_intrinsic')
            ),
            detail           TEXT NOT NULL,
            created_at       TEXT NOT NULL
          );
CREATE TABLE challenge_authoring_contracts (
            challenge_id      TEXT NOT NULL,
            version           INTEGER NOT NULL CHECK (version > 0),
            contract_version  INTEGER NOT NULL CHECK (contract_version = 2),
            intent_json       TEXT NOT NULL,
            created_at        TEXT NOT NULL,
            PRIMARY KEY(challenge_id, version),
            FOREIGN KEY(challenge_id, version)
              REFERENCES challenge_versions(challenge_id, version) ON DELETE RESTRICT
          );
CREATE TABLE "attempt_subquestions" (
            seq                INTEGER PRIMARY KEY AUTOINCREMENT,
            attempt_id         INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
            prompt_text        TEXT NOT NULL CHECK (length(trim(prompt_text)) > 0),
            response_text      TEXT CHECK (response_text IS NULL OR length(trim(response_text)) > 0),
            opened_at          TEXT NOT NULL,
            answered_at        TEXT,
            purpose            TEXT NOT NULL CHECK (purpose IN ('response', 'reconstruction')),
            context_text       TEXT NOT NULL CHECK (length(trim(context_text)) > 0),
            question_chunking  TEXT NOT NULL CHECK (question_chunking IN ('default', 'atomic')),
            scope_criterion_id TEXT,
            scope_note         TEXT,
            superseded_at      TEXT,
            CHECK (
              (response_text IS NULL AND answered_at IS NULL) OR
              (response_text IS NOT NULL AND answered_at IS NOT NULL)
            ),
            CHECK (
              (question_chunking = 'default' AND scope_criterion_id IS NULL AND scope_note IS NULL) OR
              (question_chunking = 'atomic'
                AND scope_criterion_id IS NOT NULL AND length(trim(scope_criterion_id)) > 0
                AND scope_note IS NOT NULL AND length(trim(scope_note)) > 0)
            )
          );
CREATE INDEX idx_concepts_topic_id   ON concepts(topic_id);
CREATE INDEX idx_sessions_topic_id    ON sessions(topic_id);
CREATE INDEX idx_synced_gaps_job_id   ON synced_gaps(job_id);
CREATE INDEX idx_learning_objectives_concept
            ON learning_objectives(concept_id);
CREATE INDEX idx_learning_objectives_capability
            ON learning_objectives(capability_id);
CREATE INDEX idx_challenge_targets_objective
            ON challenge_targets(objective_id, challenge_id, version);
CREATE INDEX idx_attempts_challenge
            ON attempts(challenge_id, challenge_version);
CREATE INDEX idx_attempts_session_id
            ON attempts(session_id);
CREATE INDEX idx_hint_observations_attempt
            ON hint_observations(attempt_id, seq);
CREATE INDEX idx_exposure_events_objective_time
            ON exposure_events(objective_id, occurred_at, seq);
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
CREATE INDEX idx_review_events_objective_time
            ON review_events(objective_id, reviewed_at, seq);
CREATE INDEX idx_review_cards_due
            ON review_cards(due_at, objective_id);
CREATE INDEX idx_goal_objectives_active
            ON goal_objectives(goal_id, is_active, importance, objective_id);
CREATE INDEX idx_goal_objectives_objective
            ON goal_objectives(objective_id, goal_id);
CREATE INDEX idx_exposure_events_teaching_artifact
            ON exposure_events(teaching_artifact_id);
CREATE INDEX idx_study_focus_episodes_goal_time
            ON study_focus_episodes(goal_id, opened_at, id);
CREATE UNIQUE INDEX idx_study_focus_episodes_active_goal
            ON study_focus_episodes(goal_id)
            WHERE closed_at IS NULL;
CREATE INDEX idx_revision_notes_generated
            ON revision_notes(generated_at, id);
CREATE INDEX idx_attempt_subquestions_attempt_seq
            ON attempt_subquestions(attempt_id, seq);
CREATE UNIQUE INDEX idx_attempt_subquestions_one_pending
            ON attempt_subquestions(attempt_id)
            WHERE response_text IS NULL AND superseded_at IS NULL;
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
CREATE TRIGGER teaching_artifacts_no_update
          BEFORE UPDATE ON teaching_artifacts
          BEGIN
            SELECT RAISE(ABORT, 'teaching artifacts are immutable');
          END;
CREATE TRIGGER teaching_artifacts_no_delete
          BEFORE DELETE ON teaching_artifacts
          BEGIN
            SELECT RAISE(ABORT, 'teaching artifacts are immutable');
          END;
CREATE TRIGGER revision_notes_no_update
          BEFORE UPDATE ON revision_notes
          BEGIN
            SELECT RAISE(ABORT, 'revision note snapshots are immutable');
          END;
CREATE TRIGGER revision_notes_no_delete
          BEFORE DELETE ON revision_notes
          BEGIN
            SELECT RAISE(ABORT, 'revision note snapshots are immutable');
          END;
CREATE TRIGGER challenge_attempt_dispositions_no_update
          BEFORE UPDATE ON challenge_attempt_dispositions
          BEGIN
            SELECT RAISE(ABORT, 'challenge attempt dispositions are immutable');
          END;
CREATE TRIGGER challenge_attempt_dispositions_no_delete
          BEFORE DELETE ON challenge_attempt_dispositions
          BEGIN
            SELECT RAISE(ABORT, 'challenge attempt dispositions are immutable');
          END;
CREATE TRIGGER challenge_authoring_contracts_no_insert_after_freeze
          BEFORE INSERT ON challenge_authoring_contracts
          WHEN (
            SELECT is_frozen FROM challenge_versions
            WHERE challenge_id = NEW.challenge_id AND version = NEW.version
          ) = 1
          BEGIN
            SELECT RAISE(ABORT, 'frozen challenge authoring contracts are immutable');
          END;
CREATE TRIGGER challenge_authoring_contracts_no_update
          BEFORE UPDATE ON challenge_authoring_contracts
          BEGIN
            SELECT RAISE(ABORT, 'challenge authoring contracts are immutable');
          END;
CREATE TRIGGER challenge_authoring_contracts_no_delete
          BEFORE DELETE ON challenge_authoring_contracts
          BEGIN
            SELECT RAISE(ABORT, 'challenge authoring contracts are immutable');
          END;
CREATE TRIGGER attempts_reconstruction_response_requires_submission
          BEFORE UPDATE OF reconstruction_response_text ON attempts
          WHEN NEW.reconstruction_response_text IS NOT NULL
            AND (
              NEW.submitted_at IS NULL OR
              length(trim(NEW.reconstruction_response_text)) = 0
            )
          BEGIN
            SELECT RAISE(ABORT, 'reconstruction response requires submitted non-empty learner text');
          END;
CREATE TRIGGER attempts_reconstruction_response_immutable
          BEFORE UPDATE OF reconstruction_response_text ON attempts
          WHEN OLD.reconstruction_response_text IS NOT NULL
          BEGIN
            SELECT RAISE(ABORT, 'reconstruction response is immutable once recorded');
          END;
CREATE TRIGGER attempt_subquestions_require_active_attempt
          BEFORE INSERT ON attempt_subquestions
          WHEN NOT EXISTS (
        SELECT 1 FROM attempts attempt
        JOIN sessions session ON session.id = attempt.session_id
        WHERE attempt.id = NEW.attempt_id AND attempt.challenge_id IS NOT NULL
          AND session.active_attempt_id = attempt.id
          AND (
            (NEW.purpose = 'response' AND attempt.submitted_at IS NULL
              AND session.phase = 'awaiting_response' AND session.pending_action = 'collect_response')
            OR
            (NEW.purpose = 'reconstruction' AND attempt.submitted_at IS NOT NULL
              AND session.phase = 'feedback' AND session.pending_action = 'present_feedback'
              AND session.reconstruction_status = 'required')
          )) OR NEW.response_text IS NOT NULL
            OR NEW.answered_at IS NOT NULL OR NEW.superseded_at IS NOT NULL
          BEGIN SELECT RAISE(ABORT, 'subquestions require the active response or reconstruction target'); END;
CREATE TRIGGER attempt_subquestions_atomic_scope_valid
          BEFORE INSERT ON attempt_subquestions
          WHEN NEW.question_chunking = 'atomic' AND NOT EXISTS (
            SELECT 1
            FROM attempts attempt
            JOIN challenge_criteria criterion
              ON criterion.challenge_id = attempt.challenge_id
             AND criterion.version = attempt.challenge_version
             AND criterion.criterion_id = NEW.scope_criterion_id
            WHERE attempt.id = NEW.attempt_id
          )
          BEGIN SELECT RAISE(ABORT, 'atomic subquestion scope must belong to the frozen challenge'); END;
CREATE TRIGGER attempt_subquestions_identity_immutable
          BEFORE UPDATE OF seq, attempt_id, prompt_text, opened_at, purpose, context_text, question_chunking,
            scope_criterion_id, scope_note
          ON attempt_subquestions
          BEGIN SELECT RAISE(ABORT, 'attempt subquestion identity is immutable'); END;
CREATE TRIGGER attempt_subquestions_answer_once
          BEFORE UPDATE OF response_text, answered_at ON attempt_subquestions
          WHEN OLD.response_text IS NOT NULL OR OLD.answered_at IS NOT NULL
            OR OLD.superseded_at IS NOT NULL OR NEW.superseded_at IS NOT NULL
            OR NEW.response_text IS NULL OR NEW.answered_at IS NULL
          BEGIN SELECT RAISE(ABORT, 'attempt subquestions may be answered exactly once'); END;
CREATE TRIGGER attempt_subquestions_update_active
          BEFORE UPDATE OF response_text, answered_at, superseded_at ON attempt_subquestions
          WHEN NOT EXISTS (
        SELECT 1 FROM attempts attempt
        JOIN sessions session ON session.id = attempt.session_id
        WHERE attempt.id = NEW.attempt_id AND attempt.challenge_id IS NOT NULL
          AND session.active_attempt_id = attempt.id
          AND (
            (NEW.purpose = 'response' AND attempt.submitted_at IS NULL
              AND session.phase = 'awaiting_response' AND session.pending_action = 'collect_response')
            OR
            (NEW.purpose = 'reconstruction' AND attempt.submitted_at IS NOT NULL
              AND session.phase = 'feedback' AND session.pending_action = 'present_feedback'
              AND session.reconstruction_status = 'required')
          ))
          BEGIN SELECT RAISE(ABORT, 'subquestion is not the active response or reconstruction target'); END;
CREATE TRIGGER attempt_subquestions_supersede_once
          BEFORE UPDATE OF superseded_at ON attempt_subquestions
          WHEN OLD.superseded_at IS NOT NULL OR OLD.response_text IS NOT NULL
            OR NEW.superseded_at IS NULL OR NEW.response_text IS NOT NULL
          BEGIN SELECT RAISE(ABORT, 'only pending subquestions may be superseded'); END;
CREATE TRIGGER attempt_subquestions_no_delete
          BEFORE DELETE ON attempt_subquestions
          BEGIN SELECT RAISE(ABORT, 'attempt subquestions are durable interaction observations'); END;
`;
