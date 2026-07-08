---
# Dependency Audit defaults -- DO NOT EDIT
# Override in .claude/config/dep-audit.md (project) or ~/.claude/config/dep-audit.md (user)
model: sonnet
strictness: normal
scope:
  include: ["**/*"]
  exclude: ["node_modules/**", "dist/**"]
thresholds:
  severity_blocking: high
  max_findings: 100
custom_rules: []
output_format: verbose
persistent_facts: []
---
Default configuration for dep-audit skill.
