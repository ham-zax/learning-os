# Breakthrough: InstructGPT and RLHF (2022)

## Summary
GPT-3 was powerful and unusable. InstructGPT showed that a small amount of human feedback could convert a base model into something that follows instructions — and that a 1.3B aligned model was *preferred by humans* over the 175B base model. Capability was no longer the bottleneck; alignment to intent was.

## Key Points

### The problem it solved
A base LM is trained to continue text. Ask it "What is the capital of France?" and a plausible continuation is another question, or a list of quiz items, or a Wikipedia-style digression. It is not *wrong* — it is doing exactly what it was trained to do. The objective and the user's intent are misaligned.

### The three-stage recipe
1. **SFT** — human contractors write ideal responses to real API prompts (~13k examples). Fine-tune the base model on these.
2. **Reward model** — for each prompt, sample several SFT outputs, have humans rank them (~33k comparisons). Train a 6B model with a scalar head on the Bradley-Terry ranking loss.
3. **PPO** — optimise the SFT policy to maximise reward-model score, with a per-token KL penalty against the SFT policy to prevent drift into degenerate high-reward text.

Total human data: on the order of tens of thousands of examples — trivial next to 300B pretraining tokens.

### The headline result
Human evaluators preferred **1.3B InstructGPT** outputs over **175B GPT-3** outputs. A ~100× reduction in size, more than compensated for by alignment. Reductions in toxicity and hallucination came along with it.

### Why it changed the industry
- **ChatGPT is this recipe** applied to a stronger base and packaged with a chat UI, released nine months later. The product explosion of 2023 is downstream of this paper.
- It established **post-training as a discipline** — a distinct, cheap, high-leverage stage where most product differentiation now happens.
- It made **human preference data a strategic asset**, and created the data-labeling economy around LLMs.

### The KL penalty — the subtle central idea
Without it, PPO finds adversarial inputs to the reward model: text that scores highly and reads as nonsense. The KL term anchors the policy near the SFT model, trading reward for staying on the manifold of sensible text. **Every preference-optimisation method since carries some version of this constraint** — DPO's `β`, ORPO's odds-ratio term. Understanding why it exists explains most of what can go wrong in alignment.

### Known pathologies it introduced
- **Sycophancy** — raters prefer agreement, so the model agrees. Measurable, persistent, and actively researched.
- **Verbosity** — raters prefer longer, more thorough-looking answers. Length bias is strong enough that reward models can be gamed by padding alone.
- **Alignment tax** — measurable regressions on some capability benchmarks after RLHF. Mitigated (mixing pretraining gradients into PPO) but not eliminated.
- **Overconfident refusals and hedging** — both are rater-preference artifacts.

### What replaced it in practice
PPO's complexity (four models in memory, unstable, hyperparameter-sensitive) drove the field to **DPO** and relatives, which optimise directly on preference pairs. And **RLAIF/Constitutional AI** replaced most human labelers with LLM judges. The InstructGPT pipeline is now more historically important than operationally current — but the concepts (SFT → preference → constrained optimisation) are unchanged.

## Gotchas
- RLHF does not make a model truthful. It makes it produce text humans rate highly, which correlates with truth imperfectly and diverges exactly where humans can't tell.
- Reward models are the weak link. They overfit, they're gameable, and they inherit every bias of the rating pool.
- The "1.3B beats 175B" result is about *preference on instruction-following prompts*, not raw capability. The 175B base model still knew far more.
- You almost certainly should not implement PPO. Use DPO or ORPO — same destination, a fraction of the pain.
