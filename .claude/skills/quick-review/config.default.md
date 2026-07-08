---
# Quick Review defaults -- DO NOT EDIT
# Override in .claude/config/quick-review.md (project) or ~/.claude/config/quick-review.md (user)
model: sonnet
strictness: normal
scope:
  include: ["**/*"]
  exclude: ["node_modules/**", "dist/**"]
thresholds:
  severity_blocking: high
  max_findings: 20
custom_rules: []
output_format: verbose
persistent_facts: []
---
Default configuration for quick-review skill.
