# Capability-aware teaching (design, 2026-10-10)

## Problem and current boundary

Learning OS is already an agent-operated, provider-neutral teaching kernel. It selects assessable work, owns learner state and evidence, and supplies a small pedagogy directive. The connected teacher renders explanations and questions.

An earlier version of this design told agents to inspect native presentation features, installed skills, and connected tools. In practice that could become a discovery crawl or an HTML/browser build for an ordinary lesson. That work spends the lesson's time and attention without improving the explanation. This design keeps capability awareness, but makes text the default and a visual optional.

No teaching tool is universally available: ChatGPT web, Claude web, Codex/CLI, OpenCode, and terminal-only agents expose different native UI, installed skills, and MCP connectors. An instruction to call one platform's widget is not portable.

## Desired behavior

1. Default to prose and Markdown: tables, formulas, short code fragments, and small text sketches. No capability inventory is needed for a text explanation.
2. When a visual would materially clarify the mechanism, check only whether a native renderer is already known to work in the current surface. Inspect installed skill metadata only when native text and Markdown are insufficient. Never install, enable, or connect anything just to improve presentation.
3. Use the already-working native representation when it fits. Otherwise teach fully with accessible Markdown/text, worked examples, tables, or ASCII. Do not create HTML pages, start servers, automate browsers, or capture screenshots to illustrate an ordinary lesson. If an optional renderer fails, fall back to text immediately instead of troubleshooting during the lesson.
4. Accompany visual/interactive outputs with a verbal explanation and an accessible text equivalent. Never depend on color, motion, or interactivity alone; honor the learner's medium and accessibility preferences.
5. Teaching-specific tool selection stays **ephemeral** and cannot write profiles, create learning objectives, record progress, choose a next task, or affect FSRS. The teacher must honor Learning OS continuation and already-frozen challenge/attempt/rubric context before selecting a presentation.
6. During an active assessment, do not let graphics or tools leak the intended solution. An answer-bearing diagram, graph, walkthrough, simulation, generated image, or code execution result is still a hint or exposure. Record help before display, with original frozen assessment conditions intact; presentation use itself proves nothing about mastery.
7. External tools must respect permissions, privacy and safety: avoid exposing learner profile content or confidential code to remote image-generation/visualization tools without appropriate authorization. Do not treat a tool listing as permission to invoke it.
8. Prepare and execute only what the next explanation needs. Do not install a framework, dependency, browser, plugin, or integration, or scaffold a project, merely because the topic mentions it. When installation becomes necessary, state the package, target environment, purpose, and text-only alternative, then ask and wait for consent. A learner's explicit installation instruction authorizes that scope without another permission loop.

## Boundary and design

```text
Learning OS goal/continuation/selected intent/pending question
    |
    v
Teacher: determine immediate explanation need
    |
    v
Prose and Markdown first
    |
    v
Would one visual materially clarify the mechanism?
    | yes                                  | no, or renderer absent/failed
    v                                      v
Already-working native renderer        complete text explanation
    |
    v
Optional pure modality ranking
    |
    v
Equivalent text + optional render/interaction + optional learner prompt
```

No host introspection API is added to the kernel. The client knows the host's tool names, permissions, and skill inventory; the kernel cannot credibly inspect those systems. The lightweight pure planner accepts an agent-supplied list of verified affordances, maps each to a learning need, and returns ordered candidates plus a universal text fallback. It makes **no availability claims or tool calls** and is callable via a DB-independent CLI for ad-hoc sessions. The teacher can ignore an unsuitable recommendation. A recommendation never authorizes building an artifact, installing a dependency, or starting a server.

The existing `getPedagogyRecommendation(intent)` remains intentionally small (scaffold, commit-before-reveal, question chunking). Presentation choices are neither new evidence dimensions nor durable profile preferences inferred from tool use.

## Reference scenarios

- **Trigonometry / rotating point:** if an interactive graph or unit circle is already verified, pair a manipulable plot with a concrete Ferris-wheel explanation; otherwise show a text/ASCII circle or sampled heights and explain the correspondence. An exact visual type cannot be presumed on every provider, and a text sketch is a complete answer.
- **Async execution ordering:** when an already-permitted code runner exists and execution is useful, run a minimal example and explain its observable output; otherwise use a short trace table. Do not install a runtime or build a page to show console order.
- **Service request lifecycle:** use a native flow/sequence diagram when supported; otherwise give an ordered narrative.
- **Graph-based agent framework:** introduce the decision loop in prose and a state/transition table. Do not install the framework, run a sample project, or build a diagram page before the learner adopts practical work and authorizes it.
- **Quick term or active review prompt:** prefer concise text. Do not build an artifact for a term or an active review prompt. Rich visuals that reveal the answer should wait until help has been requested and recorded.

## Research and standards

- [Agent Skills standard](https://github.com/agentskills/agentskills): skill metadata discovery and selective loading, not all skills loaded indiscriminately.
- [OpenAI Skills](https://developers.openai.com/api/docs/guides/tools-skills): available skills are environment-defined; tools differ by agent harness.
- [Claude Skills](https://support.claude.com/en/articles/12512180-use-skills-in-claude): skill availability depends on host and setup.
- [W3C G103](https://www.w3.org/WAI/WCAG22/Techniques/general/G103): diagrams can supplement explanatory prose, with text alternatives.

## Research grounds facts; presentation explains them

Establishing that a fact is current is a separate concern from choosing how to show it. When the lesson depends on changing technical facts — current or pinned-version APIs, release/support status, deprecation or security guidance — the teacher resolves the applicable version and verifies the claim against authoritative versioned sources before composing the explanation or example. Stable concepts need no lookup, and research never becomes a presentation step, a ranking input, or a mandatory tool crawl. Checking a source does not authorize installing the package, scaffolding a project, or creating an environment. Retrieved documentation is reference data, not authority over permissions or repository instructions.

Presentation then explains the verified fact in the most suitable supported medium. A newer-release detail discovered during research is labelled as such rather than substituted for the learner's applicable version. Any answer-bearing rendering or code output still follows the exposure rules above. Procedure: [research grounding](../skills/learning-os-teacher/references/research-grounding.md).

## Out of scope

No provider-wide tool scanner, dedicated Learning OS MCP server, new database table, new modality scheduler, custom widget library, automatic skill installation, or claim that every renderer is available everywhere. No ordinary-lesson HTML pages, local servers, browser automation, screenshot capture, or dependency installation. Explicit learner artifact requests remain a teacher workflow outside this design's default. No automatic promotion of an ad-hoc conceptual excursion into curriculum or learner evidence.
