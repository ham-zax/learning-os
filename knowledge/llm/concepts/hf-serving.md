# Hands-on: Serving, Adapters, and Batching

## Summary
`model.generate()` in a loop is for debugging. Real serving means vLLM or TGI, which give 10–24× the throughput through continuous batching and PagedAttention — and can load your LoRA adapter without merging it.

## Key Points

### Why not `generate()`
It processes one batch at a time, waits for the slowest sequence, pre-allocates the KV cache at max length, and has no request queue. On a fixed GPU budget this is the difference between serving 5 requests/second and 100.

### vLLM — the default
```python
from vllm import LLM, SamplingParams

llm = LLM(
    model="merged-model",              # or the base model id
    dtype="bfloat16",
    gpu_memory_utilization=0.90,
    max_model_len=4096,
    enable_prefix_caching=True,        # big win for shared system prompts
)
params = SamplingParams(temperature=0.0, max_tokens=512)
outs = llm.chat([[{"role":"user","content":q}] for q in questions], params)
```
Offline batch inference like this is the cheapest way to run an eval or process a backlog — it saturates the GPU and exits, so on Modal you pay only for the actual work.

As a server:
```bash
vllm serve merged-model --port 8000 --max-model-len 4096
# OpenAI-compatible: POST /v1/chat/completions
```
The OpenAI-compatible API means your client code doesn't change between a hosted model and your own.

### Serving LoRA adapters without merging
```python
from vllm.lora.request import LoRARequest
llm = LLM(model="Qwen/Qwen2.5-7B-Instruct", enable_lora=True, max_loras=4)
llm.generate(prompts, params, lora_request=LoRARequest("task-a", 1, "adapters/task-a"))
```
One base model in memory, many small adapters swapped per request. This is how you serve five fine-tunes on one GPU. Merged models are simpler and marginally faster per token — use merged for a single task, adapters for several.

### Merge, or don't
| | Merged | Adapter |
|---|---|---|
| Setup | one model dir | base + small adapter |
| Multiple tasks | one full copy each | one base, N × ~100 MB |
| Speed | marginally faster | slight per-token overhead |
| Quantize after | straightforward | more awkward |

Merge into the **bf16** base (never the 4-bit one), then quantize if needed.

### The alternatives
- **TGI** (Hugging Face) — production server, tight Hub integration, good for HF-native deployments.
- **SGLang** — strong on structured output and complex multi-turn/agentic prompt reuse; RadixAttention for aggressive prefix sharing.
- **llama.cpp / Ollama** — GGUF quantized, CPU and Apple Silicon. The local-laptop path; not for concurrent serving.
- **HF Inference Endpoints** — managed, no ops, more expensive per token than self-serving on Modal.

### Structured output at serving time
```python
params = SamplingParams(guided_decoding=GuidedDecodingParams(json=MySchema.model_json_schema()))
```
Constrained decoding masks invalid tokens, so the output *always* parses. If your task produces JSON, use this — it eliminates an entire class of retry logic and turns your schema-validity metric into a constant 100%.

### Throughput knobs worth knowing
- `gpu_memory_utilization` — how much VRAM vLLM claims for weights + KV cache. Higher = more concurrent sequences. 0.90 is a good default; lower it if something else shares the GPU.
- `max_model_len` — cap it at what you actually need. Every extra token of context reserves KV cache you could spend on batch size.
- `enable_prefix_caching` — free win whenever requests share a long prefix. Requires token-exact prefixes, so keep timestamps out of your system prompt.
- `max_num_seqs` — concurrency cap; trades latency for throughput.

## Gotchas
- vLLM pre-allocates most of the GPU at startup. Running it alongside training on the same GPU OOMs in a confusing way.
- vLLM's default sampling params differ from HF's. Pin temperature/top_p explicitly or your eval numbers shift when you switch runtimes.
- Adapter serving requires `max_lora_rank` to be at least your training rank — a mismatch fails at load with an unhelpful message.
- vLLM startup takes 30–90 seconds (weight load + CUDA graph capture). On serverless, that's cold-start latency you must design around — keep containers warm or accept it.
- Chat template: vLLM reads it from the tokenizer. If you fine-tuned with a modified template, save the tokenizer alongside the model or serving silently uses the wrong format.
- `enforce_eager=True` disables CUDA graphs — slower, but much faster to start and easier to debug. Useful while iterating.
