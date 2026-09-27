# Calibrated prediction examples: `js-async-await:predict`

These are teacher-only examples for the [async results unit](../../units/f02.md). The canonical case data and answer keys are in `calibration.json`; the three `.mjs` files are the exact code surfaces a learner may see. They are not pre-registered learner challenges or a required sequence.

## Use after selection

1. Resolve the current learner and call `getStudyContinuation(...)` or the appropriate requested-challenge boundary. Use an example only if the selected intent has concept `js-async-await`, capability `predict`, task form `runtime_trace`, and matching novelty. Keep the selected goal, objective ID, delivery context, weakness, and time constraints. An imported objective ID may differ from `js-async-await:predict`.
2. Compare the intended case with `avoidRecentChallenges` and the recent frozen prompts. If it repeats a recent causal surface, author a genuinely changed one under the same intent. The `variant` and `transfer` labels here are authoring candidates, not permission to advance novelty or override the selector.
3. Call `buildCalibratedAsyncPredictChallenge({ knowledgeRoot, intent, caseId, challengeId, timeBudgetMinutes? })` from `src/knowledge/challenge-calibration.ts` to assemble a frozen-ready `ChallengeSpec` with the actual selected objective ID and delivery context. Pass a real task limit when one applies; skip an example that cannot fit the selected work. The helper enforces objective, task form and novelty matching. Review the `publicPrompt` and recent surfaces, then register it with `kernel.registerChallenge(challenge, intent)`. Its `calibration` return value is teacher-only; never show `expectedOutput` or `wrongModels` in the learner prompt.
4. The challenge requires deterministic verification. Run the exact `.mjs` file after the learner's prediction and persist the actual output with a deterministic or mixed assessment basis. Do not infer execution from an LLM answer.
5. Ask for the prediction and stop. Execute only after the learner commits if clean retrieval is intended. Assess each criterion separately. A correct order with an incorrect causal explanation is partial, not wholly correct. Use the wrong-model predictions to diagnose a demonstrated error; do not infer one merely from “I don't know.” Record any answer-bearing hint or exposure before showing it.

The examples distinguish three models: an async call begins only later, `await` blocks every caller, and `await` orders independent work or protects shared visible state. The baseline isolates the call boundary; the variant adds a nested call; the transfer case moves from log order to a form whose older validation can overwrite newer state. That final case is a prediction task. It does not establish an `implement` or `design` capability.

These examples require only Node's own execution model. A real browser or framework claim needs verification in that environment; these files do not prove one.
