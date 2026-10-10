# Capability-aware teaching (design, 2026-10-10)

## Problem and current boundary

Learning OS is already an agent-operated, provider-neutral teaching kernel. It selects assessable work, owns learner state and evidence, and supplies a small pedagogy directive. The connected teacher renders explanations and questions. Existing teacher instructions do not explicitly tell agents to inventory their host's native presentation capabilities, preinstalled skills, or connected tools, so an agent may use plain text even when a graph, interactive demonstration, executable example, or process diagram would be clearer.

No teaching tool is universally available: ChatGPT web, Claude web, Codex/CLI, OpenCode, and terminal-only agents expose different native UI, installed skills, and MCP connectors. An instruction to call one platform's widget is not portable.

## Desired behavior

1. At session entry, cheaply discover **available** native modalities. Inspect only installed skill/tool descriptions already exposed by the host; use deeper skill instructions/schema only when a learning task warrants it. Never install, enable, connect, or call unapproved tools just to improve presentation. No mandatory discovery crawl on every message.
2. For the actual teaching need (spatial, quantitative relation, dynamic system, causal process, code behavior, symbolic relation, or simple explanation), identify the simplest **supported** teaching representation. Prefer visual/interactive teaching **when it clarifies the mechanism**, not automatically.
3. Use the native rendering interface first when suitable; otherwise consider a relevant already-installed skill or authorized connector/MCP tool. Choose the best available fit, not the richest possible widget. If no suitable capability is available, teach fully with accessible Markdown/text, worked examples, tables, or ASCII.
4. Accompany visual/interactive outputs with a verbal explanation and an accessible text equivalent. Never depend on color, motion, or interactivity alone; honor the learner's medium and accessibility preferences.
5. Teaching-specific tool selection stays **ephemeral** and cannot write profiles, create learning objectives, record progress, choose a next task, or affect FSRS. The teacher must honor Learning OS continuation and already-frozen challenge/attempt/rubric context before selecting a presentation.
6. During an active assessment, do not let graphics or tools leak the intended solution. An answer-bearing diagram, graph, walkthrough, simulation, generated image, or code execution result is still a hint or exposure. Record help before display, with original frozen assessment conditions intact; presentation use itself proves nothing about mastery.
7. External tools must respect permissions, privacy and safety: avoid exposing learner profile content or confidential code to remote image-generation/visualization tools without appropriate authorization. Do not treat a tool listing as permission to invoke it.

## Boundary and design

```text
Learning OS goal/continuation/selected intent/pending question
    |
    v
Teacher: determine immediate explanation/representation need
    |
    v
Host capability inventory (ephemeral, verified, only relevant features)
  native rendering -> installed skill metadata -> connected tools/MCP
    |
    v
Pure modality ranking (optional: presentation CLI/module)
    |
    v
Teacher chooses safe and usable representation
    |
    v
Equivalent text + optional render/interaction + one useful learner prompt
```

No host introspection API is added to the kernel. The client knows the host's tool names, permissions, and skill inventory; the kernel cannot credibly inspect those systems. The lightweight pure planner accepts an agent-supplied list of verified affordances, maps each to a learning need, and returns ordered candidates plus a universal text fallback. It makes **no availability claims or tool calls** and is callable via a DB-independent CLI for ad-hoc sessions. The teacher can ignore an unsuitable recommendation.

The existing `getPedagogyRecommendation(intent)` remains intentionally small (scaffold, commit-before-reveal, question chunking). Presentation choices are neither new evidence dimensions nor durable profile preferences inferred from tool use.

## Reference scenarios

- **Trigonometry / rotating point:** if an interactive graph or unit circle is verified, pair a manipulable plot with a concrete Ferris-wheel explanation; otherwise show an SVG/ASCII circle or sampled heights and explain the correspondence. An exact visual type cannot be presumed on every provider.
- **Async execution ordering:** when an already-permitted code runner exists and execution is useful, run a minimal example and explain its observable output; otherwise use a short trace table. Never execute arbitrary learner code without evaluating safety and permission.
- **Service request lifecycle:** use a flow/sequence diagram when supported; otherwise give an ordered narrative.
- **Quick term or active review prompt:** prefer concise text. Rich visuals that reveal the answer should wait until help has been requested and recorded.

## Research and standards

- [Agent Skills standard](https://github.com/agentskills/agentskills): skill metadata discovery and selective loading, not all skills loaded indiscriminately.
- [OpenAI Skills](https://developers.openai.com/api/docs/guides/tools-skills): available skills are environment-defined; tools differ by agent harness.
- [Claude Skills](https://support.claude.com/en/articles/12512180-use-skills-in-claude): skill availability depends on host and setup.
- [W3C G103](https://www.w3.org/WAI/WCAG22/Techniques/general/G103): diagrams can supplement explanatory prose, with text alternatives.

## Out of scope

No provider-wide tool scanner, dedicated Learning OS MCP server, new database table, new modality scheduler, custom widget library, automatic skill installation, or claim that every renderer is available everywhere. No automatic promotion of an ad-hoc conceptual excursion into curriculum or learner evidence.
