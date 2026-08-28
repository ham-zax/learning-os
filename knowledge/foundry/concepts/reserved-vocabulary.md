---
id: reserved-vocabulary
title: Reserved Vocabulary and the Lexicon Gate
difficulty: 2
prerequisites: [three-layers]
tags: [architecture, seams, foundation]
---

## Summary
ADR-0008 fixes foundry's vocabulary by fiat: the platform says Task / TaskRun / Dispatch / Actor / Resource, and six app-domain words — Job, Listing, Resume, Applicant, Candidate, Skill — are **banned inside `packages/`**. A CI grep gate (`npm run lexicon-gate`) fails the build when one leaks. `docs/glossary.md` is the canonical list the gate enforces.

## Key Points
- Rule of thumb: **if two layers would naturally call something the same word, the platform keeps its word and the app renames.**
- `Job` is the load-bearing case: the platform's background-work concept and the first product's domain object would both naturally be "job".
- Reserved words and their platform equivalents: Job → **Task**; Listing → `knowledge.documents` with `kind="job-posting"`; Resume → a profile artifact in `matching.profiles`; Applicant/Candidate → **Actor** or a matching profile owner; Skill → a `knowledge.facts` predicate or a `matching.profile_facts` row.
- The banned words are legal in `apps/`, and in a service where that service's own contract needs them.
- Adding a glossary term is a normal change. **Removing or redefining one requires an ADR** — the schema names and millions of audit rows already encode the old meaning.

## Deep Dive
This looks like bikeshedding until you consider the failure it prevents. Foundry's platform runs background work; the product's core object is a job posting. Without a fiat, `job_runs` and `jobs` end up in the same codebase, and six months later nobody can grep for either. So the decision is made once, early, and given a build-failing enforcement.

The subtler point is *why the enforcement is a grep gate rather than review*. The ADR's own consequence section says it plainly: the gate costs nothing and catches leaks the day they happen. Vocabulary drift is exactly the kind of decay that code review misses, because each individual leak looks harmless.

The clause about **changing** the glossary is the one people underestimate. By the time you want to redefine a term, the word is already written into Postgres schema names and into an append-only audit log that can never be rewritten. A silent redefinition desynchronizes the prose from a database that has already committed to the old meaning — which is why it takes an ADR, not an edit.

## Practice Questions
1. Which six words are reserved, and in which directory are they banned?
2. Why is `Job` singled out as the load-bearing case?
3. The platform needs to refer to a job posting. What does it actually call it?
4. You want to redefine an existing glossary term. What does that require, and why is it heavier than adding one?

## Common Misconceptions
- "The banned words are banned everywhere" → Only in `packages/`. Apps use them freely; that is the whole point.
- "It's a style preference" → It is a build gate. A leak fails CI.
- "Renaming a term later is just a refactor" → The term is already in schema names and immutable audit rows. It requires an ADR.

## References
- `docs/glossary.md` §1, §2, §6
- `docs/adr/0008-layering-and-naming.md`
- `package.json` → `lexicon-gate`
