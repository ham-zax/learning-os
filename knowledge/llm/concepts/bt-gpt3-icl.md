# Breakthrough: GPT-3 and In-Context Learning (2020)

## Summary
GPT-3 scaled to 175B parameters and demonstrated that a large enough language model can learn a new task from examples placed in its prompt — with no gradient updates at all. This converted "machine learning" into "writing a prompt", and created the entire prompt-engineering and API-product surface.

## Key Points

### The result
"Language Models are Few-Shot Learners" (Brown et al., 2020). 175B parameters, 300B training tokens, ~$4M of compute. The headline was not perplexity — it was that performance on dozens of benchmarks improved with the number of examples **in the prompt**:
- **Zero-shot**: task description only.
- **One-shot**: description plus one demonstration.
- **Few-shot**: description plus 10–100 demonstrations.

The gap between zero-shot and few-shot widened with model size — small models barely benefit from in-context examples; large ones benefit enormously.

### Why this was shocking
Nothing in the training objective asks for it. The model was trained only to predict the next token. In-context learning is an **emergent** consequence: the pretraining corpus contains many documents with an implicit pattern-then-instance structure, so a model that gets good at continuation gets good at inferring and applying patterns.

### The mechanism (as later understood)
- **Induction heads** (Anthropic, 2022): attention head circuits that find a previous occurrence of the current token and copy what followed it. They form abruptly during training, and their formation coincides with the onset of in-context learning ability. This is the closest thing to a mechanistic account.
- **Implicit gradient descent**: several papers show attention layers can implement something equivalent to a gradient step on the in-context examples. Suggestive, contested, not settled.
- ICL is partly **task location** rather than learning — the demonstrations tell the model which of its existing capabilities to invoke. Evidence: shuffling the labels in few-shot examples often barely hurts performance, which is not what "learning from examples" would predict.

### Consequences that still shape the field
1. **Prompting became the interface.** No training, no labels, no deployment cycle — just text. The API business model follows directly.
2. **Context window became a product spec.** More context = more examples = more capability.
3. **Chain-of-thought became possible.** CoT is an in-context technique; it needs a model that can follow patterns in its prompt.
4. **The evaluation crisis began.** If the model saw the benchmark during pretraining, few-shot results are contaminated. This is still not solved.

### GPT-3's limitations (which set up what came next)
- It was a **base model** — it completed text, it did not follow instructions. Prompting it well was a genuine skill involving fake transcripts and careful formatting. InstructGPT fixed this two years later.
- It was **badly undertrained** by Chinchilla standards (175B params, 300B tokens — should have been ~3.5T). Enormous compute was spent inefficiently.
- Few-shot performance was far below fine-tuned task-specific models on most benchmarks. The excitement was about generality, not peak accuracy.

## Gotchas
- ICL ≠ learning. Nothing persists — the model is identical after the request. Anything you want retained must go in a fine-tune or a retrieval store.
- Few-shot example *order and formatting* materially change results. Sensitivity to permutation is large and is a genuine reliability problem, not a prompting skill issue.
- With modern instruction-tuned models, many-shot prompting is often worse than a clear instruction plus 2–3 examples. Don't cargo-cult the 2020 recipe.
- "175B parameters" became a meme benchmark. It is not a meaningful capability number today — 8B models trained on 15T tokens outperform it comfortably.
