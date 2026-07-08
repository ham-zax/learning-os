# generic-tutor — Project Instructions

## What This Is
An AI tutor engine using SM-2 spaced repetition. TypeScript CLI backed by SQLite. Teaches any topic, drills coding and system-design interviews, and integrates with job-hunter (skill gaps) and ai-feeds (learning signals).

## Key Files
- `src/cli.ts` — Commander.js entry point (9 commands)
- `src/sm2.ts` — SM-2 algorithm (pure function, testable in isolation)
- `src/state.ts` — SM-2 ↔ DB bridge (due queries, summaries, topic init)
- `src/db/database.ts` — SQLite schema, migrations, CRUD (8 tables)
- `src/session/engine.ts` — Session orchestrator (start, grade, end)
- `src/session/modes/` — explore, quiz, teach-back mode logic
- `src/ingest/orchestrator.ts` — Multi-source ingestion pipeline
- `src/knowledge/loader.ts` — Markdown + YAML frontmatter parser
- `config.json` — Learner config (daily_minutes, knowledge_dir)
- `knowledge/manifest.json` — Topic index (all available topics)
- `knowledge/<topic>/manifest.json` — Per-topic concept metadata + prerequisite DAG
- `data/tutor.db` — SQLite database (git-ignored, learner progress)

## Commands (Development)
```bash
npx tsx src/cli.ts <topic>                                  # Session or ingestion
npx tsx src/cli.ts <topic> --mode explore|quiz|teach-back   # Study session
npx tsx src/cli.ts ingest <topic> [--from job-hunter|ai-feeds|manual]
npx tsx src/cli.ts init <topic> <manifest-path>             # Bootstrap from manifest
npx tsx src/cli.ts stats [--topic <topic>]                  # Progress summary
npx tsx src/cli.ts due [--topic <topic>]                    # Due reviews
npx tsx src/cli.ts gaps [--top N]                           # Skill gaps from job-hunter
npx tsx src/cli.ts interview <topic> [--type coding|system-design]
npx tsx src/cli.ts plan <topic> --goal <text> [--deadline YYYY-MM-DD]
npx tsx src/cli.ts sync                                     # Pull gaps + signals
```

Shorthand via npm: `npm run tutor -- stats`

## Conventions
- TypeScript ESM (`"type": "module"`), Node >= 22
- SQLite via better-sqlite3 (synchronous API, WAL mode, foreign keys ON)
- SM-2 algorithm is in `src/sm2.ts` — pure function, no side effects
- State updates go through `src/state.ts` or `src/session/engine.ts`, not raw SQL
- Knowledge files: YAML frontmatter optional — metadata lives in per-topic `manifest.json`
- Manifest format: `{ topicId, topicName, concepts: [{ id, title, difficulty?, prerequisites?, tags? }] }`
- `tutor init` is idempotent — safe to re-run

## What NOT To Do
- Don't commit `data/` files — they contain learner progress (git-ignored)
- Don't use `sessionId: 0` in `createReview` — use `null` (FK constraint)
- Don't modify `src/sm2.ts` without running the SM-2 tests
- Don't change the manifest format without updating `initializeTopic` in `src/state.ts`
- Don't hardcode paths — use `config.json` for directory references
- Don't run `npx tsc --noEmit` directly — use `npm run typecheck` (memory limit)
