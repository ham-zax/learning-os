---
# Performance Profile defaults -- DO NOT EDIT
# Override in .claude/config/perf-profile.md (project) or ~/.claude/config/perf-profile.md (user)
model: sonnet
strictness: normal
scope:
  include: ["**/*"]
  exclude: ["node_modules/**", "*.test.*", "*.spec.*", "dist/**"]
thresholds:
  severity_blocking: high
  max_findings: 50
custom_rules: []
output_format: verbose
persistent_facts: []
---
Default configuration for perf-profile skill.
