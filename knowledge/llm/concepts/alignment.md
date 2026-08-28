# Alignment: SFT, RLHF, DPO

## Summary
A pretrained base model completes text; it does not answer questions. Post-training is the pipeline that converts "plausible internet continuation" into "helpful assistant". It uses a tiny fraction of the compute of pretraining and accounts for most of the perceived difference between a base model and a product.

## Key Points

### Stage 1 — Supervised Fine-Tuning (SFT)
Train on `(prompt, ideal_response)` pairs with the ordinary language-modeling loss, computing loss **on the response only**. This teaches:
- The chat format (special tokens, turn structure, when to emit EOS)
- Response style, length, and register
- The behaviour of following an instruction rather than continuing it

Data scale is surprisingly small. LIMA showed 1,000 carefully curated examples produce a competent assistant. **Quality dominates quantity** — 1k excellent examples beat 100k mediocre ones, reliably. This is the single most important practical fact in this concept, and the one that makes fine-tuning tractable on a $30 budget.

### Stage 2 — Preference optimisation
SFT can only imitate demonstrations. It cannot learn from *comparisons*, and for most questions there is no single right answer — only better and worse ones.

**RLHF (the InstructGPT recipe):**
1. Collect preference pairs: same prompt, two responses, a human picks the better.
2. Train a **reward model** — usually the LM with a scalar head — on the Bradley-Terry loss over those pairs.
3. Optimise the policy against the reward model with **PPO**, plus a KL penalty against the SFT model to stop it drifting into degenerate high-reward text.

It works, and it is miserable: four models in memory (policy, reference, reward, value), unstable, and expensive.

**DPO (Direct Preference Optimization, 2023):**
The key insight is that the optimal RLHF policy has a closed form in terms of the reward, so you can invert it and optimise the policy **directly on preference pairs with a classification-style loss** — no reward model, no sampling loop, no RL.

```
L = -log σ( β·[log π(y_w|x)/π_ref(y_w|x) − log π(y_l|x)/π_ref(y_l|x)] )
```

Two models in memory, a standard training loop, far more stable. **This is what you should use.** Variants: IPO (fixes DPO's overfitting on near-identical pairs), KTO (needs only binary good/bad labels, not pairs — much cheaper to collect), ORPO (merges SFT and preference in one stage, no reference model at all), SimPO (reference-free).

**RLAIF / Constitutional AI:** replace the human labeler with an LLM judging against a written set of principles. This is how preference data is actually produced at scale now — human labels are the expensive minority.

### Stage 3 — Verifiable-reward RL
Where the reward is a program, not a model: unit tests for code, an exact-match checker for maths. No reward hacking is possible against a correct verifier. This is the mechanism behind reasoning models — covered in its own concept.

### What alignment actually optimises
Human raters prefer confident, long, well-formatted answers. So RLHF reliably produces **sycophancy** (agreeing with the user), **verbosity**, and **overconfidence** — not because anyone wanted them, but because they are what the preference signal rewards. The alignment tax (measurable capability loss on some benchmarks after alignment) is real though much reduced by modern recipes.

## Gotchas
- SFT on a poorly formatted dataset teaches the model to produce poorly formatted output. Garbage in, faithfully reproduced garbage out.
- **Chat template mismatch** between training and serving is the most common and most under-diagnosed post-training bug — output degrades with no error anywhere.
- Loss on the prompt as well as the completion dilutes the signal and can make the model start restating questions. Use completion-only masking.
- DPO's `β` controls how far you may drift from the reference. Too high: nothing changes. Too low: the model drifts into degenerate text that satisfies the preference loss while being unusable.
- Fine-tuning an already-aligned instruct model on narrow data can strip its safety behaviour and general ability (catastrophic forgetting). Mixing in ~5–10% general instruction data mitigates this.
- Preference data collected from one model's outputs is off-policy for a different model. Reusing public preference datasets works less well than it should for this reason.
