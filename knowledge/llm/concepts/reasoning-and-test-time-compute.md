# Reasoning and Test-Time Compute

## Summary
Instead of making the model bigger, let it think longer. Chain-of-thought turned "reasoning" into "generate more tokens before answering", and RL on verifiable rewards turned that into a trainable skill. This opened a second scaling axis — inference compute — with its own power law.

## Key Points

### Why generating tokens *is* computing
A transformer does a fixed amount of computation per token. A hard problem may need more serial computation than one forward pass allows. Emitting intermediate tokens gives the model somewhere to store partial results and more forward passes to use them — the context window becomes a scratchpad, and the sequence becomes a variable-length computation.

### Chain-of-thought
- **Prompted CoT** (2022): "Let's think step by step" — a zero-shot instruction that measurably improves arithmetic and multi-step reasoning.
- **Few-shot CoT**: demonstrate worked reasoning in the prompt.
- **Self-consistency**: sample `k` chains at temperature > 0, take the majority answer. Reliable gains for a `k×` cost multiplier. Still the strongest simple technique.

Modern reasoning models have CoT baked in — you don't prompt for it, and prompting for it can hurt.

### RLVR — RL from Verifiable Rewards
The core mechanism behind o1, R1, and their successors:
1. Sample many solution attempts to a problem with a **checkable** answer (maths with a known result, code with unit tests).
2. Reward = did the verifier pass. Binary, unhackable, no reward model needed.
3. Reinforce the reasoning traces that led to correct answers (GRPO, PPO variants).

DeepSeek-R1's notable result: applying this to a base model with **no SFT at all** produced reasoning behaviour — self-verification, backtracking, "wait, let me reconsider" — spontaneously. Nobody demonstrated those behaviours; RL found them because they raise the success rate. Long CoT emerges because the model discovers that thinking longer pays.

### Test-time scaling laws
Accuracy improves log-linearly with inference compute, across several methods:
- **Sequential**: longer single chains (more thinking tokens).
- **Parallel**: sample `N`, then select — by majority vote, by a trained verifier/PRM, or by best-of-N reranking.
- **Search**: tree-of-thought, MCTS over reasoning steps. Powerful, expensive, mostly research-stage.

The practical consequence: **a small model that thinks longer can beat a large model that answers immediately**, at comparable total cost. This reshapes the cost curve and is why distilled reasoning models are so attractive.

### Reasoning distillation
Generate long CoT traces from a strong reasoning model, SFT a small model on them. DeepSeek's distilled 7B/14B/32B models substantially outperform their non-reasoning equivalents at a fraction of the training cost. **This is the technique most accessible to an individual with a small budget** — you don't need RL infrastructure, just a good teacher and an SFT run.

### Where it doesn't help
Reasoning models are worse or wasteful on: simple factual recall, formatting/extraction tasks, latency-sensitive UIs, and anything with no verifiable notion of correct. Burning 4,000 thinking tokens to reformat a date is a real cost and a real failure mode. Modern APIs expose a "reasoning effort" dial precisely because the right setting is task-dependent.

## Gotchas
- Long CoT inflates cost and latency enormously — thinking tokens are billed and often invisible. Budget for 5–20× the output tokens of a non-reasoning model.
- The visible reasoning trace is **not** a faithful account of the computation. Models demonstrably reach an answer by one route and narrate another. Do not use CoT as an audit trail.
- Overthinking is real: on easy problems, forced long reasoning lowers accuracy compared to answering directly.
- RLVR only works where you can verify. Extending it to open-ended tasks reintroduces a reward model and with it reward hacking.
- Fine-tuning a reasoning model with ordinary SFT on short answers can destroy the reasoning behaviour. If you fine-tune one, keep the thinking format in your training data.
