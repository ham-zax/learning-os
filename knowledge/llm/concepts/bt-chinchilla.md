# Breakthrough: Chinchilla and Compute-Optimal Scaling (2022)

## Summary
DeepMind showed that essentially every large model built up to that point was badly undertrained: for a fixed compute budget, you should scale parameters and training tokens roughly equally. The result redirected the entire industry from "bigger models" to "more data", and is the direct reason small, strong open models exist.

## Key Points

### The setup
"Training Compute-Optimal Large Language Models" (Hoffmann et al., 2022). Over 400 models from 70M to 16B parameters, trained on 5B to 500B tokens, with the learning-rate schedule properly matched to each run's length — the methodological fix that changed the conclusion versus Kaplan et al.

Three independent estimation methods (fixed-model-size sweeps, fixed-FLOP sweeps, parametric loss fit) all converged on the same answer.

### The finding
> For compute-optimal training, **parameters and tokens should scale in roughly equal proportion — about 20 tokens per parameter.**

Kaplan's 2020 analysis had implied a much heavier weighting toward parameters. Under-decayed learning rates on the shorter runs had made extra data look less valuable than it was.

### The demonstration
| Model | Params | Tokens | Training FLOPs |
|---|---|---|---|
| Gopher | 280B | 300B | ~same |
| Chinchilla | 70B | 1.4T | ~same |

Chinchilla beat Gopher on essentially every benchmark, while being **4× smaller** — and therefore 4× cheaper to serve and easy to fine-tune. Applying the rule retroactively: GPT-3 (175B/300B tokens) should have had ~3.5T tokens; it received a twelfth of that.

### Why it mattered so much
1. **It made small models respectable.** If a well-trained 7B can beat an undertrained 175B, individuals and small labs are back in the game. Llama (2023) is Chinchilla's direct consequence.
2. **It shifted the bottleneck to data.** Suddenly everyone needed trillions of high-quality tokens, which triggered the data-curation arms race (FineWeb, deduplication, quality classifiers) and, eventually, the synthetic-data era.
3. **It reframed cost.** Training compute is one-time; inference compute is forever. Chinchilla optimises the former, which set up the next correction.

### The Llama correction — inference-optimal
Chinchilla answers "cheapest way to reach loss L". If you serve the model billions of times, that's the wrong question. Llama-2 (2T tokens for 7B ≈ 285 tok/param) and Llama-3 (15T tokens for 8B ≈ 1,875 tok/param) train far past compute-optimal because the extra training cost amortises over inference.

Returns diminish but never actually stop — the loss curve keeps falling well past 20 tok/param. **Every strong small model you can fine-tune today exists because of this deliberate "overtraining".**

### Where it stands now
- The 20:1 ratio is a landmark, not a law. Modern practice is far past it for deployable models.
- Data quality shifts the curve; the ratio was fitted on one corpus.
- Distillation and synthetic data change the accounting again — a small model trained on a large model's outputs beats what the scaling law predicts from raw tokens.

## Gotchas
- Chinchilla is about **pretraining from scratch**. It says nothing about fine-tuning dataset size, and the 20:1 rule is routinely and wrongly cited in that context.
- "Compute-optimal" ≠ "best model for your budget". If you're serving it, deliberately overtrain a smaller model.
- The result assumes a single epoch over unique data. With repeated data, returns fall off after ~4 epochs.
- Parameter counts for MoE models don't slot into the formula — compare active parameters for the compute term.
