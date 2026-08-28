# The Hugging Face Ecosystem

## Summary
Hugging Face is the package manager, the registry, and the standard library of open ML. Knowing which library does what — and which are now legacy — saves you from following tutorials that were correct two years ago.

## Key Points

### The Hub
- **Models, datasets, and Spaces** — git repos with LFS, plus a metadata card.
- Everything is versioned by commit. `revision="a1b2c3d"` pins exactly; `main` moves under you.
- Local cache lives at `~/.cache/huggingface/hub` (override with `HF_HOME`). It grows fast — a handful of 7B models is 100+ GB.
- **Gated models** (Llama, Gemma) require accepting a licence on the website and authenticating with `hf auth login`.

### The libraries you will use
| Library | Role |
|---|---|
| `transformers` | model definitions, `AutoModel*`/`AutoTokenizer`, `generate()`, `Trainer` |
| `datasets` | Arrow-backed loading, `map`/`filter`, streaming, memory-mapped so bigger-than-RAM is fine |
| `tokenizers` | fast Rust BPE/WordPiece implementations (used under the hood) |
| `accelerate` | device placement, mixed precision, multi-GPU/FSDP — the layer `Trainer` sits on |
| `peft` | LoRA, QLoRA, and other adapter methods |
| `trl` | `SFTTrainer`, `DPOTrainer`, `GRPOTrainer` — post-training |
| `bitsandbytes` | 4-/8-bit quantization for training and inference |
| `huggingface_hub` | programmatic upload/download, the `hf` CLI |
| `evaluate` / `lighteval` | metrics and benchmark harnesses |

### The current training stack
For **instruction/chat fine-tuning**: `TRL SFTTrainer` + `PEFT LoraConfig`. This handles chat-template application, sequence packing, completion-only loss masking, and adapter setup — all the fiddly parts.

For **classification, regression, token tagging**: plain `transformers.Trainer` with an encoder model. Simpler, and the right tool. Don't reach for a generative model when a classifier will do.

Note the version coupling: `transformers` v5 requires `peft >= 0.18`. Version skew across these five packages is the most common source of inscrutable errors — pin them together in one requirements file.

### What's legacy — don't follow old tutorials into these
- `pipeline()` for anything beyond a first smoke test — fine to try a model, wrong for production.
- `Trainer` for chat fine-tuning — superseded by `SFTTrainer`.
- Manual `DataCollatorForLanguageModeling` masking gymnastics for SFT — TRL does it.
- `PPOTrainer` for alignment — use `DPOTrainer` or `GRPOTrainer`.
- Hand-rolled `.generate()` loops for serving — use vLLM or TGI.

### Reading a model card
Before downloading 30 GB, check: parameter count and precision, context length, base vs instruct, licence, chat template, and the tokenizer's vocab size. The "Files and versions" tab tells you the real download size — `config.json` tells you the truth when the card is vague.

### `hf` CLI essentials
```
hf auth login
hf download <repo_id> --local-dir ./model
hf upload <repo_id> ./local-folder
hf cache scan / hf cache delete
```
(The older `huggingface-cli` name still works but is deprecated in favour of `hf`.)

## Gotchas
- `trust_remote_code=True` executes arbitrary Python from the repo. Required for some architectures; read the code first on anything you don't recognise.
- The cache never garbage-collects itself. Budget disk, and run `hf cache scan` before wondering where 200 GB went.
- Downloads from a training job burn wall-clock you're paying for. On Modal, download once into a persistent Volume and mount it.
- Datasets on the Hub carry their own licences, often more restrictive than the models. Check before building anything you'll ship.
- Default `Trainer` arguments are not good defaults for LLMs — LR, warmup, and scheduler all need setting explicitly.
