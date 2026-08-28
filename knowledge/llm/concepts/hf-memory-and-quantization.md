# Hands-on: GPU Memory Math and Quantization

## Summary
Being able to compute VRAM requirements on paper — before renting a GPU — is what turns a fixed budget into a plan instead of a series of OOM crashes. The arithmetic is simple and almost nobody does it.

## Key Points

### Inference memory
```
weights      = params × bytes_per_param
KV cache     = 2 × layers × kv_heads × head_dim × seq_len × batch × bytes
activations  ≈ small for inference
total        ≈ weights + KV cache + ~15% overhead
```
Bytes per param: fp32=4, bf16/fp16=2, int8=1, 4-bit=0.5.

**Llama-3-8B, bf16, 8k context, batch 1**: 16 GB weights + ~1 GB cache ≈ 19 GB with overhead. Fits an A100-40GB comfortably; does *not* fit a 16 GB T4.
**Same model in 4-bit**: ~4.5 GB weights + 1 GB cache ≈ 6.5 GB. Fits a T4 with room for a batch.

### Training memory — the number that surprises people
Full fine-tuning in bf16 with AdamW, per parameter:
| Component | Bytes |
|---|---|
| Weights (bf16) | 2 |
| Gradients (bf16) | 2 |
| Adam momentum (fp32) | 4 |
| Adam variance (fp32) | 4 |
| fp32 master weights | 4 |
| **Total** | **~16 bytes/param** |

A 7B full fine-tune needs **~112 GB** before activations. This is why full fine-tuning is off the table on one GPU, and why LoRA exists.

**LoRA/QLoRA** trains only adapters (well under 1% of parameters), so optimizer state is negligible:
```
7B QLoRA ≈ 4 GB (4-bit base) + ~0.5 GB (adapters + their optimizer state)
         + activations  →  comfortably under 16 GB at seq_len 2048
```

### Activations — the variable that actually causes your OOM
Activation memory scales with `batch × seq_len × hidden × layers`. It is usually what pushes you over, and it's the one you control:
- **Gradient checkpointing**: recompute activations in the backward pass. ~60–70% activation memory saved for ~30% more compute. Turn it on by default.
- **Lower `per_device_train_batch_size` and raise `gradient_accumulation_steps`** — identical effective batch, much less memory.
- **Reduce `max_length`.** Memory scales linearly with it (quadratically for attention without FlashAttention). Trimming 4096 → 2048 often halves your peak.

### Quantization formats — what to use when
| Format | Use case | Quality cost |
|---|---|---|
| bf16 | training, quality reference | none |
| fp8 | H100+ training and inference | minimal |
| int8 (LLM.int8) | inference | negligible |
| **NF4 (bitsandbytes)** | **QLoRA training** | small |
| GPTQ / AWQ | inference, calibrated on sample data | small, better than naive 4-bit |
| GGUF Q4_K_M | llama.cpp on Mac/CPU | small |

Two rules that hold up: **below 4-bit degrades sharply**, and **a 4-bit larger model beats an 8-bit smaller one** at equal memory.

### Picking a GPU on Modal for a given job
| Job | GPU | Why |
|---|---|---|
| Encoder classifier, <1B | T4 ($0.59/hr) | plenty; cheapest |
| 1–3B LoRA SFT | L4 ($0.80/hr) | 24 GB, no quantization needed |
| 7–8B QLoRA SFT | A100-40GB ($2.10/hr) | headroom for seq 2048–4096 |
| 13–34B QLoRA | A100-80GB ($2.50/hr) | 4-bit base + activations |
| Fast iteration on 8B | H100 ($3.95/hr) | ~2× A100 throughput; sometimes cheaper per run |

Cost per run is what matters, not cost per hour — an H100 that finishes in 40 minutes can beat an A100 that takes 2 hours.

### Measure, don't guess
```python
torch.cuda.reset_peak_memory_stats()
# ... one training step ...
print(f"peak: {torch.cuda.max_memory_allocated()/1e9:.1f} GB")
```
Run one step locally or on the cheapest GPU, read the peak, then size the real job.

## Gotchas
- `device_map="auto"` offloads to CPU/disk instead of OOMing when short on VRAM — you get a silent 100× slowdown. Check `model.hf_device_map` before assuming the GPU is being used.
- PyTorch's caching allocator doesn't return memory to the OS; `nvidia-smi` shows more than you're using. Trust `torch.cuda.max_memory_allocated()`.
- Fragmentation causes OOM at well under theoretical capacity on long runs. `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True` helps.
- Evaluation during training allocates its own activations and can OOM a run that trained fine for hours. Use a smaller eval batch.
- 4-bit quantization is *slower* per step than bf16 for training (dequantization overhead). You use it to fit, not to go faster.
- Quantized models can't be merged with LoRA at full precision. Merge into bf16 first, then re-quantize.
