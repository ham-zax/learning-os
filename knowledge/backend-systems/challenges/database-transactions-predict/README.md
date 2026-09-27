# Calibrated predictions: concurrent correctness

These teacher-only examples serve `database-transactions-and-concurrent-correctness:predict` in the [transactions unit](../../units/b02.md). The baseline, variant and transfer cases each expose a decision/effect boundary through a deterministic JavaScript model. `calibration.json` contains private answer keys and wrong-model predictions; the `.mjs` files are learner-visible code surfaces.

Use `buildCalibratedPredictionChallenge({ knowledgeRoot, packId: "transaction-predict", intent, caseId, challengeId })` from `src/knowledge/challenge-calibration.ts` only after Learning OS selects a matching `runtime_trace` intent and novelty. The helper creates a frozen-ready challenge with the selected learner's actual objective ID and delivery context. Compare the case with recent frozen prompts before registering it. A case label never authorizes a variant or transfer task by itself.

Ask the learner to predict before execution. Then run the exact file and record its output through the frozen deterministic-verification contract. Assess both the observable outcome and the business invariant. In the variant, final stock of zero coexists with two accepted reservations; in the transfer case, one Set entry coexists with two successful claims. Those outcomes distinguish a state-only answer from reasoning about successful decisions.

**Scope:** These are in-memory interleaving models. They establish a prediction about the stated JavaScript code, not a PostgreSQL isolation guarantee or independently correct SQL. For a PostgreSQL claim, freeze the isolation level and run two disposable connections as the unit requires. Do not convert a correct prediction here into `implement` evidence.
