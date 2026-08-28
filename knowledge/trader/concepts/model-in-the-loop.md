---
id: model-in-the-loop
title: The Model in the Loop
difficulty: 3
prerequisites: [human-approval-gate, guardrails-and-authority]
tags: [judgment, llm]
---

## Summary

An LLM participates in exactly one seam of the decision path, and its only power is **subtraction**. `applyVetoes` returns a subset of its input, in input order — it cannot reorder, cannot score, cannot add. That constraint is enforced by the type system, not by a prompt: *"the dangerous direction is unreachable by TYPE… enforced by the compiler, not by this prompt and not by a reviewer's attention."* Around that seam sits an unusual amount of machinery: a hand-rolled schema validator, a receipt for every attempt including failures, and ADR-029's rule that a nondeterministic step is **recorded, not re-asked**.

## Key Points

- `ResearchVerdict` has `verdict: 'pass' | 'veto' | 'unavailable'` and a closed 7-item `DISQUALIFIERS` list. There is **no `direction`, no `size`, no `targetPrice`, no `confidence`** — an earlier revision had them and was reversed before code was written.
- The veto runs at **Phase B½** — *after* the deterministic score ordering, *before* sizing. Running it before ordering would let a veto reshuffle the queue.
- Transports: `cli` implemented, `fake` implemented, **`api` not implemented** and rejected by name in config with a pointer to TR-051.
- Three states, never two. `ClaudeClient` carries `configured: boolean`, and an unconfigured client answers every ask with *"no claude block is configured — this control is absent, not failing"* **without spawning anything**.
- **A refusal is a success.** Exit 0 does not mean the model agreed; a refusal arrives as `ok: true` with `verdict: 'declined'` *inside* the schema. There is no substring heuristic for refusals anywhere.
- **A transport failure removes candidates.** `unavailable` verdicts are dropped by `applyVetoes`, so an outage produces a quiet morning by design — G8's "a failed scan rather than a wrong one."
- Validation is **hand-rolled, not zod**, deliberately: a zod copy would be a second copy of the schema, drifting from the JSON Schema object actually sent. "The JSON Schema is the artifact."
- Prompts live in `prompts/<seam>.md` as committed files. *"A prompt is a strategy. Edit one line and different names get proposed."* An empty or missing prompt is a **refusal**, not a default.
- The tool policy is total: `--allowedTools ""` **and** `--tools ""` **and** `--max-turns 1` **and** `--permission-mode dontAsk`, with a `FORBIDDEN_FLAGS` list asserted on every call.
- **Precondition for everything below**: the seam runs only when `config.claude` is present. **Neither shipped config has a `claude` block**, so on `config.local.json` and `config.demo.json` the runner is never built, `researchVeto` is never passed, and the desk renders the veto as DID-NOT-RUN.

## Deep Dive

**The precedence inside `runVeto`,** which is where the safety actually lives:

1. deterministic flags (e.g. an operator blocklist) → `veto`, **model never consulted**
2. no model configured → `pass`, `abstained: false`, note "no veto model configured" — *unconfigured is not an outage*
3. model throws → `unavailable`, note = redacted error
4. model returns null → `pass`, `abstained: true` — "model abstained"
5. **kept disqualifiers empty, or no admissible evidence → downgraded to `pass`, `abstained: true`** — an unevidenced veto is "a model's opinion wearing a control's clothing"
6. otherwise → `veto`

Rule 5 has a consequence the file states plainly: **a model veto cannot currently bind.** Nothing on the live path supplies evidence, so every model veto downgrades to an abstention. The model's opinions accumulate in the ledger without binding anything — which is exactly the shape you want while a layer is being trusted.

`claude-veto.ts` says what binds today is "the operator blocklist, deterministic" plus the outage path. Check that yourself and you find the blocklist is *also* unwired: `ClaudeVetoDeps.blocklist` is optional, `main.ts` constructs the runner without it, and no config field supplies one. So on the live path **only the outage path binds**. Treat the source's own sentence as aspirational — and treat that as the lesson: even a file this carefully reasoned carries a claim about a control that is not connected. That is G8's shape, in the module that exists to enforce restraint.

And evidence may never come from the model: *"evidence supplied by the thing being evidenced is not evidence, and V3 exists precisely to stop a model manufacturing the grounds for its own veto."*

**`vetoLedger`** reports `{ seen, passed, vetoed, abstained, unavailable }` as a skip row, because *"a veto layer that never vetoes and one that vetoes everything both look like 'no problem' in a digest that reports only survivors."*

**ADR-029 — record, don't re-ask.** Every other input to a run is reproducible. A model asked at 09:00 and again at 09:04 can answer differently, so a re-run would produce **a different book from identical market data**, degrading ADR-020 from a guarantee about *decisions* to one about *order ids*.

The mechanism is a content key: `sha256` over `(asOf, seam, promptHash, schemaHash, inputDigest, model, effort, transport)`, with field *names* inside the hashed text so two same-shaped values cannot collide. If a judgement with that key exists, the transport is **not invoked**. `model`, `effort` and `transport` are in the key so that on API-switch morning you do not silently reuse judgements produced by a different stack under a different system prompt.

Its corollary is inherited from the NAV rule: the store *"may have GAPS and must never have FABRICATIONS."* A morning where the model did not answer is a morning with **no row** — failures go to the receipt file only, and a re-run must re-ask.

The cost: editing any file in `prompts/` changes `promptHash` and invalidates every judgement keyed on it. So prompts are edited at a session boundary, not at 08:59.

**Receipts.** Two append-only files. `claude-runs.jsonl` gets a receipt for **every attempt** — successes, failures, unconfigured refusals, missing prompts, and reuses. `judgements.jsonl` gets only successful, schema-validated judgements. A lost receipt is deliberately **not** a failed run: a full disk must not turn a completed judgement into a non-zero exit.

`npm run claude:cost` reports from the receipts and **excludes reused rows** — folding them in "would report a fortnight that got cheaper and faster every time somebody re-ran a morning, which is the flattering direction."

**A measured defect worth knowing.** On a live capture the payload reported `input_tokens: 2` for a **3,209-token prompt** — the rest sat in `cache_creation_input_tokens`. So the receipt sums all three, and keeps the cache split separate because a cache read bills roughly a tenth of a fresh token. Without the fix, a cost-cap decision would have been "wrong by three orders of magnitude, and wrong small."

**The system-prompt trap, measured not cited.** `--system-prompt` **replaces**; `--append-system-prompt` **adds** to Claude Code's own agentic system prompt. Identical prompt text produces different judgement on the two transports. Measured: 3,139 cache-creation tokens versus 7,021 — a 3,882-token delta that **doubles the cost per call**. Hence `--append-system-prompt` is in `FORBIDDEN_FLAGS`.

**Other hardening worth internalising:** the user prompt goes on **stdin**, never argv, because argv is world-readable through `ps`. `CLAUDE_CODE_RETRY_WATCHDOG` is deleted from the child's environment because it retries indefinitely — "a warning in a ticket does not survive a `.zshrc` edit; deleting the variable does." And `createCliTransport` **throws** under vitest: *no test may reach the network*.

**The watchdog's view of it.** Because a receipt is written on every attempt, a configured seam that ran at all leaves a row even when the model refused or timed out — **the receipt is proof of life**. Zero rows means the process never reached the transport. Both Claude alerts are **warnings, never criticals**, deliberately: the model is advisory, and raising it to a critical would put its availability on the same channel as a book mismatch. The reasoning in `assess.ts` is that *"two alerts for one root cause is how a channel loses its signal"* and *"an alarm that fires every morning of a fortnight's build-up is an alarm that gets muted before the morning it is right."*

**The governance ceiling.** ADR-028 is **reserved and deliberately empty**, status "the owner's to write, not the agent's." It would be needed to overrule the ratified clause *"LLM's pool role = adjacency scout proposing additions at reviews, never trading."* **TR-051 — the API transport and the `propose` seam — stays blocked until ADR-028 exists.** Nothing shipped so far requires it, because none of it lets a model originate a bet.

## Practice Questions

- The model returns a verdict recommending a 3% position in NVDA. What happens, and at which layer is that prevented?
- The Claude CLI times out mid-run. What happens to the candidate list, and why is that the chosen behaviour?
- Why is a `declined` verdict returned as a *success* rather than a failure?
- Explain ADR-029 in one sentence, then explain what it costs you when you edit a prompt file.
- ADR-028 is empty. What does that block, and why is writing it not the agent's job?

## Common Misconceptions

- "The LLM picks trades." → It can only remove candidates from a list a deterministic rule produced, and today its vetoes downgrade to abstentions for lack of evidence.
- "The veto layer runs on every scan." → It runs only when `config.claude` exists. Neither shipped config has one, so on both of them the seam is present and inert.
- "An LLM failure means the run is wrong." → It means the run is *quiet*. Unavailable candidates are dropped: a failed scan rather than a wrong one.
- "Not configured and unavailable are both 'the model didn't help'." → They are opposite claims, and the repo has paid for the distinction four separate times.
- "Re-running a morning is harmless." → Without ADR-029 it would produce a different book from identical market data.
- "Prompts are configuration." → They are strategy, committed as code, hashed, and part of the reuse key.
- "The model can browse for news." → It has no tools at all. The inbox seam is inert precisely because a toolless model correctly declined rather than fabricating — and granting web access is a real relaxation of a safety control, escalated to the owner rather than fixed.

## References

- `src/adapters/claude/` — `types.ts` (the contract), `schema.ts` (why not zod), `cli.ts` (flags, timeouts, redaction)
- `src/research/index.ts` — `runVeto`, `applyVetoes`, `DISQUALIFIERS`, `vetoLedger`
- `src/research/claude-veto.ts` — the adapter and the "unreachable by type" argument
- `src/records/judge.ts`, `src/records/judgements.ts` — receipts and the ADR-029 key
- `src/watchdog/assess.ts` — `claudeAlerts` and the proof-of-life reasoning
- `DECISIONS.md` ADR-006, ADR-028 (open), ADR-029; `docs/information-architecture.md` §6
