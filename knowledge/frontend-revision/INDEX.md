# Frontend Revision: Recover, Reason, Build

Revision-first JavaScript and browser core, with independently selectable React, Angular and internals branches. Not a claim of exhaustive frontend expertise.

The aim is usable technical knowledge with little compulsory overhead. Prior experience changes where to diagnose, not what is considered mastered. Read [the shared coding teacher workflow](../../docs/coding-courses.md), then load only the selected phase and concept card.

## Route

| Phase | Lane | Practical outcome |
| --- | --- | --- |
| [Recover the JavaScript execution model](units/f01.md) | core | Explain and predict binding, value and object-lifetime behavior without a trivia marathon. |
| [Async results, errors and execution order](units/f02.md) | core | Control async work and explain observable ordering, error propagation and stale-result behavior. |
| [Browser interactions and user-visible correctness](units/f03.md) | core | Connect JavaScript to event ownership, network boundaries and an observable UI symptom. |
| [React state ownership and effect lifetimes](units/r01.md) | react | Reason about UI state, identity and synchronization rather than recite Hook definitions. |
| [React asynchronous UI, rendering boundaries and diagnosis](units/r02.md) | react | Explain asynchronous and server/client behavior in the actual project environment. |
| [React internals when they answer a real question](units/rx.md) | extension | Use a narrow internal model to explain an observed scheduling or identity behavior. |
| [Angular reactive state and dependency lifetimes](units/a01.md) | angular | Connect signal dependencies, injector ownership and async lifetime to the displayed UI. |
| [Angular features, navigation and diagnostic work](units/a02.md) | angular | Design a feature whose form, requests, routes and service lifetimes stay coherent. |

Default proposal units: `f01`, `f02`, `f03`. Other units remain available without automatic enrollment. Existing learners keep their goal membership; selecting a route is not permission to reset evidence or discard unfinished work.

## Start, finish and depth
Start from the existing continuation, or a small task that discriminates between remembered knowledge and a genuine gap. Progress is not pages read or elapsed days. Finish the selected goal when its actual capability, transfer and durability requirements are met; inspect evidence receipts for claims. A short-route completion does not certify every optional branch.

A strong answer can close an episode. A useful detour can teach one missing foundation. Deep reference material is there when needed, not a mandatory reading load. Neither agent-generated code nor a polished teacher explanation is proof that the learner can independently produce the solution.

## Working material
- [Sources and local locators](SOURCES.md).
- [Practical lab instructions](LABS.md).
- `course.json`: route, source IDs and objective identities.
- `concepts/`: compact reusable technical references, linked from the global catalog.

A note is a derived learning aid, not evidence. FSRS remains the only owner of valid recall timing. One-episode mode removes an artificial time estimate; it does not accelerate elapsed retention time or change review dates.
