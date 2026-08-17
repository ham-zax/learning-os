# Decoding and Sampling

## Summary
The model outputs a probability distribution over the vocabulary. Decoding is how you turn that into text. It is the cheapest lever you have on output quality — and the one most often left at defaults that are wrong for the task.

## Key Points

### From logits to tokens
1. Final hidden state → output projection → **logits** (one real number per vocab entry).
2. Divide by **temperature**.
3. Optionally truncate the distribution (top-k, top-p, min-p).
4. Softmax → probabilities.
5. Sample (or take the argmax).

### Temperature
`p_i ∝ exp(logit_i / T)`
- `T → 0`: argmax, fully deterministic.
- `T = 1`: the model's true distribution.
- `T > 1`: flatter, more surprising, more incoherent.

Practical: `0` for extraction, classification, and code; `0.6–0.8` for chat; `0.9–1.2` for creative writing. Above ~1.5 most models degrade into word salad.

### Truncation methods
- **Top-k**: keep the `k` most likely tokens. Simple, but a bad fit for varying uncertainty — `k=50` is far too permissive when the model is confident and too restrictive when it isn't.
- **Top-p (nucleus)**: keep the smallest set whose cumulative probability exceeds `p` (typically 0.9–0.95). Adapts to the distribution's shape. The standard default.
- **Min-p**: keep tokens with probability at least `min_p × p_max`. Newer, robust at high temperatures, increasingly the recommendation for creative sampling.
- **Repetition / frequency / presence penalties**: subtract from logits of already-used tokens. Blunt instruments — they can suppress legitimately necessary repetition (variable names in code, a person's name in a story). Prefer fixing the prompt or sampling params first.

### Greedy and beam search
- **Greedy** (`T=0`): highest-probability token each step. Deterministic, and often falls into repetition loops because high-probability text is repetitive text.
- **Beam search**: track `b` partial sequences and keep the highest total-likelihood ones. Standard for translation and summarisation, where there is one correct output. **Bad for open-ended generation** — it produces bland, high-likelihood, low-information text, and it costs `b×` the compute.

### Structured and constrained decoding
Mask the logits so only tokens valid under a grammar can be sampled. Guarantees the output parses — no more "the model returned almost-JSON".
- Libraries: Outlines, XGrammar, `llama.cpp` GBNF; vLLM and TGI have built-in support. Every major API now offers a JSON-schema mode built this way.
- **This is how you should extract structured data**, not by prompting and hoping.

### Speculative decoding
Run a small "draft" model to propose `k` tokens, then verify them all in a single forward pass of the large model. Accepted tokens are free; rejected ones cost nothing extra. **Output distribution is mathematically identical** to normal sampling — this is a pure latency win, typically 2–3×. Variants: Medusa (extra heads), EAGLE, n-gram/prompt lookup for repetitive text.

### Determinism
`T=0` is *not* fully reproducible in practice — floating-point non-associativity, batching, and kernel selection make GPU results vary run to run. Set a seed and pin the batch size if you need reproducibility, and expect it still to be imperfect.

## Gotchas
- Applying `repetition_penalty` in a JSON-generation task can break the syntax by penalising `"` and `{`.
- `do_sample=False` in HF `generate()` overrides temperature entirely — a very common "why is my temperature doing nothing" bug.
- Default `max_new_tokens` in HF is **20**. Truncated outputs are almost always this, not a model failure.
- Top-p and temperature interact multiplicatively. Tuning both at once is a two-variable search; change one at a time.
- If your fine-tuned model never stops generating, check that EOS is in the training targets and that `eos_token_id` is set correctly in the generation config. This is the #1 post-fine-tune bug.
