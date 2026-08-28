---
# Accessibility Audit defaults -- DO NOT EDIT
# Override in .claude/config/a11y.md (project) or ~/.claude/config/a11y.md (user)
model: sonnet
strictness: normal
scope:
  include: ["**/*"]
  exclude: ["node_modules/**", "dist/**", "*.test.*"]
thresholds:
  severity_blocking: high
  max_findings: 50
  wcag_level: AA
custom_rules: []
output_format: verbose
persistent_facts: []
---
Default configuration for a11y skill.
