# Backend Systems: Invariants, Failures, Recovery

Seven conceptual phases for backend reasoning, practical concurrency work and interview transfer. No prescribed calendar duration.

The aim is usable technical knowledge with little compulsory overhead. Prior experience changes where to diagnose, not what is considered mastered. Read [the shared coding teacher workflow](../../docs/coding-courses.md), then load only the selected phase and concept card.

## Route

| Phase | Lane | Practical outcome |
| --- | --- | --- |
| [Runtime, concurrency and backpressure](units/b01.md) | core | Locate execution, waiting and capacity limits in a request path. |
| [Transactions and connection pressure](units/b02.md) | core | Protect a business invariant under concurrency and separate pool wait from query execution. |
| [State ownership, cache visibility and replicas](units/b03.md) | core | State an explicit freshness contract and reason about stale cache publication. |
| [Queue delivery, retries and uncertain outcomes](units/b04.md) | core | Separate transport acknowledgement from business-effect duplication safety. |
| [Authorization and long-lived connections](units/b05.md) | core | Enforce resource access at the owner and handle permission changes over time. |
| [Production diagnosis and architecture boundaries](units/b06.md) | core | Choose one discriminating measurement and scale the demonstrated bottleneck. |
| [Replication, integration and interview transfer](units/b07.md) | core | Combine visibility, acknowledgement and recovery guarantees in an unfamiliar case. |

Default proposal units: `b01`, `b02`, `b03`, `b04`, `b05`, `b06`, `b07`. Other units remain available without automatic enrollment. Existing learners keep their goal membership; selecting a route is not permission to reset evidence or discard unfinished work.

## Start, finish and depth
Start from the existing continuation, or a small task that discriminates between remembered knowledge and a genuine gap. Progress is not pages read or elapsed days. Finish the selected goal when its actual capability, transfer and durability requirements are met; inspect evidence receipts for claims. A short-route completion does not certify every optional branch.

A strong answer can close an episode. A useful detour can teach one missing foundation. Deep reference material is there when needed, not a mandatory reading load. Neither agent-generated code nor a polished teacher explanation is proof that the learner can independently produce the solution.

## Working material
- [Sources and local locators](SOURCES.md).
- [Practical lab instructions](LABS.md).
- `course.json`: route, source IDs and objective identities.
- `concepts/`: compact reusable technical references, linked from the global catalog.

A note is a derived learning aid, not evidence. FSRS remains the only owner of valid recall timing. One-episode mode removes an artificial time estimate; it does not accelerate elapsed retention time or change review dates.
