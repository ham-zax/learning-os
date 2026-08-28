# Hands-on: Datasets and Chat Templates

## Summary
Dataset construction is 70% of the work and 90% of the outcome quality of a fine-tune. The `datasets` library makes the mechanics easy; the judgment — what goes in, how it's formatted, how you split it — is where projects succeed or fail.

## Key Points

### Loading
```python
from datasets import load_dataset, Dataset

ds = load_dataset("HuggingFaceH4/ultrachat_200k", split="train_sft")   # from the Hub
ds = load_dataset("json", data_files="data/train.jsonl", split="train") # local
ds = Dataset.from_list([{"prompt": ..., "completion": ...}, ...])       # from Python
ds = load_dataset("c4", "en", split="train", streaming=True)            # too big for disk
```
Backed by Apache Arrow and memory-mapped, so a 100 GB dataset works on a 16 GB machine. `streaming=True` gives an `IterableDataset` — no random access, no `len()`, no shuffling beyond a buffer.

### Transforming
```python
ds = ds.filter(lambda r: 50 < len(r["text"]) < 8000)
ds = ds.map(add_fields, batched=True, num_proc=8, remove_columns=ds.column_names)
splits = ds.train_test_split(test_size=0.1, seed=42)
```
`map` caches to disk keyed by a hash of your function — change the function, it recomputes; don't, and it's instant. `num_proc` parallelises. **Always `remove_columns`** on the tokenizing map or you carry the raw text through training and waste memory.

### The two SFT formats TRL accepts
**Conversational** (preferred — TRL applies the chat template for you):
```json
{"messages": [
  {"role": "system", "content": "You extract skills from job descriptions."},
  {"role": "user", "content": "<job description text>"},
  {"role": "assistant", "content": "{\"skills\": [\"Kubernetes\", \"Go\"]}"}
]}
```
**Prompt-completion** (for completion-only loss on non-chat tasks):
```json
{"prompt": "...", "completion": "..."}
```
Do not pre-render the chat template into a `text` field and also let TRL apply it — you get double special tokens, and the model learns a format you'll never serve with.

### Chat templates
The template is a Jinja string stored on the tokenizer. Inspect it:
```python
print(tok.chat_template)
print(tok.apply_chat_template(messages, tokenize=False))
```
`add_generation_prompt=True` appends the assistant-turn opening tokens — correct at **inference**, wrong when rendering a full training example that already contains the assistant turn.

### Building your own dataset — the part that matters
1. **Define the output contract first.** Exact JSON schema, exact field names. Write it down before collecting anything.
2. **Start at 200–500 examples.** LIMA's result holds: 1k excellent examples beat 100k noisy ones. You can get a real signal from 200.
3. **Bootstrap labels with a strong model**, then *review by hand*. Distillation is legitimate and standard; unreviewed synthetic data is how you train a model to imitate a stronger model's mistakes.
4. **Hold out a test set before you look at anything.** Split by source document, not by row, or near-duplicates leak across the split and your eval lies to you.
5. **Include negatives and edge cases.** Empty inputs, ambiguous inputs, inputs where the correct answer is "none". A model trained only on clean positives is confidently wrong on everything else.
6. **Keep the system prompt identical** between training and serving.

### Pushing and versioning
```python
ds.push_to_hub("username/my-dataset", private=True)
```
Versioned by commit like a model repo. Worth doing even for private work — it makes a training job on Modal a one-line download instead of a file-transfer problem.

## Gotchas
- Splitting randomly when rows come from the same source document leaks information and inflates your eval. Split by document ID.
- `map` cache is keyed on the function's bytecode — a change in a *called* helper may not invalidate it. `load_from_cache_file=False` when in doubt.
- Long examples get truncated silently at `max_length`. If your labels live at the end of the sequence, you are training on inputs with no targets.
- Class imbalance is invisible until evaluation. Count your labels before training, always.
- Chat template mismatch between your dataset prep and your serving code is the single most common cause of "the fine-tune got worse". Render one example both ways and diff them.
- `streaming=True` datasets can't be shuffled properly and break `Trainer`'s length-based schedulers. Use only when the data genuinely doesn't fit.
