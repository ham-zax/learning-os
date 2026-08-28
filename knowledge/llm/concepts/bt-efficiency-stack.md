# Breakthrough: LoRA, FlashAttention, Quantization, vLLM

## Summary
Four systems advances, none of which improved model quality, collectively reduced the cost of training and serving LLMs by 1–2 orders of magnitude. They are the reason a person with one GPU and $30 can do meaningful work. This concept is the practical heart of the topic.

## Key Points

### LoRA (2021) — parameter-efficient fine-tuning
Freeze the pretrained weights `W`. Learn a low-rank update `ΔW = B·A` where `A` is `[r, d]` and `B` is `[d, r]`, with `r` typically 8–64.

- Trainable parameters drop by 100–1000×. A 7B full fine-tune needs ~112 GB of optimizer state and gradients; a LoRA fine-tune needs a few hundred MB.
- **Zero inference overhead** — merge `B·A` into `W` after training and you have an ordinary model.
- Adapters are small (10–200 MB), so you can keep dozens and hot-swap them per request.
- Why low rank works: the *update* needed to adapt a pretrained model to a task has low intrinsic dimensionality, even though the model doesn't.
- Key hyperparameters: `r` (capacity), `lora_alpha` (scaling; a common convention is `alpha = 2r`), `target_modules` (attention projections at minimum; including the FFN projections helps for bigger behavioural changes).

**QLoRA (2023)** stacked quantization on top: load the base model in 4-bit NF4, train LoRA adapters in bf16 through it, with paged optimizers to survive memory spikes. This is what put 65B fine-tuning on a single 48 GB GPU, and 7B fine-tuning on a free Colab T4.

### FlashAttention (2022, v2 2023, v3 2024)
An **exact** attention algorithm — same output, no approximation — that never materialises the `n×n` attention matrix in HBM. It tiles the computation in SRAM and recomputes what it needs in the backward pass.

- 2–4× faster, and memory goes from `O(n²)` to `O(n)`.
- This is what made 32k+ context practical. The FLOPs are unchanged; the *memory traffic* is what was killing you.
- Practically: install `flash-attn` and pass `attn_implementation="flash_attention_2"`. It is close to free performance, and PyTorch's SDPA gives you much of it by default.

### Quantization
Store weights in fewer bits. Since decode is memory-bandwidth-bound, fewer bytes means proportionally faster generation *and* less VRAM.

| Format | Use | Notes |
|---|---|---|
| bf16 | training, quality baseline | 2 bytes/param |
| fp8 | training + inference on H100+ | native hardware support |
| int8 / LLM.int8() | inference | ~free quality, moderate savings |
| **NF4 / 4-bit** | **QLoRA training, inference** | 4× smaller, small quality cost |
| GPTQ / AWQ | inference-only, calibrated | better quality than naive 4-bit |
| GGUF (llama.cpp) | CPU/Mac inference | the laptop path |

Rule of thumb: 4-bit costs a little quality; below 4-bit degrades sharply. A 4-bit larger model usually beats an 8-bit smaller one.

### vLLM and PagedAttention (2023)
KV cache managed in fixed-size blocks like OS virtual memory — allocate on demand, share blocks across sequences with a common prefix, no fragmentation. Combined with continuous batching, this delivered 10–24× throughput over naive HF `generate()` serving.

Together with TGI and SGLang, this is the production inference layer. **Never serve a real workload with `model.generate()` in a loop** — the throughput difference is not marginal.

### How they compose
The realistic single-GPU recipe: **4-bit base model + LoRA adapters + FlashAttention + gradient checkpointing + bf16 compute + packed sequences.** Each one multiplies the others' effect. A fine-tune that would have needed a multi-GPU node in 2022 runs on one A100 for a couple of dollars.

## Gotchas
- LoRA rank too low (`r=4`) underfits behavioural changes; too high (`r=256`) loses the regularisation benefit and approaches full fine-tuning cost. Start at `r=16`, raise only if the loss plateaus high.
- Merging a LoRA adapter into a **4-bit quantized** base loses precision. Merge into the fp16/bf16 base, then quantize the merged model.
- FlashAttention requires Ampere or newer and a compatible CUDA build. It silently falls back — check that it actually loaded.
- Quantized models fine-tune *through* the quantization, not into it. QLoRA's adapter weights remain higher precision; only the frozen base is 4-bit.
- vLLM's memory pre-allocation (`gpu_memory_utilization`) grabs most of the GPU at startup. Running training and vLLM on the same GPU will OOM in a confusing way.
