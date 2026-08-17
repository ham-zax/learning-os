# Hands-on: Building an Evaluation You Trust

## Summary
Without an eval you believe, you cannot tell whether a fine-tune helped, whether a cheaper model would do, or whether last week's change broke something. Build the eval **before** the model. It is the highest-leverage hour in the project.

## Key Points

### Build it first, and by hand
Write 50–100 examples of your task with correct answers, by hand, before training anything. This forces you to define the output contract precisely and immediately reveals ambiguity in your own task definition. If you can't agree with yourself on the right answer, no model will.

Then: **hold this set out completely.** Never train on it, never tune hyperparameters against it (use a third split for that), and never look at individual failures so often that you start overfitting by hand.

### The measurement ladder — always establish all three
1. **Trivial baseline** — majority class, keyword rule, or regex. Startlingly often within a few points of everything fancier.
2. **Prompted off-the-shelf model** — zero-shot and few-shot with a good API model or a small local one. This is your "do I even need to fine-tune" gate.
3. **Fine-tuned model** — must beat both, by a margin worth the complexity.

Skipping step 1 or 2 is how people spend a month fine-tuning to match a regex.

### Metrics by task shape
- **Classification** — macro-F1 (not accuracy) plus a per-class confusion matrix.
- **Extraction / structured output** — schema-validity rate first (does it parse?), then field-level precision/recall. Report both; a model that's 95% accurate on 60% valid JSON is worse than it sounds.
- **Generation** — ROUGE/BLEU are weak proxies; use them only for regression detection. Prefer task-specific checks (does the output contain the required fields, is it under N words) plus LLM-as-judge.
- **Ranking** — nDCG, MRR, precision@k.

### LLM-as-judge, done properly
```python
JUDGE = """Compare the two answers to the question below.
Question: {q}
Reference: {ref}
Candidate: {cand}
Score the candidate 1-5 for factual agreement with the reference.
Output only JSON: {{"score": <int>, "reason": "<one sentence>"}}"""
```
Rules that make it trustworthy:
- **Pairwise comparison beats absolute scoring** — judges are much better at "which is better" than "rate this 1–10".
- **Randomise position.** Judges have a strong first-position bias.
- **Calibrate against humans once.** Score 30 examples yourself, check agreement with the judge. If they disagree, the judge is measuring something else.
- **Use a different model as judge** than the one you're evaluating. Self-preference bias is well documented.
- Judges also prefer longer and more confident answers — control for length if that's not what you want.

### Standard harnesses
`lighteval` and `lm-evaluation-harness` run MMLU, HellaSwag, GSM8K, and friends. Useful for one thing: **checking you didn't destroy general ability** during fine-tuning. They tell you almost nothing about whether your model is good at *your* task. Public benchmarks are also contaminated — assume the base model saw them.

### Make it a script, run it every time
```bash
python eval.py --model out/checkpoint-500 --dataset eval.jsonl --out results/run-12.json
```
Same command, versioned outputs, committed to the repo. A one-line diff between runs is what makes iteration fast. Log per-example results, not just aggregates — the aggregate hides the failure mode you need to see.

### Error analysis is the actual work
Sort failures by confidence, read the 20 worst by hand, and categorise them. Almost every real improvement in a fine-tuning project comes from this loop, not from hyperparameters:
- *Systematic format errors* → fix the prompt or the training template.
- *Missing a whole class of input* → add examples of it.
- *Disagreement with your own labels* → your labels are inconsistent; fix the data.
- *Genuinely hard cases* → this is your ceiling; decide if it's good enough.

## Gotchas
- Reporting only the aggregate hides everything. Always keep per-example output.
- Near-duplicates between train and eval inflate results badly. Deduplicate across the split boundary, not just within.
- Public benchmark scores are contaminated and gamed. Never choose a base model on MMLU alone.
- A judge model that shares a family with the evaluated model scores it higher. Cross-family judging only.
- Evaluating at a different temperature than you'll serve at makes the number meaningless. Pin the generation config in the eval script.
- Small eval sets have wide confidence intervals — a 3-point difference on 100 examples is noise. Report the interval or use at least a few hundred examples for decisions.
