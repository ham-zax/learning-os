---
id: the-quality-gap
title: The Quality Gap — succeeded Means the Handler Returned
difficulty: 5
prerequisites: [taint-and-quarantine, metering-and-budget]
tags: [mastery, judgment, open-problems]
---

## Summary
Foundry meters what a run **cost** and records what it **did**. Nothing measures whether it was any **good**. `succeeded` means the handler returned — a self-report. Two open tickets name the consequence: FDY-186 (nothing verifies a tailored application is *true*) and FDY-187 (no output-quality assurance at all).

## Key Points
- **FDY-186** — verified 2026-08-16, a repo-wide search for `grounding|hallucin|citation|verifyClaims` across `apps/`, `services/` and `packages/` returns **zero hits**.
- ADR-0018 stops a hostile posting **moving the model**; nothing stops the model **inventing the applicant**.
- **The approval gate is not the control it looks like.** It defeats unauthorised *sending*, not fluent wrongness — and a human skimming well-written prose about their own career does not reliably catch a drifted year.
- **FDY-187** — `succeeded` means the handler returned. Five of seven portfolio candidate repos each built a private version of quality assurance because the platform offers none.
- The ground truth is already being **discarded**: ADR-0037 puts a human decision on every single send, and that decision is not captured as a quality signal.
- The **`green` queue is a risk pool, not a done pile** — every independent review so far found something real.

## Deep Dive
This is the sharpest open problem in the repo, and it is a good final concept because it tests whether you have understood the earlier ones as *specific* rather than general safety.

ADR-0018 is a genuinely strong control with a precisely scoped guarantee: an injected instruction cannot reach tools or take effects. It says nothing about whether the model's output is **true**. Those are different failure modes — hijacking versus confabulation — and the containment model only addresses the first. Assuming otherwise is the exact mistake the `layer-check` finding warned about: a gate proves what it checks, not what you hoped it meant.

The observation about the approval gate is subtler and worth sitting with. Approval looks like a quality control — a human sees the output before it goes. But it defeats *unauthorised sending*, not *fluent wrongness*, and the two require different attention from the reviewer. A person skimming a well-written paragraph about their own career will catch "I never worked there" and miss "2019" where it should say 2021.

The systemic argument in FDY-187 connects to ADR-0007. That ADR warns that self-evolution built on incomplete history is "built on sand." A complete record with **no quality measure** is that same problem one level up: you know exactly what happened and what it cost, and nothing about whether it was worth doing. And the irony is that the ground truth already exists — ADR-0037's assisted-submission model puts a human decision on every send, and that signal is being thrown away.

One contestable claim, flagged as such in the source: the readiness analysis puts FDY-186 ahead of gathering real postings, on the grounds that a fabricated claim sent to a real employer is unrecoverable while a thin corpus only costs matches.

## Practice Questions
1. What does `succeeded` actually mean, and why is that a problem?
2. ADR-0018 is a strong control. Name precisely what it guarantees and what it does not.
3. Why is the approval gate weaker than it looks against hallucination?
4. How does FDY-187 connect to ADR-0007's "built on sand" argument?
5. Where is quality ground truth already being generated and discarded?
6. What is the one contestable prioritisation claim, and what is the argument for it?

## Common Misconceptions
- "Prompt-injection containment covers hallucination" → Different failure modes. Containment stops hijacking, not confabulation.
- "Human approval catches bad output" → It catches unauthorised sending. Fluent wrongness survives a skim.
- "A complete audit trail means the system is governable" → Complete history with no quality measure is 'built on sand' one level up.
- "Tickets at `green` are done" → The `green` queue is a risk pool; every independent review so far found something real.

## References
- `STATUS.md` — "The output is not checked by anything"
- `docs/research/app-production-readiness-2026-08-16.md`
- `docs/adr/0018-prompt-injection-containment.md`, `0037-assisted-submission-is-the-v1-last-mile.md`, `0007-audit-and-unit-of-work.md`
