# Attention

## Summary
Attention lets every token look at every other token and pull in the information it needs, with the weighting computed from content rather than position. It replaced recurrence because it is parallelizable over sequence length and gives a constant-length path between any two positions.

## Key Points

### The mechanism
Each token's vector is projected into three roles:
- **Query (Q)** — what this token is looking for
- **Key (K)** — what this token offers as a match target
- **Value (V)** — what this token actually contributes if matched

```
Attention(Q, K, V) = softmax(QKᵀ / √d_k) · V
```

Read it as: score every (query, key) pair by dot product → scale → normalise to weights that sum to 1 → take a weighted average of the values.

### Why the √d_k
Dot products of `d_k`-dimensional random vectors have variance proportional to `d_k`. Without scaling, the softmax input grows with dimension, saturates, and gradients vanish. This one term is why training works at scale.

### Causal masking
For autoregressive LMs, position `t` must not see positions `> t`. Implemented by adding `-inf` to the upper triangle of the score matrix before the softmax, so those weights become exactly zero. This mask is the only thing making a "decoder" different from an "encoder" architecturally.

### Multi-head attention
Instead of one attention with dimension `d_model`, run `h` attentions with dimension `d_model / h` in parallel and concatenate. Different heads empirically specialise — syntactic dependencies, coreference, positional offsets, "previous token", induction heads that implement in-context copying. Cost is identical to one big head; expressiveness is much higher.

### Self vs cross attention
- **Self-attention**: Q, K, V all come from the same sequence. This is what decoder-only LLMs use everywhere.
- **Cross-attention**: Q from the decoder, K/V from an encoder. Used in encoder-decoder models (T5, Whisper) and in most multimodal adapters.

### The efficiency variants you will actually meet
- **MHA** — `h` query heads, `h` key/value heads. Original. Largest KV cache.
- **MQA** — `h` query heads, **1** shared KV head. Tiny cache, some quality loss.
- **GQA** — `h` query heads, `g` KV head groups (e.g. 32 query heads, 8 KV groups). The modern default (Llama 3, Mistral, Qwen): near-MHA quality at ~4× smaller KV cache.
- **Sliding-window / local attention** — each token attends to only the last `w` tokens, making cost linear. Usually interleaved with full-attention layers.

### Complexity
Time and memory are `O(n² · d)` in sequence length `n`. This is the single dominating constraint on context length. FlashAttention doesn't change the FLOP count — it changes the *memory* behaviour by never materialising the `n × n` matrix in HBM, which is what makes long contexts practical.

## Gotchas
- The attention *weights* are `O(n²)` in memory; naive implementations OOM long before FLOPs become the issue. This surprises people benchmarking on short sequences.
- Attention weights are not explanations. Reading off "the model attended to X so it used X" is unreliable — the value vectors and residual stream matter as much as the weights.
- Padding must be masked in the attention scores, separately from the causal mask. Two different masks, both required, commonly conflated.
- Softmax attention has no built-in notion of order — swap two tokens and the output for the rest is unchanged. Position information comes entirely from positional encoding.
- GQA changes the KV cache shape. Custom inference code written for MHA silently breaks or misallocates on GQA models.
