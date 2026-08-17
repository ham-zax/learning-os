# Pretraining: Data, Optimizer, Stability

## Summary
Pretraining is where capability comes from and where nearly all the compute goes. You will almost certainly never do it — but you need to understand it, because every quirk of the model you fine-tune was set here, and because the same optimizer and stability concerns reappear at small scale.

## Key Points

### Data is the product
Modern frontier runs use 10–20T+ tokens. The pipeline matters more than the architecture:
1. **Collection** — Common Crawl, code (GitHub), books, papers (arXiv), curated Q&A, increasingly synthetic data.
2. **Deduplication** — exact and near-dup (MinHash/LSH). Duplicated data causes memorisation and wastes compute; this step alone is worth several points on benchmarks.
3. **Quality filtering** — heuristics (length, symbol ratio, perplexity against a reference model) plus learned classifiers. FineWeb-Edu showed that an "educational value" classifier beats raw volume decisively.
4. **Decontamination** — remove test-set overlap. Done inconsistently across the industry, which is why benchmark numbers are less trustworthy than they look.
5. **Mixing and curriculum** — the ratio of code/web/math/multilingual is a tuned hyperparameter. Code in the mix improves reasoning on non-code tasks.

### The optimizer
- **AdamW** is universal. Adam's per-parameter adaptive step sizes handle the wildly different gradient scales across a transformer; the decoupled weight decay ("W") is what makes regularisation behave correctly.
- Memory cost: Adam stores two extra states (momentum, variance) per parameter. At fp32 that's **8 bytes per parameter on top of the weights** — the reason full fine-tuning needs ~16 bytes/param total and LoRA needs a fraction.
- Typical hyperparameters: `β₁=0.9, β₂=0.95` (lower than the 0.999 default — LLMs prefer faster variance adaptation), `weight_decay=0.1`, `eps=1e-8`.

### Learning rate schedule
- **Warmup** (first 0.1–2% of steps): linear ramp from ~0. Skipping it blows up early training, because Adam's variance estimate is unreliable on the first steps.
- **Decay**: cosine to ~10% of peak is the long-standing default. Warmup-Stable-Decay (WSD) has become popular because it lets you stop at any point and decay, rather than committing to a total step count up front.
- Peak LR scales roughly inversely with model width — larger models need smaller LRs.

### Precision and stability
- **bf16** is the standard training dtype: same exponent range as fp32, less mantissa. It tolerates the large dynamic range of LLM gradients where fp16 overflows.
- **fp16 requires loss scaling**; bf16 does not. If you're on an Ampere-or-newer GPU, use bf16 and delete the complexity.
- **Gradient clipping** at global norm 1.0 — nearly universal, cheap insurance against loss spikes.
- **Loss spikes** are the characteristic pretraining failure: loss jumps and may or may not recover. Mitigations: lower LR, skip the offending data batch, restart from an earlier checkpoint, z-loss on logits, QK-norm.

### Parallelism (know the names)
- **Data parallel / FSDP / ZeRO** — shard optimizer states, gradients, then parameters across GPUs. The first thing you reach for.
- **Tensor parallel** — split individual matrices across GPUs. High communication, needs fast interconnect.
- **Pipeline parallel** — different layers on different GPUs. Introduces bubbles; needs micro-batching.
- **Gradient checkpointing** — recompute activations in the backward pass instead of storing them. Trades ~30% more compute for a large memory saving. You *will* use this on a single GPU.

### What it costs
Compute ≈ `6 × params × tokens` FLOPs for training (forward + backward). Llama-3-8B on 15T tokens ≈ `7×10²³` FLOPs — thousands of GPU-years. This is the number that makes fine-tuning, not pretraining, your job.

## Gotchas
- Effective batch size = `per_device_batch × grad_accum × num_devices`. Changing GPU count silently changes your effective batch and therefore your optimal LR.
- Resuming a run must restore optimizer state and the data-loader position, not just weights. Restoring only weights restarts momentum from zero and produces a visible loss bump.
- A "smooth loss curve" is not success. Held-out evaluation on tasks you care about is the only signal that matters; training loss keeps falling while the model overfits.
- Data leakage between pretraining and your evaluation set makes your fine-tuned model look better than it is. If you build an eval set from public data, assume the base model has seen it.
