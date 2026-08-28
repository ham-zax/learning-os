# AGENTS.md — generic-tutor

## Overview
An AI tutor engine with SM-2 spaced repetition, interview prep, and ecosystem integration. Teaches any topic using the SM-2 algorithm, drills coding tests and system design, and integrates with job-hunter and ai-feeds for career-driven learning.

## Tech Stack
- **Language:** TypeScript (ESM, Node >= 22)
- **Runtime:** `tsx` (dev), compiled to `dist/` for production
- **State:** SQLite via better-sqlite3 (`data/tutor.db`)
- **Knowledge:** Markdown files in `knowledge/` (YAML frontmatter not required — metadata lives in per-topic `manifest.json`)
- **CLI:** Commander.js (`src/cli.ts`)
- **Test:** vitest

## Key Paths

| Path | Purpose |
|------|---------|
| `data/tutor.db` | SQLite database — all SM-2 state, sessions, reviews, synced data |
| `knowledge/manifest.json` | Topic index listing all available topics |
| `knowledge/<topic>/manifest.json` | Per-topic manifest: concept IDs, titles, prereqs, difficulty |
| `knowledge/<topic>/concepts/*.md` | Concept markdown files (per-topic subdirectory) |
| `knowledge/concepts/*.md` | Legacy concept files (git-basics — flat layout) |
| `src/sm2.ts` | SM-2 algorithm — pure function, zero dependencies |
| `src/state.ts` | SM-2 ↔ DB bridge: due queries, summaries, topic init |
| `src/db/database.ts` | SQLite CRUD — schema, migrations, 8 tables |
| `src/session/engine.ts` | Session orchestrator: start, grade, end |

## CLI Commands

```bash
# Development (via tsx)
npm run tutor -- <command>              # e.g., npm run tutor -- stats
npx tsx src/cli.ts <command>           # equivalent

# Production
npm run build && node dist/cli.js <command>
```

| Command | Purpose |
|---------|---------|
| `tutor <topic>` | Auto-detect: session (if topic exists) or ingestion mode |
| `tutor <topic> --mode explore\|quiz\|teach-back` | Start a study session |
| `tutor ingest <topic> [--from job-hunter\|ai-feeds\|manual]` | Ingest concepts from source |
| `tutor init <topic> <manifest-path>` | Bootstrap topic from manifest JSON |
| `tutor stats [--topic <topic>]` | Progress summary (all topics or one) |
| `tutor due [--topic <topic>]` | Concepts due for review |
| `tutor gaps [--top N]` | Skill gaps from job-hunter |
| `tutor interview <topic> [--type coding\|system-design]` | Interview drill |
| `tutor plan <topic> --goal <text> [--deadline YYYY-MM-DD]` | Learning plan |
| `tutor sync` | Pull gaps from job-hunter + signals from ai-feeds |
| `tutor search <query> --topic <topic>` | Search concepts |

## Database (8 tables in `data/tutor.db`)

```sql
topics         — id, name, phase, goal, deadline, last_session
concepts       — id, topic_id, title, difficulty, prerequisites, tags,
                 status, ef, interval, repetitions, next_review, last_grade
sessions       — id, topic_id, mode, started_at, ended_at
reviews        — id, session_id, concept_id, grade, mode, feedback
synced_gaps    — job_id, skill, frequency (from job-hunter)
synced_signals — source_id, title, url, score (from ai-feeds)
problems       — id, type, title, description, difficulty, test_cases
attempts       — id, problem_id, response, score, feedback
```

## How to Query Progress

```bash
# All topics overview
npx tsx src/cli.ts stats

# One topic detail (phase, mastery breakdown, due count)
npx tsx src/cli.ts stats --topic coding-interview

# What's due today
npx tsx src/cli.ts due --topic coding-interview

# Raw DB queries
sqlite3 data/tutor.db "SELECT id, title, status, ef, next_review FROM concepts WHERE topic_id='coding-interview' ORDER BY status, id;"

sqlite3 data/tutor.db "SELECT c.title, r.grade, r.mode, r.created_at FROM reviews r JOIN concepts c ON c.id = r.concept_id WHERE c.topic_id='coding-interview' ORDER BY r.created_at DESC LIMIT 20;"

sqlite3 data/tutor.db "SELECT COUNT(*) as mastered FROM concepts WHERE topic_id='coding-interview' AND status='mastered';"
```

## SM-2 Statuses & Transitions

| Status | Meaning | How to reach |
|--------|---------|-------------|
| `unseen` | Never reviewed | Default |
| `learning` | First interaction done | Any grade on first review |
| `reviewing` | In spaced repetition | 2+ passes with grade >= 3 |
| `mastered` | Fully learned | 5+ consecutive passes AND interval > 21 days |

Grade 0-1 on reviewing/mastered → falls back to `learning`.

## Knowledge File Format

Concept files should follow `knowledge/concepts/_template.md`:
```markdown
---
id: concept-id
title: Concept Title
difficulty: 1
prerequisites: []
tags: []
---

## Summary
Brief overview (2-3 sentences).

## Key Points
- Point 1
- Point 2

## Deep Dive
Detailed explanation with examples.

## Practice Questions
1. Recall question
2. Understanding question

## Common Misconceptions
- Misconception → Correction
```

Files without YAML frontmatter still work — metadata comes from the manifest JSON.

## Adding a New Topic

```bash
# 1. Create manifest
mkdir -p knowledge/my-topic/concepts
# Write knowledge/my-topic/manifest.json

# 2. Create concept markdown files
# Write knowledge/my-topic/concepts/<id>.md

# 3. Bootstrap into DB
npx tsx src/cli.ts init my-topic knowledge/my-topic/manifest.json

# 4. Add to topic index (knowledge/manifest.json)

# 5. Start learning
npx tsx src/cli.ts my-topic
```

## Safety

- `data/tutor.db` is git-ignored — never commit learner progress
- `data/tutor.db-shm` and `data/tutor.db-wal` are WAL files — git-ignored
- DB uses WAL mode with foreign keys — don't manipulate with raw SQL without understanding the schema
- `tutor init` is idempotent — safe to re-run on existing topics
- Manifest JSON format: `{ topicId, topicName, concepts: [{ id, title, difficulty?, prerequisites?, tags? }] }`
