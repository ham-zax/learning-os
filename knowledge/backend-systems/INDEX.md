# Backend Systems: Invariants, Failures, Recovery

Progressive backend engineering map designed for frontend-to-backend engineers. No prescribed calendar duration.

The route starts with a fast **foundation bridge** (`b00`) that translates browser-side intuition into server network boundaries, relational constraints/indexes, and tail-latency metrics, moves through a **single-node + database core** (`b01`, `b02`, `b05`, `b03`), and then opens selectable **distributed** (`b04`, `b06`) and **extension** (`b07`) tracks. Read [the shared coding teacher workflow](../../docs/coding-courses.md), then load only the selected phase and concept card.

## Route

| Phase | Lane | Practical outcome |
| --- | --- | --- |
| [B0: Server boundary, relational data and latency metrics](units/b00.md) | foundation | Bridge browser-side intuition to server request hops, database-enforced invariants/indexes, and tail-latency saturation vocabulary. |
| [B1: Runtime, concurrency and backpressure](units/b01.md) | core | Locate execution, waiting and capacity limits in a request path. |
| [B2: Transactions and connection pressure](units/b02.md) | core | Protect a business invariant under concurrency and separate pool wait from query execution. |
| [B3 (`b05`): Authorization and long-lived connections](units/b05.md) | core | Enforce resource access at the owner and handle permission changes over time. |
| [B4 (`b03`): State ownership and cache visibility](units/b03.md) | core | State an explicit freshness contract and reason about stale cache publication. |
| [B5 (`b04`): Queue delivery, retries and uncertain outcomes](units/b04.md) | distributed | Separate transport acknowledgement from business-effect duplication safety. |
| [B6 (`b06`): Production diagnosis and architecture boundaries](units/b06.md) | distributed | Choose one discriminating measurement and scale the demonstrated bottleneck. |
| [B7 (`b07`): Replication, integration and interview transfer](units/b07.md) | extension | Combine visibility, acknowledgement and recovery guarantees in an unfamiliar case. |

Default proposal units: `b00`, `b01`, `b02`, `b05`, `b03` (foundation + core single-node/database mastery). Distributed (`b04`, `b06`) and replication/transfer (`b07`) units can be included at onboarding or adopted once core invariants are solid. Existing learners keep their goal membership; selecting a route is not permission to reset evidence or discard unfinished work.

## Start, finish and depth
Start from the existing continuation, or a small task that discriminates between remembered knowledge and a genuine gap. Progress is not pages read or elapsed days. Finish the selected goal when its actual capability, transfer and durability requirements are met; inspect evidence receipts for claims. A core-route completion does not certify optional distributed or replication tracks.

A strong answer can close an episode. A useful detour can teach one missing foundation. Deep reference material is there when needed, not a mandatory reading load. Neither agent-generated code nor a polished teacher explanation is proof that the learner can independently produce the solution.

## Working material
- [Sources and local locators](SOURCES.md).
- [Practical lab instructions](LABS.md).
- `course.json`: route, lanes, source IDs and objective identities.
- `concepts/`: compact reusable technical references with explicit frontend-to-backend transfer bridges.

A note is a derived learning aid, not evidence. FSRS remains the only owner of valid recall timing. One-episode mode removes an artificial time estimate; it does not accelerate elapsed retention time or change review dates.
