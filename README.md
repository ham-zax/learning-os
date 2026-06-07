# generic-tutor

A generic AI tutor skill using SM-2 spaced repetition. File-based state, markdown knowledge base, no dependencies beyond bash and jq.

## How It Works

1. An AI agent loads `SKILL.md` to become a tutor
2. Knowledge lives in `knowledge/concepts/` as markdown files
3. Learner state is tracked in `state/{topic}.json`
4. SM-2 algorithm schedules reviews automatically

## Quick Start

```bash
# Initialize a topic
bash scripts/init.sh git-basics

# Check what's due
bash scripts/due.sh git-basics

# View progress
bash scripts/stats.sh git-basics

# Then: load SKILL.md in an AI agent session and say "start a session on git-basics"
```

## Adding a New Topic

1. Create `knowledge/concepts/` files using `templates/concept-template.md`
2. Create `knowledge/manifest.json` using `templates/manifest-template.json`
3. Run `bash scripts/init.sh {topic}`

## Structure

```
SKILL.md              # Agent loads this to become a tutor
config.json           # Learner config
knowledge/            # Markdown knowledge base
  manifest.json       # Concept index + prerequisite DAG
  concepts/           # One file per concept
state/                # Learner progress (git-ignored)
scripts/              # CLI helpers
templates/            # Starting points for new topics
```

## Grading (0-5)

| Grade | Meaning |
|-------|---------|
| 5 | Perfect recall |
| 4 | Correct with minor hesitation |
| 3 | Correct but effortful |
| 2 | Wrong but close |
| 1 | Minimal relevant knowledge |
| 0 | Complete blank |
