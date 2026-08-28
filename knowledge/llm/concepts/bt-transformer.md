# Breakthrough: Attention Is All You Need (2017)

## Summary
Vaswani et al. removed recurrence and convolution entirely, leaving attention plus feed-forward layers. The result trained faster, translated better, and — critically — scaled with hardware in a way RNNs never could. Every model in this topic is a descendant.

## Key Points

### What the paper actually proposed
- **Encoder-decoder** for machine translation (the decoder-only form used by GPT came later).
- **Scaled dot-product attention** — `softmax(QKᵀ/√d)V`.
- **Multi-head attention** — `h=8` parallel attention subspaces.
- **Position-wise FFN** — the same two-layer MLP applied at every position.
- **Sinusoidal positional encoding** — because attention alone is order-blind.
- **Post-norm residual blocks** — later inverted to pre-norm for stability.
- Base model: 65M parameters, trained in 12 hours on 8 P100s. It beat systems that took orders of magnitude more compute.

### The real contribution: parallelism
An RNN's `n` sequential steps become a single batched matrix multiplication over all positions. On a GPU this is the difference between using 5% and 90% of the hardware. **The transformer's advantage is not primarily representational — it is that it turns sequence modelling into dense linear algebra**, which is exactly what accelerators are built for. Scaling laws only became discoverable once a model could absorb arbitrary compute.

### The second contribution: constant path length
In an RNN, information between positions `i` and `j` traverses `|i−j|` steps, with gradient decay at each one. In attention it's one step, always. Long-range dependencies became learnable rather than aspirational.

### What was wrong or later replaced
Almost every specific choice has been superseded, which is itself instructive:
| 2017 | Modern |
|---|---|
| Post-norm | Pre-norm (+ final norm) |
| LayerNorm | RMSNorm |
| ReLU FFN | SwiGLU |
| Sinusoidal position | RoPE |
| MHA | GQA |
| Encoder-decoder | Decoder-only |
| Learned dropout everywhere | Little to no dropout at scale |

The skeleton — attention mixes across positions, FFN processes each position, residuals carry the stream — is untouched after nine years. That durability is the point.

### The immediate aftermath
Within 18 months: GPT (June 2018, decoder-only, generative pretraining), BERT (October 2018, encoder-only, masked LM), GPT-2 (2019, scale + zero-shot task transfer). The architecture was general enough that three quite different research programmes forked from one paper.

## Gotchas
- The title oversells: the model is attention **and** a large feed-forward network, and most parameters are in the FFN. "Attention is all you need" describes what was removed, not what does the work.
- The paper's hyperparameters are not a good starting point today — warmup schedules and post-norm in particular will cost you stability.
- The encoder-decoder framing confuses people reading it as background for GPT-style models. For decoder-only LLMs, ignore the encoder half and the cross-attention entirely.
- The 2017 model had 512 tokens of context. Nothing in the architecture prevented longer; the `O(n²)` memory cost did.
