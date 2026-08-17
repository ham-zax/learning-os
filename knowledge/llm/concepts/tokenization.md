# Tokenization and BPE

## Summary
A language model never sees text. It sees integers. Tokenization is the lossy, learned mapping from a byte string to a sequence of vocabulary IDs — and almost every "weird" LLM behaviour (can't count letters, bad at arithmetic, costs more in Thai than English) traces back to this layer.

## Key Points

### Why not characters or words
- **Characters**: vocabulary ~256, but sequences become very long. Attention is quadratic in length, so this is expensive.
- **Words**: sequences are short, but the vocabulary is unbounded — every typo, name, and compound is out-of-vocabulary.
- **Subwords**: the compromise. Common words are one token; rare words decompose into pieces. Nothing is ever OOV.

### Byte-Pair Encoding (BPE)
The dominant algorithm. Training procedure:
1. Start with a vocabulary of all 256 bytes.
2. Count all adjacent token pairs in the training corpus.
3. Merge the most frequent pair into a new token; record the merge rule.
4. Repeat until the vocabulary reaches the target size (typically 32k–256k).

Encoding applies the learned merge rules in order. Decoding is a plain lookup — always lossless because the base units are bytes.

### The main variants
- **Byte-level BPE** (GPT-2 onward) — operates on raw UTF-8 bytes, so any input encodes. This is why you see tokens like `Ġthe` (the `Ġ` is an encoded leading space).
- **WordPiece** (BERT) — merges by likelihood gain rather than raw frequency; marks continuations with `##`.
- **SentencePiece / Unigram** (T5, Llama, Gemma) — treats input as a raw stream with no pre-tokenization, so it handles languages without spaces. Unigram prunes a large candidate vocabulary down by likelihood instead of merging up.

### Special tokens
`<|endoftext|>`, `<|im_start|>`, `<pad>`, `<unk>`, BOS/EOS. These are added to the vocabulary out-of-band, not learned by BPE. Chat formatting is entirely built out of special tokens — the "roles" in a chat API are literally special-token delimiters in the prompt string.

### Practical consequences
- **Token count ≠ word count.** English averages ~0.75 words per token. Code, JSON, and non-Latin scripts are far less efficient — the same sentence in Chinese or Thai can cost 2–4× the tokens, which is a direct cost and context-window penalty.
- **Numbers tokenize badly.** `1234` may be `12` + `34`. Arithmetic weakness is partly a tokenizer artifact. Newer tokenizers split digits individually to mitigate this.
- **Letter-level tasks are hard.** "How many r's in strawberry" is hard because the model sees ~3 opaque integers, not 10 characters.
- **Vocabulary size is a real tradeoff.** Bigger vocab = shorter sequences (cheaper attention) but a larger embedding matrix and softmax (more parameters, more memory).

## Gotchas
- Always use the tokenizer that shipped with the model checkpoint. A mismatched tokenizer produces fluent-looking garbage, not an error.
- Adding new special tokens requires resizing the embedding matrix (`model.resize_token_embeddings`) — forget this and you get an index-out-of-range crash or silently untrained embeddings.
- Leading whitespace matters: `" hello"` and `"hello"` are different tokens. This is a classic source of few-shot prompt bugs.
- `tokenizer.apply_chat_template()` is not cosmetic — if you fine-tune with a different template than you serve with, quality drops for reasons that look like a training bug.
- Truncation is silent by default in many pipelines. Long inputs lose their tail without warning.
