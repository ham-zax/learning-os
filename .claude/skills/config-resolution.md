## Configuration Resolution

Before executing, resolve your configuration by merging three layers (skip missing files):

1. **Skill defaults**: `{skill-root}/config.default.md` (always exists, never edited)
2. **Project overrides**: `.claude/config/{skill-name}.md` (committed to git)
3. **User overrides**: `~/.claude/config/{skill-name}.md` (gitignored, personal)

### Merge Rules
- **Scalars** (model, strictness, output_format): highest-priority layer wins
- **Tables** (scope, thresholds): deep merge — override keys replace, missing keys inherit
- **Arrays** (custom_rules, persistent_facts): append — base + project + user

### How to Apply
- `model` → use this model when spawning subagents
- `strictness` → `relaxed` (fewer findings, faster), `normal`, `strict` (more findings, thorough), `paranoid` (check everything)
- `scope.include/exclude` → limit what you examine (glob patterns)
- `thresholds.severity_blocking` → findings at this severity or above block the operation
- `custom_rules` → project-specific patterns to check (in addition to standard checks)
- `persistent_facts` → load these as context (literal strings or `file:` refs to read)
- `output_format` → `verbose` (full report), `concise` (summary only), `json` (machine-readable)
