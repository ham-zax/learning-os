---
id: change-lanes
title: Change Lanes and the Ambiguity Rule
difficulty: 4
prerequisites: [spec-altitudes]
tags: [workflow, governance, judgment]
---

## Summary
Not every unspecified question deserves the same response. ADR-0023 separates change lanes, and the **ambiguity rule** gives the default: resolve it the obvious way, **amend the techspec in the same commit**, and flag the call in your session report for the founder's veto. The exception is a framework-level question — a package boundary, an ADR's premise, the platform's own contracts — which is **Lane 3**: stop, write an options dossier, let the founder decide.

## Key Points
- Ambiguity rule (founder, 2026-08-03): resolve obviously → amend techspec **in the same commit** → flag for veto. **Do not silently guess, and do not stop and wait for what is usually a naming-level call.**
- **Lane 3 exception:** if the ambiguity touches a package boundary, an ADR's premise, or the platform's own contracts — **stop**, write the options dossier, let the founder decide.
- **Discovering mid-ticket that you need a framework change is evidence for the dossier, never licence to proceed.**
- ADR-0023's lanes: a user data lane, an app-code lane, and a framework dossier lane.
- Related: a requested ticket whose blockers are open is not workable — name the blocker, name the alternatives, let the founder choose.

## Deep Dive
This is the rule that most shapes what it feels like to work in this repo, because ambiguity is constant and the two obvious policies are both bad. "Always ask" burns the founder's attention — the scarcest resource in a one-person company — on naming-level calls. "Always decide" quietly accumulates decisions nobody reviewed. The ambiguity rule splits by **reversibility**: cheap, local, reversible calls get made and flagged; expensive, structural, hard-to-reverse calls get escalated with options.

The clause worth memorising is the last one. *Discovering mid-ticket that you need a framework change is evidence for the dossier, never licence to proceed.* The temptation is exactly backwards from how it feels — you are deep in the work, you can see the fix, stopping feels wasteful. But the discovery is precisely the thing the founder needs to hear about, and implementing it inside a ticket scoped for something else is how a framework decision gets made by whoever happened to be typing.

Note also that the ambiguity rule *requires* the techspec amendment in the same commit. That connects it back to the altitude discipline: a resolved ambiguity is new normative information, and if it lives only in code, the next person re-derives it — differently.

## Practice Questions
1. State the ambiguity rule's three steps.
2. What kinds of question fall into Lane 3, and what do you do instead?
3. You are mid-ticket and realise the package boundary is wrong. What is that discovery, and what is it not?
4. Why does the rule split on reversibility rather than on difficulty?
5. Why must a resolved ambiguity amend the techspec in the same commit?

## Common Misconceptions
- "When in doubt, ask" → Explicitly discouraged for naming-level calls; it wastes the scarcest resource.
- "When in doubt, decide and move on" → Only with the techspec amendment and the flag for veto.
- "A framework change is fine if it's small and you're already there" → Being mid-ticket is evidence for the dossier, not licence.

## References
- `docs/implementation.md` §6
- `docs/adr/0023-change-lane-governance.md`
- `CLAUDE.md` §Session-start protocol item 6
