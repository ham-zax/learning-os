# Scaling Laws and Compute-Optimal Training

## Summary
Model loss falls as a smooth power law in parameters, data, and compute. This is the single most consequential empirical finding in the field — it turned "try things and hope" into "predict the loss of a model you haven't trained yet", and it justified the capital spend behind every frontier lab.

## Key Points

### The core result (Kaplan et al., OpenAI, 2020)
Test loss follows power laws in each of three quantities, holding the others non-bottlenecking:

```
L(N) ∝ N^(-α)     N = parameters
L(D) ∝ D^(-β)     D = training tokens
L(C) ∝ C^(-γ)     C = compute
```

Straight lines on a log-log plot, across seven orders of magnitude. Architecture details (depth vs width, exact attention variant) matter far less than these three numbers — a genuinely surprising finding.

### Chinchilla (DeepMind, 2022) — the correction
Kaplan's analysis concluded you should spend most extra compute on parameters. Chinchilla re-ran the experiment with proper LR schedules per run and found the opposite balance:

> **Scale parameters and tokens roughly equally: ~20 tokens per parameter.**

The demonstration: Chinchilla (70B params, 1.4T tokens) beat Gopher (280B params, 300B tokens) at the same training compute, everywhere. Almost every large model before 2022 was significantly undertrained.

### Compute-optimal vs inference-optimal
Chinchilla optimises *training* cost. If you're going to serve a model billions of times, a smaller model trained far past the Chinchilla point is cheaper overall — the extra training cost amortises against every inference.

This is why Llama 3 8B was trained on **15T tokens** (~1,875 tokens/param, nearly 100× Chinchilla-optimal). It is deliberately "overtrained" because inference dominates the lifetime cost. Every small open model you use follows this logic — and it's the reason a good 8B model today outperforms a 175B model from 2020.

### The compute equation
```
C ≈ 6 · N · D          (training FLOPs)
C ≈ 2 · N              (per-token inference FLOPs)
```
The 6 = 2 (forward multiply-add) × 3 (forward + backward is ~2× forward). These two lines let you sanity-check almost any cost claim in a paper or a vendor pitch.

### Emergence — and the pushback
Some capabilities (multi-step arithmetic, instruction following) appear to jump discontinuously at scale. The counter-argument (Schaeffer et al., 2023) is that this is largely a **metric artifact**: exact-match scoring is discontinuous, so a smooth improvement in per-token probability looks like a sudden jump. Under continuous metrics, most "emergence" smooths out. Both views are partly right; treat dramatic emergence claims with suspicion.

### Where scaling laws are heading
- **Data wall**: high-quality human text is finite. Synthetic data, multi-epoch training (up to ~4 epochs is nearly as good as fresh data), and multimodal data are the responses.
- **Test-time scaling**: a new axis — spend more compute *at inference* (longer chains of thought, sampling and selecting) rather than at training. This has its own power law and is what reasoning models exploit.
- **Distillation scaling**: a small model trained on a large model's outputs beats the same small model trained on raw text. This is now the standard way small open models are made.

## Gotchas
- Scaling laws predict **loss**, not capability on your task. A predicted loss improvement of 0.02 may mean everything or nothing downstream.
- The constants are dataset- and tokenizer-specific. You cannot port Chinchilla's coefficients to your domain corpus and expect them to hold.
- "20 tokens per parameter" is widely quoted as a rule for *fine-tuning*. It is not — it's a pretraining result, and applying it to a 50k-example fine-tune is a category error.
- Parameter counts on MoE models are not comparable to dense ones. Compare *active* parameters for compute, *total* for memory.
