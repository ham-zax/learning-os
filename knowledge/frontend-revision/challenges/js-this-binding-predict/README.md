# Calibrated prediction examples: `js-this-binding:predict`

Teacher-only examples for [this binding](../../concepts/js-this-binding.md) in the [JavaScript execution model unit](../../units/f01.md). The answer keys and wrong models are in `calibration.json`; the `.mjs` files are the exact code a learner may see.

Use a case only after Learning OS selects a matching `predict` / `runtime_trace` intent. Find it with `findCalibratedPredictionCase(...)`, build it with `buildCalibratedPredictionChallenge(...)`, freeze it, ask for the prediction and stop. Run the file after the learner commits. Never show `expectedOutput` or `wrongModels`.

All cases run as ES modules, so they are strict: a call with no receiver gets `this === undefined`, not the global object. The cases separate three faulty models: a method remembers the object it was defined on, a nested function inherits the method's `this`, and an arrow function has no usable `this`. The baseline isolates a detached call; the variant contrasts regular and arrow callbacks; the transfer case moves to a class method registered as an event handler. It is a prediction task and does not establish `implement` evidence for a fix.
