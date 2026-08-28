# Breakthrough: Reasoning Models and RLVR (2024-2026)

## Summary
OpenAI's o1 and DeepSeek's R1 established a second scaling axis: spend compute at inference, not just training. Reinforcement learning against automatically verifiable rewards taught models to produce long internal reasoning before answering — and R1 made the recipe public.

## Key Points

### o1 (OpenAI, September 2024)
- Trained with RL to produce a long hidden chain of thought before its answer.
- Large jumps on competition maths (AIME), competitive programming, and PhD-level science questions — domains where the previous generation was weak.
- Accuracy scaled log-linearly with *thinking* tokens: a genuinely new dial.
- The reasoning trace was hidden from users, and the method was undisclosed. The field spent months speculating.

### DeepSeek-R1 (January 2025) — the open replication
Open weights, open paper, and a result that reframed the problem:

- **R1-Zero**: pure RL on a base model with **no SFT at all**. Reward = did a verifier accept the answer (exact-match maths, unit-tested code). The model spontaneously developed self-verification, backtracking, and progressively longer reasoning. An "aha moment" — the model reconsidering its own approach mid-trace — appeared without any demonstration of that behaviour.
- **R1**: a small cold-start SFT set to fix R1-Zero's readability and language-mixing, then the same RL. Frontier-competitive reasoning at a reported fraction of the cost.
- **Distilled models**: R1's traces were used to SFT Qwen and Llama models at 1.5B–70B. These substantially outperform their non-reasoning siblings — **and this is the technique an individual can actually use.**

### RLVR — why verifiable rewards matter
The reward is a program, not a learned model:
- Maths: compare to the known answer.
- Code: run the tests.
- Structured output: does it validate against the schema.

A learned reward model can be hacked — the policy finds inputs that score highly and are nonsense. A verifier cannot be hacked in the same way, so you can train far harder against it. **The frontier of applied post-training is now largely "how do I turn my task into something a program can check?"**

GRPO (Group Relative Policy Optimization) is the algorithm that made this cheap: score a group of sampled completions against each other, drop the value network entirely. It's in TRL, and it's what most open reasoning work uses.

### Test-time scaling
Three ways to spend more compute at inference, all with measurable returns:
- **Longer chains** — sequential, simplest.
- **Sample-and-select** — generate `N`, pick by majority vote or a trained verifier.
- **Search** — tree-of-thought, MCTS over reasoning steps. Highest ceiling, highest cost.

The practical consequence is a genuine cost/accuracy dial that didn't exist before, which is why current APIs expose a "reasoning effort" parameter.

### Where it stands in 2026
- Reasoning is now a mode, not a model class — major models expose thinking on/off and effort levels rather than shipping separate SKUs.
- Extending RLVR beyond maths and code (to agentic tool use, long-horizon tasks, open-ended writing) is the active frontier, and it reintroduces the reward-model problem.
- Distillation remains the dominant way capability spreads downward to small models.

## Gotchas
- **Cost and latency**: 5–20× the output tokens of a non-reasoning model, often billed and invisible. Do not default to reasoning models for extraction, formatting, or classification.
- The visible reasoning trace is **not a faithful record** of the computation. Models reach answers by one route and narrate another. It is not an audit trail.
- **Overthinking** is measurable: on easy problems, forced long reasoning reduces accuracy.
- Fine-tuning a reasoning model on short-answer SFT data destroys the reasoning behaviour. Keep the thinking format in your training data or use a non-reasoning base.
- RLVR requires a verifier. If your task has no programmatic notion of "correct", this whole line of technique doesn't apply directly — use distillation from a strong model instead.
