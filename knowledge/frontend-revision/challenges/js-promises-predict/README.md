# Calibrated prediction examples: `js-promises:predict`

Teacher-only examples for [promises and chaining](../../concepts/js-promises.md) in the [async results unit](../../units/f02.md). The answer keys and wrong models are in `calibration.json`; the `.mjs` files are the exact code a learner may see.

Use a case only after Learning OS selects a matching `predict` / `runtime_trace` intent. Find it with `findCalibratedPredictionCase(...)`, build it with `buildCalibratedPredictionChallenge(...)`, freeze it, ask for the prediction and stop. Run the file after the learner commits. Never show `expectedOutput` or `wrongModels`.

The cases separate two faulty models: a chain waits for any promise created in a callback, and every step starts when the chain is built. The baseline isolates the missing return; the variant returns the next step and changes which value flows on; the transfer case moves to an async `forEach` save routine where the success banner appears before any upload finishes. The transfer case is a prediction task and does not establish `implement` evidence for the fix.
