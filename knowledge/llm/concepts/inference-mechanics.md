# Inference Mechanics: KV Cache, Prefill, Decode

## Summary
LLM inference has two phases with completely different performance characteristics. Prefill is compute-bound and parallel; decode is memory-bandwidth-bound and sequential. Almost every serving decision — batch size, GPU choice, quantization, cost per token — follows from this split.

## Key Points

### The KV cache
Without a cache, generating token `n` would recompute attention over all `n-1` previous tokens from scratch — `O(n²)` work per token, `O(n³)` for a sequence. Instead, the K and V vectors for each past token are computed once and cached.

```
KV cache bytes = 2 × n_layers × n_kv_heads × head_dim × seq_len × batch × bytes_per_element
```

Worked example — Llama-3-8B (32 layers, 8 KV heads via GQA, head_dim 128), bf16, 8k context, batch 1:
`2 × 32 × 8 × 128 × 8192 × 1 × 2 ≈ 1.07 GB`

At batch 32 that's **34 GB — larger than the 16 GB of model weights.** This is why long-context serving is expensive, and why GQA (8 KV heads instead of 32) was such an important change.

### Prefill vs decode
| | Prefill | Decode |
|---|---|---|
| Processes | whole prompt at once | one token at a time |
| Parallelism | all positions in parallel | strictly sequential |
| Bottleneck | **compute** (FLOPs) | **memory bandwidth** |
| Metric | time-to-first-token (TTFT) | inter-token latency (ITL) |
| Scales with | prompt length | output length |

**Decode is memory-bound**: to generate one token you must read *every model weight* from HBM. An 8B model in bf16 is 16 GB; an H100 has ~3.3 TB/s bandwidth, so the floor is ~5 ms/token ≈ 200 tok/s — regardless of how fast the GPU's tensor cores are. This is why quantization speeds up decode so much (fewer bytes to read) and why decode utilises maybe 5% of a GPU's FLOPs at batch 1.

### Batching
Because decode is bandwidth-bound, processing 32 sequences costs barely more than 1 — the weights are read once and reused. **Batching is nearly free throughput.**
- **Static batching**: wait for a full batch, run it to completion. Wasteful — the whole batch waits for the longest sequence.
- **Continuous / in-flight batching**: as soon as one sequence finishes, admit a new one into the free slot. 10–20× throughput over static batching in practice. This is vLLM's and TGI's core feature.

### PagedAttention
The KV cache was traditionally allocated contiguously at max length, wasting 60–80% of it. PagedAttention (vLLM) manages the cache in fixed-size blocks like OS virtual memory: allocate on demand, share blocks between sequences with a common prefix, no fragmentation. This is the single biggest serving throughput improvement of the last few years.

### Prefix caching
If many requests share a prefix (a long system prompt, a document, a few-shot preamble), cache its KV blocks and skip prefill for the shared part. Cuts TTFT dramatically for RAG and agent workloads. Requires the prefix to match **token-exactly** — a changing timestamp at the top of your system prompt destroys the hit rate.

### Latency vs throughput
These trade off directly. Large batches maximise tokens/sec/GPU (cost efficiency) but increase per-request latency. Chunked prefill (interleaving prefill chunks with decode steps) exists to stop a long prompt from stalling everyone else's decoding.

## Gotchas
- Budget KV cache memory *before* choosing a GPU. Model weights are the smaller number at any real batch size or context length.
- `use_cache=True` must be off during training (it wastes memory and is meaningless with teacher forcing) and on during generation. HF handles this, custom loops often don't.
- Gradient checkpointing and `use_cache=True` conflict — HF emits a warning and silently disables the cache. Ignoring that warning costs you nothing at train time but confuses benchmarking.
- Cost-per-token quotes almost always assume large batches. Your single-user latency will be much worse than the published throughput implies.
- Sliding-window attention caps the KV cache but means the model genuinely cannot attend beyond the window in those layers — a real capability limit, not just an optimisation.
