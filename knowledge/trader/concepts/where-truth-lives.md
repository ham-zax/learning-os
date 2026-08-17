---
id: where-truth-lives
title: Where the Truth Lives
difficulty: 1
prerequisites: [what-trader-is]
tags: [foundation, doctrine, navigation]
---

## Summary

This repo has more prose than code, and the prose is not all equal. Some of it is **binding** — it constrains what the code may do and wins any disagreement. Some of it is **narrative** — it explains the thinking and can be stale. A newcomer who cannot tell which is which will confidently cite a document that was superseded three sessions ago. `docs/README.md` states the rule: *"The strategy documents explain why. The binding records are elsewhere, and they are the ones to trust when the two disagree."*

## Key Points

- **BINDING**: `DECISIONS.md` (ADRs + session decision logs), `docs/guardrails.md`, `.trader/constitution.yml`, `.trader/specs/`, `.trader/issues/`.
- **OPERATIONAL TRUTH**: `STATUS.md` and `NEXT-SESSION.md`. What actually works right now, and where to resume.
- **NARRATIVE**: everything else in `docs/` — the framework, the information architecture, the playbook, the ownership contract, the runbook.
- **DATED EVIDENCE**: `docs/reports/`. "Evidence, not decisions. Cite them; do not treat them as current — a report records what was believed on its date."
- Known gaps live in `.trader/issues/` *deliberately*, so they cannot be forgotten. If something is broken and acknowledged, there is a TR ticket for it.
- Every module rule carries a stable id — `N1`, `V3`, `P2`, `E13`, `S7`, `M4` — cited in test names ("so a failing test names the rule it defends") and in `JournalEntry.ruleRefs` ("so a trading decision names the rules that produced it").
- ADRs and session decision logs are two different formats with the *same* authority. Session entries look like: `**decision** — decided-by: owner|agent · confidence: N · why: … · revert: …`
- Three known drifts to carry: `docs/README.md` says ADRs run to 013 (they run to 029); `docs/README.md` says *"The system cannot trade yet"* and `docs/manual-playbook.md` says *"The software cannot trade"* (both stale — it has been placing paper orders since session 6); `docs/README.md` opens with "Nine documents" while its own index points to more than that.

## Deep Dive

**The trust map**, condensed from `docs/README.md`:

| You want to know | Read | Status |
|---|---|---|
| Why the code looks like this | `DECISIONS.md` | BINDING |
| A rule that may never be violated | `docs/guardrails.md` | BINDING |
| The workflow state machine | `.trader/constitution.yml` | BINDING (machine-readable) |
| What a module must do, criterion by criterion | `.trader/specs/SPEC-NNN.md` | BINDING |
| The work ledger and known gaps | `.trader/issues/` + `index.json` | BINDING |
| What works today | `STATUS.md`, `NEXT-SESSION.md` | operational |
| The thesis and economics | `docs/investment-framework.md` | narrative |
| Who owns what | `docs/ownership-contract.md` | working agreement |
| Evidence for a claim | `docs/reports/*` | dated evidence |
| Vocabulary | `CONTEXT.md` | reference |

**Reading order for a new member** (per `docs/README.md`, "about twenty minutes"): `guardrails.md` → `investment-framework.md` → `information-architecture.md` → `manual-playbook.md`. Then `paper-trial-runbook.md` when you want to actually run it. But read `STATUS.md` **first**, before any of them, so you know which claims in those documents are still live.

**Specs carry their own history.** A spec's revision log at the bottom records what each review round caught. SPEC-002 reached rev 8 through five review rounds; SPEC-018 is at rev 8 and SPEC-022 at rev 5. Reading the revision history of a spec is often faster than reading the spec, because it tells you which rules were *hard* — and those are the ones that will bite you.

**Two conflicts you will hit, and how to resolve them.** Binding records win, always:

1. `docs/investment-framework.md` §4 says "~60–70% beta core, ~30–40% alpha sleeve." **ADR-023** (owner-ratified, 2026-08-13) supersedes it with a five-bucket policy. Use ADR-023.
2. `docs/investment-framework.md` commits to "US and HK in parallel," and ADR-014 exists to permit a mixed-currency book. But the Session 7 owner decision froze instrument scope to **US stocks and ETFs with HK deferred**, and `NEXT-SESSION.md` records "HK is not tradeable at all — sizing has no board-lot rounding. US only."

**Drift runs in both directions, and this is the part people get wrong.** `STATUS.md` and `NEXT-SESSION.md` outrank `docs/`, but they are written session by session and individual lines age too — sometimes within the same session:

- `STATUS.md` says "no judgement is wired into the scan." `src/cli/main.ts` builds the veto runner and passes `researchVeto` into `runOnce`. The line was overtaken by TR-048a.
- `NEXT-SESSION.md` says the sleeve "sizes off whole-account equity, five times its ratified budget." Session 9 wired `sleeveBudget` and both shipped configs carry an `allocation` block. What actually remains open is narrower: the fractional-order decision, and four of fourteen proposals landing as 1–2 share positions.

So the hierarchy has three tiers, not two: **source beats operational status beats narrative docs.** When a status line and the code disagree, read the code.

**Why the drift is tolerated rather than chased.** Because `docs/` is explicitly *not* the source of truth, a stale sentence there is a documentation bug, not a system bug. The mechanism that prevents stale prose from becoming a stale *rule* is §4c of the SDD workflow: every normative sentence must get a numbered criterion in the same edit. Prose with no criterion behind it is not a rule at all — it is commentary, and the repo has a four-for-four record of such prose shipping broken.

## Practice Questions

- `docs/investment-framework.md` and ADR-023 disagree about the allocation. Which one governs, and how did you decide?
- Someone tells you "the system can't trade yet — it says so in the docs." How do you check?
- You find a guard clause in the code and want to know whether it is load-bearing. Where do you look, and what specifically are you looking for?
- What is the difference in authority between an ADR and a session decision log entry?
- Where would you find the list of things the team knows are broken but has not fixed?

## Common Misconceptions

- "The docs folder is the documentation." → It is the *narrative*. The binding records are `DECISIONS.md`, `guardrails.md`, `.trader/`.
- "A report in `docs/reports/` states current fact." → It states what was believed on its date. Cite it; do not treat it as current.
- "If it isn't in a spec it isn't a rule." → Partly true, and that is the point: prose without a numbered criterion has shipped broken four times out of four. But `guardrails.md` and `DECISIONS.md` are binding regardless.
- "STATUS.md is a changelog." → It is the operational source of truth and overrides the narrative docs on what currently works — but it is not infallible. Two of its lines were overtaken by code in the same session they were written. Source beats status beats docs.
- "ADRs are historical." → No ADR in this repo carries the status Superseded. They are live constraints; ADR-028 is deliberately empty and *blocks* work until someone writes it.

## References

- `docs/README.md` — the trust map and the reading order
- `DECISIONS.md` — 29 ADR numbers, 28 written, plus the session decision logs
- `docs/sdd-workflow.md` §6 — rule-citation convention (`ruleRefs`, test names)
- `STATUS.md` / `NEXT-SESSION.md` — current state and resume point
- `.trader/issues/index.json` — the work ledger and the known-gaps list
