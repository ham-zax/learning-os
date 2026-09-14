# Backend practical work

These optional, original starters are small executable models, not production implementations or database emulators. Copy a selected file into a disposable learner workspace only after the learner adopts practical work or gives an applicable standing instruction; otherwise continue conversationally. The agent supplies setup; the learner owns the selected prediction, invariant, diagnosis or repair. Keep decisive outputs hidden until a cold prediction is committed.

## Last seat: a concurrency interleaving

File: `labs/reservation-model.mjs`. Command from the repository root: `node knowledge/backend-systems/labs/reservation-model.mjs`.

**Contract:** starting with one item, two concurrent reservation attempts must yield one success, one failure and zero remaining stock. Starting with no stock, neither succeeds. State changes belong to the inventory instance, not a process-global variable.

**Instructor observation:** the original accepts both attempts and finishes with negative stock. Its deliberate suspension permits both callers to pass the availability decision before either applies the effect. Ask the learner to identify this decision/effect boundary rather than merely remove async keywords by habit.

This checks an in-memory concurrency model. A single-process synchronous decision/effect can repair this model but is NOT a distributed database solution. For the existing database implementation objective, freeze the environment: a conditional update, locking or suitable transaction/retry mechanism must be executed against disposable PostgreSQL when PostgreSQL correctness is the claim. No real production database is needed or authorized by the course.

A suitable SQL contract can start with `inventory(sku PRIMARY KEY, stock INTEGER CHECK (stock >= 0))` and a conditional decrement that reports whether it affected a row. Concurrent execution and transaction boundaries must match the actual task. Do not grant SQL implementation evidence from a Node-only simulation.

## Duplicate command: an overlapping retry

File: `labs/duplicate-command.mjs`. Command: `node knowledge/backend-systems/labs/duplicate-command.mjs`.

**Contract:** in one process lifetime, concurrent requests with the same operation identity and payload must apply the effect once and return the same result. Different identities remain independent. Specify the policy for failed effects and conflicting payloads before assessing those cases; they are not hidden requirements.

**Instructor observation:** the original completed-results cache allows both overlapping effects to run. The driver produces total 10 from two requests for one effect of 5. A repair of this bounded model should produce one effect and matching results. A new process loses this memory: persisting a production idempotency guarantee requires a durable owner, atomic coordination and a declared retention/recovery contract.

Use the existing `retries-idempotency-and-uncertain-outcomes:predict` or `:design` target for the trace/design. Only activate an implementation capability when it is explicitly selected. A successful local exercise does not prove broker delivery guarantees or durable exactly-once side effects.

## Observation-driven cases

Other phases use small request timelines, cache interleavings, authorization decisions and latency breakdowns. Supply the relevant facts; let the learner choose a diagnostic observation. Fictional numbers are scenario inputs, not real telemetry. Never manufacture execution results, install a production service, or change a real application's permissions merely to complete an exercise.

## Completion and notes

Record the actual response under the frozen capability. A guided repair stays guided; later independent transfer requires an appropriate changed surface. Save requested notes through the existing context/snapshot APIs, using only the learner's real history. Keep the note short enough to revisit before an interview.
