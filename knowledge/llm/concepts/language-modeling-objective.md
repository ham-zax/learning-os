# The Language Modeling Objective

## Summary
An autoregressive LLM is trained to do exactly one thing: given tokens `x₁…xₜ`, output a probability distribution over the next token `xₜ₊₁`. Every capability — translation, code, reasoning, refusal — is an emergent side effect of getting very good at that single objective on a large enough corpus.

## Key Points

### The factorization
The joint probability of a sequence decomposes by the chain rule:

```
P(x₁…xₙ) = ∏ P(xₜ | x₁…xₜ₋₁)
```

The model only ever has to learn the conditional. This is why the architecture is causal (each position attends only to the past) and why generation is inherently sequential.

### The loss
Cross-entropy between the predicted distribution and the true next token:

```
loss = -log P(x_actual | context)
```

Averaged over all positions. Crucially, in a decoder-only transformer **every position produces a prediction in one forward pass** — a 4096-token sequence yields 4096 training signals. This parallelism during training (contrasted with sequential generation at inference) is the transformer's central practical advantage over RNNs.

### Teacher forcing and exposure bias
During training the model always conditions on the *true* prefix, never its own output. At inference it conditions on its own generations. This mismatch — exposure bias — is why errors compound in long generations and why a model that looks perfect on the training loss can drift into repetition or nonsense over 2000 tokens.

### Perplexity
`perplexity = exp(cross_entropy_loss)`. Interpretable as "the model is as confused as if it were choosing uniformly among N tokens." A perplexity of 10 on held-out text is strong; 1000 is near-random.
- It is a *relative* measure only — comparable across models **only if they share a tokenizer**, because loss is per-token and token counts differ.
- Low perplexity does not imply usefulness. A model can have excellent perplexity and be unhelpful, because "likely continuation of internet text" is not "answer my question."

### Other objectives worth knowing
- **Masked LM (BERT)**: mask 15% of tokens, predict them from both directions. Better representations, but cannot generate — and only ~15% of positions give signal per pass, so it's less sample-efficient.
- **Span corruption (T5)**: mask contiguous spans, generate them. Encoder-decoder framing.
- **Fill-in-the-middle (code models)**: reorder the document so the model learns to condition on both a prefix and a suffix. This is what makes tab-completion in an editor work.

### Why this objective produces intelligence
Predicting the next token in arbitrary human text requires modelling whatever produced that text: syntax, facts, arithmetic, the intentions of the writer, the answer to the question posed two paragraphs earlier. The objective is trivial; the data makes it hard. "Compression is intelligence" is the shorthand for this argument.

## Gotchas
- Loss is computed on shifted labels. Off-by-one here is the single most common bug when writing a training loop by hand — HF's `Trainer` shifts for you, so don't shift again.
- Padding tokens must be masked out of the loss (label `-100` in PyTorch/HF). Forgetting this trains the model to predict padding and quietly wrecks quality.
- In instruction tuning you usually want loss on the *completion only*, not the prompt. TRL's `SFTTrainer` supports this; the naive setup trains on both and dilutes the signal.
- Perplexity across different tokenizers is not comparable. Reviewers and blog posts do this constantly and it's meaningless.
