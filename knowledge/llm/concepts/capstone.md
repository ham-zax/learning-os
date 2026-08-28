# Capstone: Ship a Fine-tuned Model That Solves a Real Problem

## Summary
Everything before this is preparation. The capstone is one end-to-end project: define a task you actually have, build the data, establish baselines, fine-tune, evaluate honestly, deploy on Modal, and wire it into something you use. The point is not the model — it's owning every stage of the loop.

## Key Points

### Choosing the problem
It must satisfy four things, or you'll stall:
1. **You have or can get the input data** (a few hundred examples is enough).
2. **The output has a checkable contract** — a label, a schema, a score. Not "write something nice".
3. **You will actually use the result**, so quality failures are visible to you.
4. **A frontier model can produce good labels for it**, so you can bootstrap the dataset by distillation.

**Recommended project — JD → structured skill extraction, feeding `job-hunter` and `tutor gaps`.**
Input: a job description. Output: strict JSON — required skills, nice-to-haves, seniority, years of experience, tech stack. This closes a real loop you already have: extracted skills → `tutor gaps` → study plan. It is a fixed schema (checkable), it's high-volume (worth automating), and a strong model can label it well.

Alternative if you'd rather work on feeds: **ai-feeds relevance triage** — classify each incoming item as `must-read / skim / skip` for your interests, with a one-line justification. Same shape, different data.

### The eight stages

**1. Contract (day 1, no code)**
Write the JSON schema and 10 examples by hand. Decide what "correct" means for each field. This is the eval spec.

**2. Data (the longest stage)**
- Collect 300–600 raw job descriptions.
- Label with a strong API model against your schema, using constrained/JSON-mode output.
- **Review 100 by hand.** Fix the ones that are wrong. Note the failure patterns — these become instructions in your system prompt.
- Split by source posting, not by row: 70% train / 15% dev / 15% test. Freeze the test set.

**3. Baselines (before any training)**
- Regex/keyword extraction against a skill list → your floor.
- Zero-shot prompt to a small local model (Qwen2.5-1.5B-Instruct) → the thing to beat.
- Few-shot prompt to the same model → often surprisingly close to a fine-tune.

**4. Encoder baseline (T4, minutes, ~$0.05)**
Reframe the checkable part as classification — seniority level, or per-skill presence as multi-label. Fine-tune ModernBERT. If this hits your quality bar, you may be done, and you'll have learned that lesson cheaply.

**5. LoRA SFT (A100-40GB, 1–2 h, ~$2–4)**
Qwen2.5-7B-Instruct, QLoRA `r=16`, 3 epochs, TRL `SFTTrainer` with your `messages`-format data. Smoke-test 20 steps on a T4 first. Commit checkpoints to a Modal Volume.

**6. Evaluate (offline batch with vLLM, minutes)**
Report on the frozen test set: schema-validity rate, per-field precision/recall, and the comparison table against all baselines. Read the 20 worst failures by hand and categorise them.

**7. Deploy (L4, scale-to-zero)**
Merge the adapter (or serve it), stand up vLLM behind a Modal ASGI endpoint with guided JSON decoding. Confirm the output *always* parses.

**8. Integrate and use it**
Point `job-hunter` at the endpoint. Feed the extracted skills into `tutor gaps`. Use it for two weeks and log where it's wrong — that log is your v2 dataset.

### Budget for the whole capstone
| Stage | GPU | Est. cost |
|---|---|---|
| Local dev + smoke tests | T4 | ~$1 |
| Encoder baseline | T4 | ~$0.20 |
| 3× LoRA SFT runs | A100-40GB | ~$8 |
| Eval batches | L4 | ~$1 |
| Deployed endpoint (light use) | L4, scale to zero | ~$2 |
| **Total** | | **~$12** |

Under half of one month's Modal credits, with room for a second iteration.

### What "done" means
A committed repo containing: the schema, the dataset build script, `train.py`, `eval.py`, the results table with baselines, the Modal deploy script, and a README stating what the model does and where it fails. If a stranger can reproduce your number from that repo, you've learned the thing.

## Gotchas
- **Do not skip the baselines.** The most common outcome of a first capstone is discovering a few-shot prompt matched the fine-tune — that's a real result, and finding it after the fine-tune wastes a week.
- Labels from a strong model inherit its biases and errors. The hand-review of 100 is not optional.
- Scope creep kills capstones. One task, one schema, one model. No RAG, no agents, no multi-turn until v2.
- Don't fine-tune to fix a prompt problem. Try three prompt variants first; they're free.
- Freeze the test set on day one. Every look at it costs you a little honesty.
- If your fine-tune barely beats few-shot, the likely cause is dataset size or label inconsistency — not hyperparameters. Go back to stage 2 before touching `r` or the learning rate.
