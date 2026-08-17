# generic-tutor

AI tutor engine with spaced repetition, interview prep, and ecosystem integration. Teaches any topic using the SM-2 algorithm, drills coding tests and system design, and integrates with [job-hunter](https://github.com/alienz-dev/job-hunter) and [ai-feeds](https://github.com/alienz-dev/ai-feeds) for career-driven learning.

## Features

- **SM-2 Spaced Repetition** — deterministic scheduling with easiness factor, interval tracking, and status transitions (unseen → learning → reviewing → mastered)
- **Three Session Modes** — explore (Socratic discovery), quiz (retrieval practice), teach-back (explain it to me)
- **Interview Prep** — coding drills (timed, LLM-graded) and system design interviews (4-phase structured)
- **Ecosystem Integration** — reads skill gaps from job-hunter DB and learning signals from ai-feeds DB
- **Interactive Knowledge Ingestion** — feed it URLs, text, or let it auto-generate from sibling projects
- **Goal-Driven Learning Plans** — back-calculates session schedules from deadlines, adapts pacing from your performance
- **CLI-First** — all commands via `tutor <command>`, no web server needed

## Quick Start

```bash
# Install
npm install

# Run via tsx (development)
npm run tutor -- stats

# Build and run via node
npm run build
node dist/cli.js stats

# Or link globally
npm link
tutor stats
```

## CLI Commands

```
tutor <topic>                                  # Auto-detect: ingest or start session
tutor ingest <topic> [--from job-hunter|ai-feeds|manual] [--material <text>]
tutor gaps [--job-id <id>] [--top N]           # Skill gaps from job-hunter
tutor interview <topic> [--type coding|system-design] [--difficulty N]
tutor due [--topic <topic>]                    # Due reviews
tutor stats [--topic <topic>]                  # Progress summary
tutor plan <topic> --goal <text> [--deadline YYYY-MM-DD]
tutor sync                                     # Pull gaps + signals from siblings
```

## How It Works

### 1. Ingest Knowledge

```bash
# From job-hunter skill gaps
tutor ingest ai-engineering --from job-hunter

# From ai-feeds papers
tutor ingest ai-engineering --from ai-feeds

# From your own material
tutor ingest ai-engineering --from manual --material "RAG is..."
```

The tutor proposes a concept map → you approve → it generates concept files → validates quality.

### 2. Learn with Spaced Repetition

```bash
tutor system-design
```

Sessions adapt to your performance. Grade each concept 0-5:
- **5** — Perfect recall
- **4** — Correct with minor hesitation
- **3** — Correct but effortful
- **2** — Wrong but close
- **1** — Minimal knowledge
- **0** — Complete blank

### 3. Practice Interviews

```bash
# Coding drill (timed, LLM-graded)
tutor interview coding-interview --type coding

# System design (4-phase structured interview)
tutor interview system-design --type system-design
```

### 4. Track Progress

```bash
tutor stats                    # Phase, mastery counts, due reviews
tutor due                      # What's due today
tutor plan ai-engineering --goal "pass AI engineer interview" --deadline 2026-07-01
```

## Architecture

```
src/
  cli.ts                       # Commander entry point (8 commands)
  sm2.ts                       # SM-2 algorithm (pure, testable)
  state.ts                     # State management + SM-2 integration
  db/
    database.ts                # SQLite schema, migrations, 23 CRUD functions
    types.ts                   # 8 Zod schemas, 8 TypeScript types
  knowledge/
    types.ts                   # Concept/Manifest/Plan types
    loader.ts                  # Markdown parser with YAML frontmatter
    validator.ts               # Quality gate (completeness + consistency)
  session/
    engine.ts                  # Session orchestrator
    modes/
      explore.ts               # 9-step Socratic sequence
      quiz.ts                  # Retrieval practice with interleaving
      teach-back.ts            # Confused junior dev simulation
  interview/
    problems.ts                # Problem bank (coding + system-design)
    coding.ts                  # Timed coding drill
    system-design.ts           # 4-phase design interview
  integrations/
    job-hunter.ts              # Skill gaps, jobs, interview prep
    ai-feeds.ts                # Scored papers, learning issues
  ingest/
    orchestrator.ts            # Multi-source ingestion pipeline
  plan/
    planner.ts                 # Goal-driven learning plan generation
    pacer.ts                   # Adaptive pacing from SM-2 history
  llm/
    client.ts                  # Anthropic API with retry
    grader.ts                  # LLM grading for coding + system design
```

## Ecosystem

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  ai-feeds   │────▶│              │◀────│ job-hunter  │
│  (signals)  │     │   tutor      │     │  (gaps)     │
└─────────────┘     │  (learning)  │     └─────────────┘
                    └──────────────┘
                           │
                    ┌──────┴──────┐
                    │   You       │
                    │  (mastery)  │
                    └─────────────┘
```

- **ai-feeds** — surfaces relevant papers and techniques
- **job-hunter** — identifies what employers need
- **tutor** — teaches you the skills, tracks mastery

## Database

SQLite with 8 tables:

| Table | Purpose |
|-------|---------|
| `topics` | Study topics with phase tracking |
| `concepts` | SM-2 state per concept (ef, interval, status) |
| `sessions` | Session records with mode and duration |
| `reviews` | Individual concept reviews with grades |
| `synced_gaps` | Skill gaps from job-hunter |
| `synced_signals` | Learning signals from ai-feeds |
| `problems` | Coding + system design problems |
| `attempts` | Interview drill attempts with scores |

## Configuration

```json
{
  "learner": "your-name",
  "daily_minutes": 30,
  "knowledge_dir": "./knowledge",
  "state_dir": "./data",
  "job_hunter_db": "../job-hunter/data/job_hunter.db",
  "ai_feeds_db": "../ai-feeds/db/ai-feeds.sqlite"
}
```

## Adding Topics

```bash
# Create topic directory
mkdir -p topics/my-topic

# Ingest from sources
tutor ingest my-topic --from job-hunter

# Or create concept files manually
# See knowledge/concepts/_template.md for format

# Update manifest
# Edit knowledge/manifest.json

# Start learning
tutor my-topic
```

## Development

```bash
npm test           # Run tests (vitest)
npm run typecheck  # Type check (tsc --noEmit)
npm run build      # Build to dist/
npm run tutor      # Run CLI via tsx
```

## License

MIT
