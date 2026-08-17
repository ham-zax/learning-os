# Mixture of Experts

## Summary
MoE replaces the dense feed-forward network with many parallel "expert" FFNs and a router that sends each token to only a few of them. You get the knowledge capacity of a huge model at the inference compute of a small one — and pay for it in memory and engineering complexity.

## Key Points

### The mechanism
Replace one FFN with `E` expert FFNs plus a small router:
1. Router (a single linear layer) scores the token's hidden state against `E` experts.
2. Take the **top-k** experts (usually `k = 1, 2, or 8`).
3. Run only those experts; combine their outputs weighted by the router's softmax scores.

Routing is per **token** and per **layer** — the same sequence uses different experts at different positions and depths. There is no interpretable "this expert does maths"; specialisation is real but messy.

### Total vs active parameters
This distinction is the whole point and the main source of confusion:
- **Total parameters** — determines VRAM. All experts must be resident.
- **Active parameters** — determines FLOPs per token, and therefore latency and cost.

Mixtral 8x7B: ~47B total, ~13B active. It needs ~94 GB in bf16 to load, but generates at roughly the speed of a 13B model. DeepSeek-V3: 671B total, 37B active.

### Load balancing
Left alone, the router collapses — a few experts get everything, the rest get nothing and never train. Fixes:
- **Auxiliary load-balancing loss**: penalise uneven expert assignment. Standard since Switch Transformer, but it fights the main objective.
- **Expert capacity + token dropping**: cap tokens per expert; overflow tokens skip the layer via the residual. Efficient, slightly lossy.
- **Auxiliary-loss-free balancing** (DeepSeek-V3): per-expert bias terms adjusted during training to equalise load without perturbing the gradient. Now the preferred approach.

### Shared experts
DeepSeek-style designs keep 1–2 experts that *every* token uses, plus routed ones. The shared expert absorbs general-purpose computation, letting the routed experts specialise more sharply. Consistently better than pure routing.

### Why MoE won
Scaling laws say more parameters → lower loss. Dense scaling makes inference proportionally more expensive. MoE breaks that coupling: parameters (knowledge) scale while active compute (cost) stays flat. Nearly every frontier model is now believed to be MoE, and the strongest open models (DeepSeek, Qwen MoE, Mixtral, gpt-oss) are too.

### The costs
- **Memory**: you hold all the parameters even though you use a fraction. A 47B MoE needs more VRAM than a dense 34B while being weaker at knowledge-free reasoning.
- **Serving complexity**: expert-parallel sharding, all-to-all communication between GPUs, and load imbalance across a batch. Much harder than dense serving.
- **Fine-tuning instability**: routers can collapse during fine-tuning, and small datasets only exercise a subset of experts. LoRA on MoE typically targets attention and shared experts rather than routed ones.

## Gotchas
- Don't size a GPU from "active parameters" — that number is about speed, not memory. This mistake is extremely common.
- Batching behaves differently: a batch that all routes to one expert gives you no parallelism benefit. Throughput is more variable than dense models.
- Quantizing MoE is harder — router weights and expert distributions are sensitive, and naive 4-bit quantization damages routing more than it damages FFN weights.
- Fine-tuning a routed MoE on a narrow dataset can permanently unbalance the router. Freeze the router or use a very low LR on it.
- Benchmarks quoting "8x7B = 56B" are wrong; shared attention layers mean the real total is ~47B. Read the config, not the name.
