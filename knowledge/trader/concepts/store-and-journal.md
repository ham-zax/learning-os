---
id: store-and-journal
title: The Store and the Approval Journal
difficulty: 2
prerequisites: [human-approval-gate]
tags: [mechanics, state, audit]
---

## Summary

Two persistence mechanisms with different jobs. The **store** (`state/positions.json`) holds what the system owns — open positions, pending entries, latched risk state — and is protected by a lock, a generation counter and an atomic write. The **journal** (`state/approvals.jsonl`) is a hash-chained, append-only record of every human decision, and its guarantee is tamper-evidence, *not* idempotency. Confusing the two is common: the journal does not prevent double orders; four other mechanisms do.

## Key Points

- `StoreDocument` = `{ schema, generation, writtenAtRunId, openPositions, pendingEntries, risk? }`. `STORE_SCHEMA = 2`; a newer schema is refused, never partially read.
- **S1: a load failure aborts.** It never yields an empty book. The only path producing an empty book is `positions.json` absent **and** `positions.json.prev` absent.
- Atomic write: temp file in the *same directory*, then `renameSync`. One previous generation is retained as `.prev`. The honest limit (no directory fsync) is stated in the file rather than hidden.
- `acquireLock` uses `openSync(path, 'wx')` — atomic — and records the holder pid. A stale lock (dead pid) is broken and retried once. The residual break-race is named and accepted because the generation check is the backstop.
- **S7 stale-generation is checked twice**: against the caller's expectation *and* against a fresh re-read of what is on disk now.
- The risk block is re-validated as strictly as a position. A malformed peak would make `NaN <= -halt` false and silently disarm the breaker; a halt that fails to load must not evaporate into "not halted."
- The journal is a **sha256 hash chain**: `hash = sha256(prevHash + canonicalJson(row))`, genesis prev-hash is 64 zeros. `canonicalJson` sorts keys recursively, so the hash is stable under key order — and covers whatever fields the row actually carries.
- `appendDecisions` validates **all-or-nothing before any I/O**, and refuses to append onto a chain it cannot vouch for. The only filesystem write in the module is `appendFileSync`. "The worst this code can do to history is fail to add to it."
- A journal write failure is written to stderr and is **not fatal** — the orders are already at the broker, and pretending the submission failed would invite a re-submit.

## Deep Dive

**What lives under `state/`:**

| Path | Written by |
|---|---|
| `positions.json` | `saveStore` |
| `positions.json.prev` | `saveStore` — one retained generation |
| `positions.json.lock` | `acquireLock` — contains the holder pid |
| `approvals.jsonl` | `appendDecisions` (hash-chained) |
| `runs.jsonl` | every run, via `recordRun` |
| `nav.jsonl`, `universe-log.jsonl` | `npm run nav`, once per session |
| `ideas.jsonl` | the desk's idea log |
| `inbox/` | an external producer; the desk is **read-only** over it |
| `reports/desk.json`, `reports/approve-*.html` | the desk and the report writer |

**The four de-duplication mechanisms** (the journal is not one of them):

1. **`clientOrderId`** — entry `${asOf}:${symbol}`, exit `${positionId}:exit:${decisionDate}`. Session-stable, so a re-run cannot double-submit at the broker.
2. **E13 (ADR-020)** — `heldSymbols` → `already-held`, `pendingSymbols` → `entry-outstanding`. Both sets built **after** Phase 0 reconciliation.
3. **The store generation counter (S7)** — refuses a non-advancing write.
4. **The lock** — prevents the lost update the generation counter can only *detect*.

The E13 comment is the best teaching text in the repo on this: broker de-duplication saved the *account* but not the *store*. Three runs in one session produced **39 pending entries against 13 broker orders**, each reconciling against the same fill. Every one of 760 tests passed while it was happening.

**The approval row.** `ApprovalRow` = `{ seq, recordedAt, asOf, positionId, symbol, kind, reason, quality, decidedBy, contextHash, unreadInbox?, veto?, prevHash, hash }`.

- `kind` is `approved | rejected | machine-skip`; `decidedBy` is `human | machine`.
- **`positionId` is the join key, never symbol** — a re-entry is a different decision.
- `contextHash` is `sha256` of the desk JSON the operator was actually looking at. The row ties to those exact bytes.
- `NewApprovalRow` omits `seq`, `recordedAt`, `prevHash`, `hash` — a caller that could supply those four could mint its own idea of "next in the chain."
- Optional fields are **never defaulted**: absent `unreadInbox` means the column did not exist for this row; `0` means checked and none unread. This is load-bearing — a field dropped on read-back recomputes to a different hash and reports a tampered row nobody touched.

**Validation rules for a new row.** Non-empty `reason` for every kind; a **human `approved` row demands quality 1–5**; a **machine row must carry `quality: null`**; non-empty `positionId`, `symbol`, `asOf`. One invalid row means nothing is written.

**Absent vs unreachable, again.** The store's three-state `Probe` (see `fail-closed`) is the model. Note the honest observation: `readJournal` still uses `existsSync`, the exact pattern removed from the store. An `EACCES` on `approvals.jsonl` would return "no rows" and the next append would re-base onto the genesis hash at `seq: 1`. The store's vocabulary was never applied to the journal.

**Acknowledging a halt is a restart, not an override.** `acknowledgeHalt` requires a note (empty → `no-reason`), takes the lock, writes `acknowledgedAt` at `generation + 1`, and carries everything else through. `advanceRiskState` then **re-arms on the next run** if the drawdown still exceeds the threshold. The worst case is one session of entries at a drawdown the operator has looked at and accepted.

**Exactly one machine may hold a store for one account (ADR-026).** Two checkouts each with a `state/positions.json` are "two books that both believe they are authoritative, and the failure is silent." The generation counter *detects* a lost update but cannot merge two divergent books.

## Practice Questions

- The desk submits the same batch twice by accident. Trace what stops a duplicate order — and say which mechanism catches it first.
- `positions.json` is missing but `positions.json.prev` exists. What does `loadStore` return? Why isn't that a fresh start?
- Why does the journal hash cover the *optional* fields, and what breaks if a reader silently drops one?
- Two developers each run a scan from their own checkout against the same account. What goes wrong, and which control detects it?
- A journal append fails after orders reached the broker. What does the code do, and what would be worse?

## Common Misconceptions

- "The journal prevents duplicate orders." → It has no duplicate detection at all. Two submits append two valid sets of rows.
- "A missing state file means first run." → Only if `.prev` is also missing. Otherwise it is a lost store and the run aborts.
- "The lock makes the generation counter unnecessary." → The lock has a documented break-race; the generation check is the backstop that survives it.
- "Acknowledging the drawdown halt disables it." → It restarts it. If the drawdown persists, it re-arms next run.
- "Only decided names get journalled." → Every proposal on the desk gets a row. An undecided name is journalled as rejected with reason "no decision recorded."
- "`saveStore` failing means the write is safe to retry blindly." → Its failure code is `unreadable` even for a write failure — a known name/meaning mismatch worth checking before you trust the code.

## References

- `src/store/index.ts` — `Probe`, `loadStore`, `saveStore`, `acquireLock`, `advanceRiskState`, `acknowledgeHalt`
- `src/approval/journal.ts` — `verifyChain`, `readJournal`, `appendDecisions`, `canonicalJson`
- `src/approval/types.ts` — `ApprovalRow`, `NewApprovalRow`, `noBetRow`
- `DECISIONS.md` ADR-020 (E13), ADR-021 (E14), ADR-026 (one machine, one store)
