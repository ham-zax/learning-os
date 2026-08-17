# The Transformer Block

## Summary
A modern LLM is one embedding table, N identical blocks stacked, and one output projection. The block is: attention (mix information across positions) → feed-forward network (process each position independently), each wrapped in a residual connection and a normalisation. That's the whole architecture.

## Key Points

### The canonical modern block (pre-norm)
```
h = x + Attention(Norm(x))
y = h + FFN(Norm(h))
```

Note `Norm` is applied *before* the sublayer, and the residual path is untouched. This is **pre-norm**, and it is what every model since ~GPT-2/GPT-3 uses.

### Pre-norm vs post-norm
The original 2017 paper used post-norm (`Norm(x + Sublayer(x))`). It requires careful learning-rate warmup and becomes unstable past ~12 layers. Pre-norm gives a clean identity path from input to output, so gradients flow to early layers without decay — this is the change that made 100+ layer models trainable. Some recent models use both (sandwich norm) for extra stability at scale.

### The residual stream
Think of the residual connection as a shared "bus" running the depth of the network. Each block *reads* from it, computes something, and *adds* to it. Nothing is ever overwritten. This framing (from mechanistic interpretability) explains why you can prune, skip, or LoRA-patch individual layers without catastrophic failure — each block is an incremental edit, not a transformation.

### Normalisation: LayerNorm → RMSNorm
- **LayerNorm**: subtract mean, divide by std, scale and shift. Two learned parameter vectors.
- **RMSNorm**: divide by root-mean-square only — no mean subtraction, no bias. ~10–15% faster, equal quality, and the default in Llama, Mistral, Qwen, Gemma.
- **Why normalise at all**: keeps activation scale stable across depth so the optimizer sees well-conditioned gradients.

### The feed-forward network
Two linear layers with a nonlinearity, applied identically at every position:
```
FFN(x) = W₂ · activation(W₁ · x)
```
- Hidden dimension is typically `4 × d_model` (or `~2.7×` for gated variants, to match parameter count).
- **This is where most parameters live** — roughly ⅔ of a dense model's weights are FFN, not attention.
- **SwiGLU** is the modern activation: `(W_gate·x ⊙ swish(W_up·x)) · W_down`. Three matrices instead of two, consistently better than ReLU/GELU. Used by Llama, Mistral, Qwen, Gemma.
- Interpretability view: the FFN acts as a key-value memory storing factual associations. Most "the model knows X" lives here.

### Sizing a model
For `d_model = d`, `n_layers = L`:
- Attention params per layer ≈ `4d²` (Q, K, V, O), less with GQA
- FFN params per layer ≈ `8d²` (or `12d²/…` for gated, tuned to match)
- Total ≈ `12 · L · d²` plus embeddings

Llama-3-8B: `L=32, d=4096` → `12 × 32 × 4096² ≈ 6.4B` + ~1.6B embeddings ≈ 8B. The formula works.

### Depth vs width
For fixed parameter count, deeper models are generally better at compositional reasoning; wider models are faster (better GPU utilisation, fewer sequential steps). Real models sit near `d_model ≈ 128 × n_layers` as a rough empirical ratio.

## Gotchas
- Pre-norm models need a **final norm** after the last block, before the output projection. Omitting it is a real and easy-to-miss bug.
- The FFN, not attention, dominates parameter count and memory. People optimise attention and are surprised memory barely moves.
- Bias terms have been dropped from most modern LLMs (Llama has none in linear layers) — they cost memory and add nothing at scale. Code assuming biases exist will break on `state_dict` load.
- Layer count in the config is not always what's trainable — MoE models report total params but activate a fraction. Don't size your GPU from the parameter count alone.
