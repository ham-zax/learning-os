# Hands-on: SFT with TRL and LoRA

## Summary
The core skill of this topic: take an open instruct model, teach it your task's format and domain with a few hundred to a few thousand examples, using LoRA so it fits on one GPU and costs a few dollars.

## Key Points

### The canonical script
```python
import torch
from datasets import load_dataset
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
from peft import LoraConfig
from trl import SFTTrainer, SFTConfig

model_id = "Qwen/Qwen2.5-7B-Instruct"

# 4-bit base (QLoRA). Drop quantization_config entirely if you have the VRAM.
bnb = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
)
model = AutoModelForCausalLM.from_pretrained(
    model_id, quantization_config=bnb, dtype=torch.bfloat16,
    attn_implementation="flash_attention_2", device_map="auto",
)
tok = AutoTokenizer.from_pretrained(model_id)

peft_config = LoraConfig(
    r=16, lora_alpha=32, lora_dropout=0.05,
    target_modules=["q_proj","k_proj","v_proj","o_proj",
                    "gate_proj","up_proj","down_proj"],
    task_type="CAUSAL_LM",
)

ds = load_dataset("json", data_files="train.jsonl", split="train")  # {"messages": [...]}

cfg = SFTConfig(
    output_dir="out",
    num_train_epochs=3,
    per_device_train_batch_size=2,
    gradient_accumulation_steps=8,      # effective batch = 16
    learning_rate=2e-4,                 # LoRA wants ~10x full-FT LR
    lr_scheduler_type="cosine",
    warmup_ratio=0.03,
    max_length=2048,
    packing=True,                       # concatenate short examples, big throughput win
    bf16=True,
    gradient_checkpointing=True,
    logging_steps=10,
    save_strategy="epoch",
    report_to="none",
)

SFTTrainer(model=model, args=cfg, train_dataset=ds,
           peft_config=peft_config, processing_class=tok).train()
```

### What TRL is doing for you
- Applies the tokenizer's **chat template** to the `messages` column.
- **Completion-only loss** — masks the prompt so you train on assistant turns, not on restating the user.
- **Packing** — concatenates short examples up to `max_length` so no compute is wasted on padding. Often a 2–5× throughput improvement on short data.
- Attaches the PEFT adapters and disables the base model's gradients.

### Choosing hyperparameters
| Knob | Start at | Move if |
|---|---|---|
| `r` | 16 | loss plateaus high → 32/64; overfits fast → 8 |
| `lora_alpha` | `2 × r` | rarely tuned independently |
| `target_modules` | all attention + MLP projections | attention-only is cheaper, less expressive |
| `learning_rate` | `2e-4` | loss is noisy/diverging → `1e-4`; barely moves → `3e-4` |
| epochs | 2–3 | more than 3 on a small set memorises |
| effective batch | 16–32 | via `grad_accum`, not by raising per-device batch |

### Base vs instruct
- **Instruct base model**: fewer examples needed, keeps general ability, must match its chat template exactly. Default choice.
- **Raw base model**: for narrow, high-volume, format-rigid tasks where you don't want the assistant persona. Needs more data.

### After training
```python
from peft import PeftModel
base = AutoModelForCausalLM.from_pretrained(model_id, dtype=torch.bfloat16)  # NOT 4-bit
merged = PeftModel.from_pretrained(base, "out/checkpoint-XXX").merge_and_unload()
merged.save_pretrained("merged"); tok.save_pretrained("merged")
```
Merge into the **bf16** base, not the quantized one, then quantize the merged model if you need to. Or skip merging entirely and serve the adapter — vLLM loads LoRA adapters directly and can hot-swap them per request.

### Sanity checks before spending real GPU time
1. Run 20 steps on 50 examples with a 0.5B model. Does loss go down?
2. Print one fully rendered training example (`tokenize=False`). Is the template right? Is the assistant turn where you think?
3. Verify the loss mask: decode the tokens where `labels != -100`. It should be exactly the assistant response.
4. Only then launch the real run.

## Gotchas
- **Chat-template mismatch between training and serving** is the number one cause of a fine-tune that "doesn't work". Render and diff.
- If your model never stops generating, EOS is missing from your training targets. Check that the template's end-of-turn token is inside the unmasked region.
- `packing=True` with conversational data needs recent TRL; on older versions it can bleed one example's end into the next. Verify on a small sample.
- Gradient checkpointing plus `use_cache=True` conflict — set `gradient_checkpointing_kwargs={"use_reentrant": False}` and let TRL disable the cache.
- Fine-tuning an instruct model on narrow data erodes general ability. Mix in 5–10% general instruction data if you need it to stay a usable assistant.
- LoRA LR is ~10× full fine-tuning LR. Using `2e-5` out of habit means almost nothing happens and you conclude LoRA doesn't work.
- A loss that drops to near-zero in one epoch means memorisation, not learning. Check held-out performance.
