# Hands-on: First Inference with transformers

## Summary
Load a model, tokenize, generate, decode. Twenty lines that make the theory concrete — and the place to build intuition for dtype, device placement, and generation config before any of it costs you GPU time.

## Key Points

### The three-line version (smoke test only)
```python
from transformers import pipeline
pipe = pipeline("text-generation", model="Qwen/Qwen2.5-0.5B-Instruct", device_map="auto")
print(pipe([{"role": "user", "content": "Explain KV cache in two sentences."}], max_new_tokens=128))
```
Good for "does this model load". Not what you build on.

### The version you should learn
```python
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

model_id = "Qwen/Qwen2.5-1.5B-Instruct"
tok = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    dtype=torch.bfloat16,          # half the memory of fp32, no loss scaling needed
    device_map="auto",             # requires `accelerate`
    attn_implementation="sdpa",    # or "flash_attention_2" if installed
)

messages = [
    {"role": "system", "content": "You are terse and precise."},
    {"role": "user", "content": "What is a KV cache?"},
]
# apply_chat_template inserts the model's special tokens — never hand-format this
inputs = tok.apply_chat_template(
    messages, add_generation_prompt=True, return_tensors="pt", return_dict=True
).to(model.device)

out = model.generate(
    **inputs,
    max_new_tokens=256,
    do_sample=True, temperature=0.7, top_p=0.9,
    pad_token_id=tok.eos_token_id,
)
# slice off the prompt — generate() returns prompt + completion
print(tok.decode(out[0][inputs["input_ids"].shape[-1]:], skip_special_tokens=True))
```

### The AutoClasses
`AutoModelForCausalLM` (generation), `AutoModelForSequenceClassification` (classification), `AutoModelForTokenClassification` (NER), `AutoModelForSeq2SeqLM` (T5, Whisper). Each attaches a different head to the same backbone. Picking the right one is most of the work of framing a task.

### Things to actually try, in order
1. Print `len(tok.encode(text))` for English, Chinese, JSON, and Python. See the tokenizer efficiency gap from the theory concept in real numbers.
2. Print `tok.apply_chat_template(messages, tokenize=False)` — look at the raw special tokens. This demystifies "chat".
3. Generate at `temperature=0`, `0.7`, and `1.5` on the same prompt. Watch coherence degrade.
4. Inspect `model.config` — `num_hidden_layers`, `hidden_size`, `num_key_value_heads`. Compute the parameter count with `12·L·d²` and compare to `sum(p.numel() for p in model.parameters())`.
5. Time generation with and without `use_cache=False`. The KV cache stops being abstract.

### Streaming
```python
from transformers import TextIteratorStreamer
from threading import Thread
streamer = TextIteratorStreamer(tok, skip_prompt=True, skip_special_tokens=True)
Thread(target=model.generate, kwargs={**inputs, "streamer": streamer, "max_new_tokens": 256}).start()
for token in streamer:
    print(token, end="", flush=True)
```

### Start small, deliberately
A 0.5B–1.5B instruct model runs on Apple Silicon MPS or CPU in seconds and teaches you the same API as a 70B. Do all your debugging there; only move to a rented GPU once the script is correct. **This single habit is what keeps a $30/month budget comfortable.**

## Gotchas
- `max_new_tokens` defaults to **20**. Almost every "why did it stop mid-sentence" is this.
- Setting `temperature` without `do_sample=True` does nothing — HF warns, people ignore it.
- `generate()` returns the prompt tokens too. Forgetting to slice produces output that looks like the model echoed you.
- Batched generation needs `tok.padding_side = "left"` for decoder-only models. Right-padding puts pad tokens between the prompt and the generation, and the output is garbage with no error.
- Many models have no `pad_token`. Set `tok.pad_token = tok.eos_token` or batching crashes.
- `device_map="auto"` silently offloads to CPU or disk if VRAM is short — you get 100× slowdown instead of an OOM. Check `model.hf_device_map`.
- On Apple Silicon use `device_map="mps"` and `dtype=torch.float16`; bf16 support on MPS is uneven.
