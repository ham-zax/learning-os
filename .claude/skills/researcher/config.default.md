---
# Researcher defaults -- DO NOT EDIT
# Override in .claude/config/researcher.md (project) or ~/.claude/config/researcher.md (user)
model: sonnet
strictness: normal
explorer_model: haiku
critic_model: sonnet
max_explorers: 4
scope:
  include: ["**/*"]
  exclude: ["node_modules/**", "dist/**"]
custom_rules: []
output_format: verbose
persistent_facts: []
---
Default configuration for researcher skill.
