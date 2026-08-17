# Breakthrough: The Open-Weights Era (2023-2025)

## Summary
Meta's release of Llama, followed by Mistral, Qwen, Gemma, and DeepSeek, put frontier-adjacent models on consumer hardware. This is the breakthrough that makes everything in the hands-on half of this topic possible — without it, "fine-tune a model on your own problem" would not be a thing an individual could do.

## Key Points

### The timeline that matters
- **Llama 1 (Feb 2023)** — 7B/13B/33B/65B, research licence, weights leaked within a week. Chinchilla-informed: heavily trained small models. The 7B ran on a laptop. Within a month: llama.cpp, Alpaca, LoRA fine-tunes, an entire ecosystem.
- **Llama 2 (Jul 2023)** — commercially usable licence, chat variants with a documented RLHF pipeline. Legitimised open weights for business use.
- **Mistral 7B (Sep 2023)** — Apache 2.0, beat Llama-2-13B. Proved a small European lab could compete, and that *training quality* beat parameter count.
- **Mixtral 8x7B (Dec 2023)** — first strong open MoE. Brought MoE from rumour to reproducible.
- **Llama 3 / 3.1 (2024)** — 8B trained on 15T tokens, 405B at near-frontier quality, 128k context. Deliberate massive overtraining for inference efficiency.
- **Qwen 2.5 / 3 (2024–2025)** — Alibaba's series became the default fine-tuning base for many: strong multilingual, dense sizes from 0.5B to 72B, permissive licences, excellent small models.
- **DeepSeek-V3 / R1 (Dec 2024 – Jan 2025)** — 671B MoE (37B active) at frontier quality for a reported ~$5.6M training run, then R1 open-sourcing a reasoning model *and its distillations*. The strongest evidence yet that the capability gap is measured in months.
- **Gemma 2/3, Phi, SmolLM, gpt-oss (2024–2026)** — a healthy small-model tier: 1B–4B models good enough for real tasks on a single consumer GPU.

### Why this changed what an individual can do
1. **Fine-tuning became accessible.** LoRA on a 7B model fits in 16 GB. A useful domain fine-tune costs a few dollars of GPU time.
2. **Inference became free at the margin.** llama.cpp, Ollama, and quantization put a 7B model on a laptop with no API bill and no data leaving the machine.
3. **Research became reproducible.** You can inspect weights, ablate components, and probe internals. Mechanistic interpretability as a field depends on this.
4. **Privacy and control.** Regulated and sensitive workloads can run on-premise.

### Licences — read them
"Open weights" is not "open source". Practical categories:
- **Apache 2.0 / MIT** (Mistral, Qwen, DeepSeek, OLMo, gpt-oss) — genuinely permissive.
- **Custom community licences** (Llama, Gemma) — free below a user threshold, with use restrictions and naming requirements. Fine for personal projects; check before commercial deployment.
- **Non-commercial / research-only** — appears on some models and on many *datasets*. Dataset licences trip people up more often than model licences.

### What "open" still doesn't include
Training data is almost never released, nor is the training code, nor the data-mixing recipe. OLMo and a few others are genuinely fully open; most releases are weights plus a paper. The distinction matters for reproducibility claims.

### Choosing a base model in practice
- **Size first, from your VRAM budget** — see the memory-math concept.
- **Base vs Instruct**: fine-tune the *instruct* variant if you want to keep general chat ability; fine-tune the *base* if your task is narrow and you're supplying enough data to teach the format.
- **Check the tokenizer and chat template** — these determine your data preparation more than anything else.
- **Prefer models with an active fine-tuning community** — Qwen and Llama have the most worked examples, which is worth more than a small benchmark edge when you're learning.

## Gotchas
- Benchmark leaderboards are contaminated and gamed. Prefer your own task-specific eval and community reports over MMLU deltas.
- The "-Instruct" suffix matters enormously. Fine-tuning a base model with an instruct model's chat template produces confusing failures.
- Model cards understate context limitations. A 128k-context model may perform poorly past 32k on your task; test it.
- Some "open" releases quietly ship different weights than the paper evaluates. Pin the exact revision hash on the Hub when reproducibility matters.
