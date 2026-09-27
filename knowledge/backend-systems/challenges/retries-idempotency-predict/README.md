# Calibrated predictions: retries and idempotency

These teacher-only examples serve `retries-idempotency-and-uncertain-outcomes:predict` in the [queues and retries unit](../../units/b04.md). `calibration.json` contains private answer keys and wrong-model predictions. The three `.mjs` files are the exact learner-visible code surfaces.

Use `buildCalibratedPredictionChallenge({ knowledgeRoot, packId: "idempotency-predict", intent, caseId, challengeId })` from `src/knowledge/challenge-calibration.ts` only after Learning OS selects a matching `runtime_trace` intent and novelty. The helper uses the selected learner's actual objective ID and delivery context. Check recent frozen prompts for a genuinely changed surface before registering a variant or transfer case.

The baseline tests a new key after an uncertain response; the variant tests overlapping calls with the same key; the transfer case moves to a restarted worker after an effect but before acknowledgement. Ask for a prediction first, then run the exact file and record the output under the deterministic-verification contract. Assess the effect count and the identity/storage boundary separately. A learner who predicts the lines correctly for an incorrect reason has not met the whole rubric.

**Scope:** The examples use process-local Maps and a single in-memory effect counter. They demonstrate the stated code, not durable idempotency, a broker's delivery guarantee, or exactly-once processing. A real distributed design must state the operation-key scope, payload policy, retention window, and durable atomic owner. These prediction cases do not create `design` or `implement` evidence.
