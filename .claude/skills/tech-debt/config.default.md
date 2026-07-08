---
# Technical Debt defaults -- DO NOT EDIT
# Override in .claude/config/tech-debt.md (project) or ~/.claude/config/tech-debt.md (user)
model: sonnet
strictness: normal
scope:
  include: ["**/*"]
  exclude: ["node_modules/**", "dist/**", "build/**", "coverage/**"]
thresholds:
  severity_blocking: high
  max_findings: 50
  complexity_warning: 15
  complexity_critical: 30
  file_length_warning: 300
custom_rules: []
output_format: verbose
persistent_facts: []
---
Default configuration for tech-debt skill.
