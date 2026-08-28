# Environment routing

## CLI or IDE agent

1. Prefer the current Git root when it is a Learning OS checkout.
2. Read current `AGENTS.md` and `docs/teacher-agent-protocol.md`.
3. Prefer current public APIs/CLI over bundled examples.
4. If the current directory is not Learning OS, try `/home/hamza/repo/learning-os` as the known default only when appropriate; otherwise ask for the repository path.

## Connected web session

1. Prefer the repository/worktree named by the user.
2. Otherwise use `/home/hamza/repo/learning-os` as the known default path.
3. Read current repository instructions before learner-facing work.
4. Use repository state rather than chat memory for profile, mission, progress, and resumption decisions.

Without repository access, do not claim to have opened a profile, persisted onboarding, recorded evidence, or selected an authoritative next mission. You may discuss concepts or draft structured intake until access exists.

## Public boundary preference

Prefer:

1. `createTeacherWorkspace()` before a profile exists;
2. `createTeacherKernel(db)` and current session/interview/today owners after profile resolution;
3. `npm run tutor -- ...` when CLI is the available stable surface;
4. narrow read-only inspection for diagnosis.

Avoid direct SQLite writes for learner-state operations.
