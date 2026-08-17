# Hands-on: Running Training Jobs on Modal

## Summary
Modal runs Python functions on rented GPUs, billed per second with no idle charge. The Starter plan's **$30/month of free credits** is generous for learning: roughly 50 T4-hours, 14 A100-40GB-hours, or 7.6 H100-hours per month.

## Key Points

### The pricing you're working against
| GPU | $/sec | $/hr | Hours in $30 |
|---|---|---|---|
| T4 | 0.000164 | $0.59 | ~51 |
| L4 | 0.000222 | $0.80 | ~37 |
| A10 | 0.000306 | $1.10 | ~27 |
| A100-40GB | 0.000583 | $2.10 | ~14 |
| A100-80GB | 0.000694 | $2.50 | ~12 |
| H100 | 0.001097 | $3.95 | ~7.6 |

Plus CPU ($0.0000131/core/sec) and memory ($0.00000222/GiB/sec), which are rounding errors next to GPU time. Volumes: $0.09/GiB/month with 1 TiB free. Starter limits: 10 concurrent GPUs, 100 containers, 3 seats.

**Credits do not roll over.** Unused budget is lost at month end — which argues for a steady weekly cadence rather than one big month.

### The shape of a Modal script
```python
import modal

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("torch", "transformers", "trl", "peft",
                 "bitsandbytes", "datasets", "accelerate")
)
vol = modal.Volume.from_name("llm-training", create_if_missing=True)
app = modal.App("llm-course", image=image)

@app.function(
    gpu="A100-40GB",
    volumes={"/vol": vol},
    timeout=60 * 60 * 3,
    secrets=[modal.Secret.from_name("huggingface")],
)
def train():
    import os
    os.environ["HF_HOME"] = "/vol/hf"       # cache models on the Volume, not the container
    ...                                      # the SFT script from hf-sft-lora
    vol.commit()                             # persist checkpoints before the container dies

@app.local_entrypoint()
def main():
    train.remote()
```
Run with `modal run train.py`. Modal builds the image once, caches it, and only bills while the function executes.

### The cost discipline that makes $30 last
1. **Debug locally on a 0.5B model.** Get the script correct on CPU/MPS with 50 examples. Never debug on a rented GPU — a crash 30 seconds into an A100 job costs the same as a crash 30 seconds into a T4 job, but the twentieth one adds up.
2. **Smoke-test on the cheapest GPU that fits.** `gpu="T4"`, `max_steps=20`. Confirms CUDA, image, data paths, and checkpoint writing.
3. **Cache aggressively on a Volume.** `HF_HOME=/vol/hf` means you download an 8B model once, not every run. A 16 GB download at A100 rates is real money.
4. **Set `timeout` deliberately.** A hung job left overnight is how you burn a month's credits in one night. Set it to 1.5× your expected runtime.
5. **`vol.commit()` after every checkpoint.** Containers are ephemeral; anything not on a Volume vanishes.
6. **Prefer fewer, longer runs.** Container cold start (image pull, model load) is billed. Ten 5-minute runs waste more on startup than one 50-minute run.
7. **Watch the dashboard.** Modal shows per-function spend; check it after each session rather than at month end.

### What $30/month actually buys you
Concretely, per month:
- ~50 encoder-classifier fine-tunes on T4 (minutes each, cents each)
- ~7–10 full QLoRA fine-tunes of a 7–8B model (1–2 h each on A100-40GB, ~$2–4 each)
- Plus offline batch inference for evaluation, which is fast and cheap
- Plus dozens of smoke tests

That is comfortably more than a disciplined learner gets through in a month. **The budget is not your constraint — your time is.**

### What it does not buy
Pretraining from scratch (thousands of GPU-hours), full fine-tuning of anything above ~1B, a persistently warm inference endpoint (idle containers still bill during their keep-warm window), or long unattended hyperparameter sweeps. If you want an always-on demo, serve a small model and accept cold starts, or scale to zero.

### Serving on Modal
```python
@app.function(gpu="L4", scaledown_window=300)
@modal.asgi_app()
def serve(): ...   # a FastAPI app wrapping vLLM
```
`scaledown_window` controls how long an idle container stays warm. Long = fast responses, real cost. Short = cheap, 30–90 s cold starts while vLLM loads. For a learning project, short.

## Gotchas
- Non-preemptible execution and some region pinning multiply the base rate (up to 3×). Leave the defaults alone unless you know why you're changing them.
- Anything written outside a Volume is lost when the container exits. This includes your checkpoints, and people learn it the expensive way.
- `modal run` streams logs but the job dies if you Ctrl-C. Use `modal run --detach` for long training runs.
- Image builds are billed as CPU time and can take minutes. Pin your dependency list and stop editing it mid-session.
- The free credits are per calendar month and don't accumulate. Budget a weekly rhythm.
- A GPU that's too small doesn't fail fast — with `device_map="auto"` it offloads to CPU and runs 100× slower while billing GPU rates. Assert `torch.cuda.is_available()` and check `hf_device_map` at the top of the job.
