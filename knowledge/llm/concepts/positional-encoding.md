# Positional Encoding and RoPE

## Summary
Attention is permutation-equivariant — it has no idea what order the tokens are in. Positional encoding injects that information. The evolution from sinusoidal → learned → RoPE is directly responsible for context windows going from 512 to 1M+ tokens.

## Key Points

### Absolute encodings (2017–2020)
- **Sinusoidal** (original transformer): fixed sin/cos functions of position at varying frequencies, added to the input embedding. Not learned, in principle extrapolates, in practice doesn't well.
- **Learned absolute** (BERT, GPT-2): a trainable embedding per position, added to the input. Simple and effective — but positions beyond the training length have *no embedding at all*, so the context window is a hard wall.

### Why relative position matters more
What a model needs is usually "how far apart are these two tokens", not "which absolute slot is this". Absolute encodings force the model to derive relative distance by subtraction, which it does imperfectly and which doesn't generalise past the trained length.

### RoPE — Rotary Position Embedding
The modern default (Llama, Mistral, Qwen, Gemma, DeepSeek, most of the open ecosystem).

- Instead of *adding* a position vector, it **rotates** the query and key vectors by an angle proportional to their position, in 2D subspace pairs.
- Different dimension pairs rotate at different frequencies (fast for local structure, slow for long-range).
- The key property: the dot product `q_m · k_n` after rotation depends only on `m − n`. **Relative position falls out of the maths for free**, with no extra parameters and no change to the attention formula.
- Applied inside each attention layer to Q and K only — never to V, never to the residual stream.

### Extending context with RoPE
This is where a huge amount of practical work happens:
- **Position Interpolation (PI)**: squeeze positions `0…N'` into the trained range `0…N` by scaling. Simple, needs a short fine-tune, degrades local resolution.
- **NTK-aware scaling / YaRN**: scale low-frequency (long-range) dimensions more than high-frequency ones, preserving local detail. Much better quality per fine-tuning token; YaRN is the common production choice.
- **`rope_theta` bump**: raise the base frequency (10,000 → 500,000 or 1M) and continue pretraining on long documents. This is what Llama 3.1 did to reach 128k.

### ALiBi
Adds a linear distance penalty directly to attention scores — no embeddings at all. Trained short, extrapolates long, essentially free. Used by MPT and BLOOM. Largely lost to RoPE because it degrades quality on tasks needing precise long-range retrieval.

### NoPE
Decoder-only models with causal masking can infer position *implicitly* from the mask structure. Some recent models drop explicit encoding in a subset of layers. Interesting, not yet mainstream.

## Gotchas
- **Length ≠ competence.** A model advertised at 128k can have severe "lost in the middle" degradation — accuracy on retrieval from the middle of the context drops far below both ends. Always test on your own long inputs; don't trust the config value.
- If you fine-tune with a modified `rope_scaling` config, you must serve with the identical config. A mismatch produces subtly degraded output with no error.
- RoPE is applied per attention layer, not once at the input. Custom implementations that apply it at the embedding layer are wrong.
- KV cache entries store *already-rotated* keys. Any cache manipulation (trimming, reuse across prompts, prefix caching) must respect the position they were rotated at, or the geometry is silently corrupted.
- Attention sinks: the first few tokens absorb disproportionate attention mass. Naively evicting them from a sliding-window cache collapses generation quality — StreamingLLM exists specifically to handle this.
