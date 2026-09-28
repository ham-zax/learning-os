# Calibrated prediction examples: `state-ownership-and-cache-consistency:predict`

Teacher-only examples for [state ownership and cache consistency](../../concepts/state-ownership-and-cache-consistency.md) in [unit b03](../../units/b03.md). The answer keys and wrong models are in `calibration.json`; the `.mjs` files are the exact code a learner may see.

Use a case only after Learning OS selects a matching `predict` / `runtime_trace` intent. Find it with `findCalibratedPredictionCase(...)`, build it with `buildCalibratedPredictionChallenge(...)`, freeze it, ask for the prediction and stop. Run the file after the learner commits. Never show `expectedOutput` or `wrongModels`.

These are in-memory models with timer-fixed interleavings. They prove the ordering argument, not the behavior of Redis, PostgreSQL or a particular cache library. The cases separate three faulty models: invalidating after the write makes later reads fresh, deleting before the write closes the race, and a TTL gives read-your-write. The baseline shows a late fill republishing a stale value; the variant moves the delete first and still refills stale data; the transfer case moves to a TTL profile cache with no invalidation. None of them establish `design` evidence for a fix such as versioned writes or leases.
