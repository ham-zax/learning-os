# Efficient conversational teaching

Status: Implemented on 2026-10-24, after the user authorized implementation.
Date: 2026-10-24.
Baseline: `main`, commit `5b6bfb5`, `/home/ubuntu/repo/learning-os`.

## Goal and evidence

Help the learner understand with only the preparation and execution work the lesson needs.
Preserve effective recall-based study for tracked work. Do not impose that approach on ad-hoc exploration.

The reviewed session made 33 tool calls before its first lesson. HTML and screenshot work accounted for 19 calls and approximately 174 seconds.
The teacher also installed a framework and executed a demonstration before the learner adopted practical work.
These observations come from visible messages and tool actions, not private reasoning.

The current instructions permit progressive discovery of native features, skills, and connected tools.
They provide a text fallback but lack a clear stopping rule for optional presentation work.
The presentation advisor only ranks supplied capabilities. It does not install dependencies or execute tools.

Decision: docs/instructions-only. The teacher owns these choices, so repair its operating instructions first.
Do not add a kernel gate, dependency checker, tool-budget service, reviewer, or persistent preference for this change.

## Intended behavior

### Teach before expanding preparation

- Complete the existing required repository and episode readiness steps. Reuse them within the same session as already permitted.
- Prepare only what the next useful explanation requires. Avoid tool work that does not change that explanation.
- Start with a concrete problem and a few connected relationships. Preserve a broad conceptual overview when requested.
- Defer full implementations and advanced operational details until they serve the learner's current request.
- Keep routine preparation details out of the lesson. Explain access limits or uncertainty when they affect the answer.
- Do not add fixed lesson lengths, concept quotas, tool-call quotas, or mandatory questions.

### Keep ad-hoc and tracked teaching distinct

- Ad-hoc: explain, answer, and adapt conversationally. Do not impose recall-first, surprise quizzes, repeated proof, or scheduled review.
- A useful prediction or reasoning question remains optional. Ask only after explaining the necessary mechanism, then wait for the response.
- Do not ask the learner to repeat an answer the teacher just supplied as a compulsory checkpoint.
- Honor explanation-only requests. Learner-requested practice remains possible through the existing route and effort-choice rules.
- Do not infer mastery, evidence, goals, or review state from ad-hoc discussion.
- Tracked: preserve continuation, frozen criteria, retrieval, exposure, feedback, reconstruction, and FSRS ownership.
- An identifiable active tracked attempt still uses its existing rules. Calling a conversation ad-hoc does not erase that attempt.

### Make visuals optional and native by default

- Use prose, Markdown, tables, formulas, and small text sketches when sufficient.
- Use a native diagram or visual only when its renderer is already known to work and the visual clarifies the current mechanism.
- Check support before preparing the visual. A browser listing does not establish a working teaching renderer.
- Do not create HTML pages, start servers, automate browsers, or capture screenshots merely to illustrate an ordinary lesson.
- If an optional renderer fails or is unavailable, use text immediately. Do not troubleshoot it during teaching.
- Explicit requests for an HTML lesson, simulation, exported diagram, or other artifact can justify that workflow.
- A general request for useful visuals does not authorize an artifact-building workflow.
- Keep a complete text explanation and preserve accessibility and exposure rules.

### Limit execution and require installation consent

- Prefer a small snippet or trace table when execution adds no necessary information.
- Use existing execution tools when they resolve a real uncertainty or support adopted practical work. Keep the example minimal.
- Preserve real execution when a tracked challenge's frozen conditions require executable checking.
- Do not install a framework, dependency, browser, plugin, or integration merely because the topic mentions it.
- Do not create a virtual environment or project scaffold merely to prepare a conceptual lesson.
- If an installation becomes necessary, state the package, target environment, purpose, and text-only alternative. Ask before installing and await consent.
- An explicit installation instruction authorizes that installation within its stated scope. Do not request the same permission again.
- Requests to teach, use a framework in an example, or show useful visuals do not by themselves authorize installation.
- If consent is absent or declined, continue conceptual teaching where possible. State any resulting execution limitation accurately.

### Research only claims that need it

- Keep the existing authoritative-source requirements for changing APIs, versions, support, and security claims.
- Stable conceptual explanations do not require a release lookup or package installation.
- Avoid introducing a latest-release claim solely to begin a first-principles lesson.
- Check applicable documentation when real API code becomes relevant. Documentation checking does not authorize installation.

## Implementation tasks

1. Update `skills/learning-os-teacher/SKILL.md`.
   Make the teaching, execution, installation, and ad-hoc boundaries visible in the main operating instructions.
   Replace the default presentation-discovery ladder with native-first presentation and immediate text fallback.

2. Update the portable references.
   In `references/presentation-capabilities.md`, define the visual boundary and renderer failure rule.
   In `references/reasoning-retrieval-playbook.md`, keep retrieval-first techniques scoped to applicable tracked work.
   Clarify optional reasoning questions and efficient concept construction in its ad-hoc section.
   In `references/research-grounding.md`, distinguish source checking from installation or environment setup.
   All reference paths in this task are relative to `skills/learning-os-teacher/`.

3. Synchronize repository entry points and explanations.
   Update the presentation paragraph in `AGENTS.md` and relevant sections of `docs/teacher-agent-protocol.md`.
   Update `docs/capability-aware-teaching.md` so examples do not restore the old discovery or screenshot workflow.
   Keep concise defaults in entry points and detailed exceptions in the existing references.
   Do not create another policy document or provider-specific teacher wrapper.

4. Check the existing presentation helper's wording.
   `src/teacher-presentation.ts` and `src/presentation-cli.ts` remain unchanged unless an instruction actually grants conflicting authority.
   Their rankings remain optional. Availability is not installation consent or a command to create a visual.
   Do not expand their types, configuration, or APIs to enforce conversational behavior.

5. Check the experience against the scenarios below and report the result.
   Use bounded document review and synthetic conversation walkthroughs.
   Do not run a live teaching session, create learner state, or call a paid reviewer for validation by default.

## Acceptance scenarios

- First-principles framework introduction: complete readiness, then teach the mechanism without package installation or a visual build pipeline.
- Useful visuals requested, native renderer available: use one relevant native visual and its text explanation.
- Renderer absent or failed: deliver the text explanation without browser recovery, servers, or screenshots.
- Ad-hoc explanation-only request: explain without a recall checkpoint or automatic quiz.
- Learner requests practical code: use the smallest useful example and existing tools. Missing packages still require installation consent.
- Installation becomes necessary: explain the target and reason, ask, and wait. A declined installation leaves conceptual help available.
- Learner explicitly requests installation: execute only the authorized installation scope without another permission loop.
- Learner explicitly requests an HTML lesson artifact: the artifact workflow is available, subject to its actual tool and installation permissions.
- Tracked review or coding assessment: preserve current continuation, retrieval, frozen conditions, and required executable checking.
- Stable conceptual claim: no latest-version lookup. Version-sensitive API example: check applicable authoritative documentation without implicit installation.

## Verification and boundaries

TDD Route: off / skipped. This plan changes teacher instructions, not kernel behavior.
Automated test creation, modification, and execution are outside this plan.
Check document links and inspect the changed instructions for conflicting installation, visualization, and recall defaults.
Walk through both the ordinary lesson and explicit artifact-request exceptions. A document check does not prove future agent compliance.

No learner database, scheduler, schema, curriculum, assessment contract, or global host configuration changes.
No Jev integration, automatic observation, or enforcement activation is part of this work.
Do not copy the private transcript, tool outputs, or credentials into the repository.
At planning start, unrelated work affected `docs/teacher-evaluation.md`, `src/evaluation/cli.ts`, and `src/evaluation/jev-review.ts`.
Do not alter or absorb that work during this implementation.

Host instructions can override repository guidance. If a host requires generated HTML for ordinary teaching, record that conflict for its owner.
Do not claim that repository edits override a higher-priority host instruction or enforce this policy across providers.

## Stop condition

This turn delivers the plan only. Implementation waits for the user's next instruction.
After authorization, stop when the named instruction surfaces agree and the acceptance walkthroughs reveal no unresolved policy conflict.
Report any remaining host-level limitation without expanding into host changes or another runtime subsystem.

## Implementation result (2026-10-24)

Changed instruction surfaces:

- `skills/learning-os-teacher/SKILL.md`
- `skills/learning-os-teacher/references/presentation-capabilities.md`
- `skills/learning-os-teacher/references/reasoning-retrieval-playbook.md`
- `skills/learning-os-teacher/references/research-grounding.md`
- `skills/learning-os-teacher/references/teacher-protocol.md` (stale discovery wording aligned)
- `AGENTS.md`
- `docs/teacher-agent-protocol.md`
- `docs/capability-aware-teaching.md`

`src/teacher-presentation.ts` and `src/presentation-cli.ts` are unchanged. Their comments already describe optional, agent-supplied ranking, and they grant no artifact or installation authority.

Verification: relative document links resolve. The ten acceptance scenarios pass a document review and synthetic walkthrough. No live teaching session, learner state, kernel, schema, scheduler, curriculum, or assessment contract changed.
