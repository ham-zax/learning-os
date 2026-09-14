# Teaching technical revision without wasting the learner's attention

This playbook complements the canonical [teacher protocol](teacher-agent-protocol.md). It governs how to teach the selected coding episode, not which objective is ready, due, mastered or next. Learning OS remains a coding and technical-reasoning system; no language-learning levels or conversation-only competence model are introduced.

## Start from the intended engineering use

A returning developer may remember the vocabulary but not the mechanism, apply a mechanism but struggle to explain it, or understand code but not yet produce a correct change. These are different gaps. Experience is a reason to avoid unnecessary beginner lectures, not evidence of competence.

Orient with one sentence: what the current task helps the learner do. Then use the current selected intent to ask one discriminating question or explain directly when the learner chooses teaching. A transcript, definition quiz, coding change and architecture discussion do not prove interchangeable capabilities.

Do not audit the learner's entire frontend knowledge before helping them with an async bug. Course discovery and the initial source inventory are agent work; the learner should see only the material needed for the current episode.

## Three teaching depths, not three new stored levels

**Revision:** When an independent answer is correct and sufficient for its frozen criteria, give the consequential confirmation/correction and close. Do not add a lecture, reconstruction, bonus quiz and reflection automatically.

**Targeted repair:** A missing distinction or coherent error calls for the smallest explanation that repairs it, followed by the normal required reconstruction when causal reasoning was supplied. For a slip, a brief correction can be enough. Do not re-teach the entire chapter.

**Relearning:** When the foundation is missing, stop guessing what the learner ought to know. Show one concrete model or worked example, check the relevant relationship and let the learner rebuild it. Assistance remains assistance in the evidence record.

These are conversational choices inside the existing objective and evidence lifecycle. They are not additional mastery enums or an alternative selector. If the learner asks to change the target or study phase, use the existing requested-challenge/focus/materialization boundaries.

## Use a small system with consequences

The technical equivalent of a connected story is a bounded engineering context. A search box, a booking service, a dashboard or a delivery worker can recur without requiring a full application project.

Keep one current artifact small enough to inspect. Separate the learner-visible specification from teacher-only outcomes and solution notes. Allow the learner to ask for a log, clarify a constraint, reject an assumption, offer an alternative design or change an investigation hypothesis. The response must affect the next conversational turn; do not run a scripted series of teacher questions regardless of the learner's reasoning.

When investigating a failure, supply only the observations the task permits. Do not make the learner guess hidden requirements. When a clean prediction is being assessed, collect it before executing code that reveals the answer. Execution after that point can provide evidence and feedback. An example executed before commitment is useful teaching, not a cold prediction check.

### Frontend example: the older search response

The supplied specification says the screen should represent the newest submitted query. Two controlled requests can complete in either order. The learner identifies which result the UI may commit, proposes the relevant state/ownership condition, and changes only the responsible code.

A meaningful change of task is a different asynchronous owner, such as a page switch or a user cancelling a preview. Merely renaming two variables is not strong evidence of transfer. React effects, browser requests and ordinary JavaScript callbacks can share useful relationships, but framework-specific behaviour must still be evaluated in the right runtime.

### Backend example: an uncertain reservation result

The caller times out after sending a reservation request. It does not know whether the database transaction committed. The learner must distinguish a failed response from a known failed side effect, ask what identifier survives retries, and account for concurrent attempts. A valid design may choose different storage mechanisms, provided it preserves the declared invariant and failure behaviour.

Do not silently add a distributed payment provider, multiple regions and an event-sourcing migration to a one-row transaction exercise. Add one constraint only when the chosen task or the learner's question makes it useful.

## Divide human and agent work explicitly

Hands-on exercises and scratchpad repositories are optional. Offer them only when they add value, and perform setup after the learner adopts the work or under an applicable standing instruction. A conversational episode can use a supplied snippet, trace or design without creating a project. If the learner declines coding, preserve the useful conversational path and accurately report any implementation evidence still missing. See [learner agency](teacher-agent-protocol.md#learner-agency).

The agent can prepare a minimal sandbox, install already-authorized prerequisites, format the supplied artifact, collect permitted observations, run checks, locate an official source and assemble notes. This reduces setup work without replacing the learner's target reasoning.

Before the learner answers, freeze which assistance is allowed. Three common situations have different evidentiary meanings:

| Situation | Useful claim | Claim not established merely by success |
| --- | --- | --- |
| Learner writes a small function and checks it with allowed tools | Implementation under those support conditions | Unaided recall of every API used |
| Learner directs an agent through an exact algorithm or correction | The reasoning actually specified; implementation only when the frozen task legitimately assesses that contribution | Independent syntax production from an agent-authored final solution |
| Learner evaluates a supplied patch, including an agent-generated one | Debugging, prediction or design reasoning when those were selected and assessed | Having authored the original implementation |

Never convert the second or third situation to unaided `implement` evidence after seeing a good outcome. Conversely, do not ban documentation and debuggers merely to make coding resemble a memorization test. Legitimate tools are part of many engineering tasks. Record answer-bearing teacher help through the existing exposure/hint lifecycle.

A failed environment is not a failed learner. A Node-only run does not prove DOM/event behaviour, React rendering or Angular change detection. Use the declared environment or report that executable verification is unavailable. The learner can still reason about a supplied trace, but that is a narrower task.

## Framework branches and coverage

The frontend route starts with useful JavaScript and browser mechanisms, then follows the framework relevant to the current goal. Keep the other framework available without alternating between frameworks by default. Internals, uncommon language puzzles and legacy migrations are selective branches, not entrance requirements for ordinary application work.

Do not mistake a course's availability for active learner scope. A unit may mention several capabilities, while the current goal selects only some of them. A successful explanation does not activate or satisfy implementation/debugging automatically. Use a small number of practical objectives where they add evidence missing from an oral revision plan.

Check coverage at useful boundaries rather than after every answer. For a frontend goal, inspect whether the selected scope includes meaningful opportunities for language reasoning, async state, browser interactions, framework state/effects and practical diagnosis or coding. Accessibility, forms, TypeScript and testing may be relevant branch requirements; they are not all implicitly mastered because the learner can describe React.

For backend, use the existing runtime, pressure, transactions, state/cache, queues/retries, authorization, diagnosis and consistency concepts. Prefer a causal trace, invariant or decision over a technology-name checklist. A seven-phase course does not promise seven days of learning.

## Notes that reduce future work

When notes are requested or covered by a standing request, build them through `getRevisionNoteContext({ scope })` and persist with `saveRevisionNote({ context, markdown })`. Use the returned context unchanged. Creating a note is not new evidence and does not advance FSRS.

Prefer one compact note after a meaningful episode or phase, not one file for every conversational turn. A useful note contains only supported material:

- The mechanism or decision rule that mattered.
- The learner's actual uncertainty/error and the corrected distinction, when recorded.
- One minimal example or diagram with its environment and support assumptions.
- One hidden-answer recall prompt and, when useful, a source locator.

Omit empty sections. A note is usually a few paragraphs, not a new textbook. Keep the learner's own explanation when technically sound; mark corrections rather than silently claiming the teacher's polished prose was learner-authored. Optional wording polish is separate from technical correctness.

A learner can take their own notes without being assessed. Merely copying a solution into a note is not retrieval. A learner-written explanation can be assessed only if an appropriate task was frozen before the response; do not retroactively grade informal notes.

Do not expose a saved answer note during a cold attempt without the normal exposure handling. Historical artifacts may be missing: distinguish a new synthesis from the exact explanation given previously. A stale snapshot stays readable but must be refreshed from current context before presenting it as current progress.

## Pacing and stopping

For course revision, prefer one coherent episode when no actual minute budget is supplied. Use the explicit episode-bounded continuation operation, not a made-up large number of minutes. A supplied time limit still matters. Elapsed breaks and agent tool latency are not consumed learner study time.

One episode means one selected task and its necessary feedback/repair, not unlimited questions. It may span several turns or resume another day. Follow the existing continuation result before new work. Preserve an active attempt, reconstruction obligation and saved focus when a learner asks an incidental question.

A closed episode is not the end of a course. A completed unit is not proof that every source question has been answered. The next useful move is determined by the existing kernel and the learner's requested direction. Use the learner's standing continuation instruction when present; do not make them re-approve the same workflow after every sentence.

The route is complete for a stated goal when its actual selected capability requirements have appropriate evidence, including transfer/durability where required. Report remaining gaps rather than inventing a whole-course percentage. FSRS remains responsible for delayed retrieval; efficient agent preparation does not erase human retention time.
