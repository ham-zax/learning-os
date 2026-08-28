---
# Security Audit defaults -- DO NOT EDIT
# Override in .claude/config/security-audit.md (project) or ~/.claude/config/security-audit.md (user)
model: sonnet
strictness: normal
scope:
  include: ["**/*"]
  exclude: ["node_modules/**", "*.test.*", "*.spec.*", "dist/**", "build/**"]
thresholds:
  severity_blocking: high
  max_findings: 100
custom_rules: []
output_format: verbose
persistent_facts: []
---
Default configuration for security-audit skill.
