# Hands-on: Fine-tune an Encoder Classifier

## Summary
Before any LLM fine-tuning, build the boring baseline: a small encoder with a classification head. It trains in minutes for cents, it is often good enough to ship, and it gives you the number that every later, more expensive approach has to beat.

## Key Points

### Why this first
- **Speed**: a 150M-parameter encoder on 5k examples trains in ~5 minutes on a T4 — under $0.05 on Modal.
- **Cost at inference**: ~1000× cheaper per prediction than a generative model, and milliseconds instead of seconds.
- **It frequently wins.** On a fixed-label task with a few thousand labeled examples, a fine-tuned DeBERTa or ModernBERT beats a prompted 70B model. Regularly. This is not a consolation prize.
- **It de-risks your data.** If the classifier can't learn your task, your labels are inconsistent — and no amount of LLM will fix that. Finding this out for $0.05 is the point.

### The full recipe
```python
import numpy as np, evaluate
from datasets import load_dataset
from transformers import (AutoTokenizer, AutoModelForSequenceClassification,
                          TrainingArguments, Trainer, DataCollatorWithPadding)

model_id = "answerdotai/ModernBERT-base"   # or microsoft/deberta-v3-base
ds  = load_dataset("json", data_files={"train": "train.jsonl", "test": "test.jsonl"})
tok = AutoTokenizer.from_pretrained(model_id)

def prep(b): return tok(b["text"], truncation=True, max_length=512)
ds = ds.map(prep, batched=True, remove_columns=["text"])

labels = ["reject", "maybe", "strong_fit"]
model = AutoModelForSequenceClassification.from_pretrained(
    model_id, num_labels=len(labels),
    id2label=dict(enumerate(labels)),
    label2id={l: i for i, l in enumerate(labels)},
)

f1 = evaluate.load("f1")
def metrics(p):
    return f1.compute(predictions=np.argmax(p.predictions, -1),
                      references=p.label_ids, average="macro")

args = TrainingArguments(
    output_dir="out", num_train_epochs=3,
    per_device_train_batch_size=16, learning_rate=2e-5,
    warmup_ratio=0.1, weight_decay=0.01, bf16=True,
    eval_strategy="epoch", save_strategy="epoch",
    load_best_model_at_end=True, metric_for_best_model="f1",
)
Trainer(model=model, args=args,
        train_dataset=ds["train"], eval_dataset=ds["test"],
        data_collator=DataCollatorWithPadding(tok),
        compute_metrics=metrics).train()
```

### Hyperparameters that actually matter
- **Learning rate**: `2e-5` for full fine-tuning of an encoder. This is 10–100× larger than what you'll use for LLM LoRA — different regime, don't transfer the intuition.
- **Epochs**: 2–4. Encoders overfit quickly on small data; watch eval loss, not train loss.
- **`max_length`**: 512 for BERT/DeBERTa, up to 8192 for ModernBERT. Truncation is your main information loss — check where your documents actually end.
- **Class weights** for imbalanced data: subclass `Trainer` and override `compute_loss` with a weighted `CrossEntropyLoss`.

### Model choice
| Model | When |
|---|---|
| `answerdotai/ModernBERT-base` | default in 2026 — 8k context, fast, strong |
| `microsoft/deberta-v3-base` | best accuracy per parameter on classic benchmarks |
| `distilbert-base-uncased` | when latency or CPU inference dominates |
| `intfloat/multilingual-e5-base` | non-English or mixed-language input |

### Beyond single-label
- **Multi-label**: `problem_type="multi_label_classification"`, BCE loss, sigmoid outputs, tune a per-label threshold on validation.
- **Regression**: `num_labels=1` with `problem_type="regression"` — for scoring/ranking tasks.
- **Token classification** (`AutoModelForTokenClassification`): the right tool for span extraction (pull skills out of a job description as spans rather than generating them).

## Gotchas
- Label order must be consistent between training and inference. Always set `id2label`/`label2id` — otherwise you get a silently permuted mapping when you reload.
- Accuracy on imbalanced data is meaningless. Use macro-F1, and look at the per-class confusion matrix.
- `load_best_model_at_end=True` requires `eval_strategy` and `save_strategy` to match, or it errors at the end of training — after you've paid for the whole run.
- Encoders cannot output free-form text. If your task genuinely needs generation or a flexible schema, this baseline measures the *classification part* of it, not the whole thing.
- Don't tune hyperparameters against your test set. Make a third split, or you'll ship an inflated number.
