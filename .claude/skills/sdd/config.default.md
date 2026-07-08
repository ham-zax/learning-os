---
# SDD defaults -- DO NOT EDIT
# Override in .claude/config/sdd.md (project) or ~/.claude/config/sdd.md (user)
model: sonnet
strictness: normal
coder_model: sonnet
reviewer_model: sonnet
max_retries: 3
wave_size: 3
scope:
  include: ["**/*"]
  exclude: ["node_modules/**", "dist/**"]
custom_rules: []
output_format: verbose
persistent_facts: []
---
Default configuration for sdd skill.
