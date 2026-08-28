# Breakthrough: BERT vs GPT — the Pretraining Era (2018-2019)

## Summary
Two forks from the same architecture established the paradigm that replaced task-specific models: pretrain once on unlabeled text, then adapt. BERT won 2018–2020 on benchmarks; GPT's bet on generation won everything after.

## Key Points

### BERT (Google, October 2018)
- **Encoder-only**, bidirectional — every token sees every other token, past and future.
- **Masked language modeling**: hide 15% of tokens, predict them from both sides. Plus next-sentence prediction (later shown to be useless and dropped by RoBERTa).
- Usage: pretrain, then attach a small task head and fine-tune the whole model on labeled data.
- Result: state of the art on eleven NLP benchmarks at once. GLUE scores jumped so far the benchmark had to be replaced (SuperGLUE).
- **Why bidirectional helps**: for *understanding* a sentence, information from the right is as useful as from the left. For classification, NER, and retrieval, BERT-family encoders are still the right tool — and still cheaper and better than an LLM for those tasks.

### GPT-1 and GPT-2 (OpenAI, 2018–2019)
- **Decoder-only**, causal — each token sees only the past.
- Plain next-token prediction, no masking scheme, no auxiliary objectives.
- GPT-1 (117M): pretrain + fine-tune, similar recipe to BERT, better than task-specific models.
- **GPT-2 (1.5B) changed the framing**: with enough scale, tasks could be performed **zero-shot** by phrasing them as text continuation. No fine-tuning, no task head. Summarisation became "…TL;DR:". Translation became a formatted prompt.
- OpenAI's staged release ("too dangerous") was the field's first mainstream capability-risk debate, and generated enormous attention for the result.

### Why decoder-only won
1. **Generation.** MLM models cannot generate coherently. Once the target application became "produce text", the encoder path was disqualified.
2. **Sample efficiency.** MLM gives signal on ~15% of positions per pass; causal LM gives signal on 100%.
3. **Task uniformity.** Everything — classification, translation, code, chat — becomes next-token prediction over a formatted string. One model, one interface, no task heads.
4. **Scaling.** The simpler objective scaled more cleanly, and scaling turned out to be the dominant variable.

### The encoder-decoder middle path
T5 (2019) unified every task as text-to-text with an encoder-decoder and span corruption. Elegant, competitive, and largely abandoned for general LLMs — though it survives in translation, speech (Whisper), and multimodal encoders.

### What survives from BERT
Not a footnote — a live, correct choice:
- **Sentence embeddings and retrieval**: `sentence-transformers`, BGE, E5, GTE are all encoder models. RAG runs on BERT descendants.
- **Classification and extraction**: a fine-tuned DeBERTa or ModernBERT beats a prompted 70B LLM on a fixed-label task, at 1000× lower inference cost. **This is the baseline you should build before reaching for a generative model.**
- ModernBERT (2024) modernised the encoder with RoPE, GeGLU, and 8k context — evidence the line is still worth investing in.

## Gotchas
- "BERT is obsolete" is wrong and expensive. For a classification task with labeled data, an encoder is usually the correct answer.
- BERT cannot generate text. Attempts to make it do so (Gibbs sampling over masks) are curiosities.
- BERT's `[CLS]` token is not a good sentence embedding out of the box — it needs contrastive fine-tuning (this is exactly what `sentence-transformers` adds).
- GPT-2's zero-shot results were much weaker than the narrative suggests; the paradigm shift was real, the numbers were modest. GPT-3 supplied the numbers.
