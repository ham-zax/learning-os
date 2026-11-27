# AGENTS.md — Learning OS

Read `skills/learning-os-teacher/SKILL.md` for all learner-facing teaching and tracked study.

- **Tool surface:** Use the connected `learning_os` MCP tools (`study_next`, `study_submit`, `study_help`, `study_status`, `study_notes`) when available; in a local folder, call the exact same interface via `node dist/cli.js study <tool> '<json>'` (or `node dist/cli.js study describe <tool>`, fallback `npm run -s tutor -- study ...`).
- **Onboarding:** New tracked curricula require explicit learner confirmation before creating a profile (`npm run tutor -- onboard`).
- **Engineering & hygiene:** Run `npm run typecheck && npm test` for code changes. Checkpoint changed profiles (`node dist/cli.js profile checkpoint`) before committing; keep raw resumes, transcripts, and secrets out of Git.
