---
id: git-merge
title: Merging Branches
difficulty: 3
prerequisites: [git-branch]
tags: [collaboration]
---

## Summary
Merging integrates diverged histories. Git performs either a fast-forward (no divergence) or a 3-way merge (creates a merge commit). Conflicts arise when the same lines changed differently on both branches.

## Key Points
- `git merge <branch>` integrates `<branch>` into the current branch
- **Fast-forward:** if current branch has no new commits, just move the pointer forward
- **3-way merge:** uses common ancestor + both branch tips to produce merge commit
- Merge commits have two parents
- Conflicts must be resolved manually; resolved files must be staged before completing merge

## Deep Dive
**3-way merge algorithm:**
Git finds the merge base (common ancestor commit), then computes diffs from base→ours and base→theirs. Changes that don't conflict are applied automatically. Conflicts occur when both sides changed the same region differently.

**Conflict markers:**
```
<<<<<<< HEAD
your version
=======
their version
>>>>>>> feature-branch
```

After resolving: `git add <file>` then `git commit` (or `git merge --continue`).

**`git merge --no-ff`** forces a merge commit even when fast-forward is possible — preserves branch history in the log.

**`git merge --abort`** cancels an in-progress merge and restores pre-merge state.

## Practice Questions
1. What determines whether a merge is fast-forward or 3-way?
2. A merge conflict occurred in `app.js`. Walk through the resolution steps.
3. Why would you use `--no-ff` when fast-forward is possible?

## Common Misconceptions
- "Conflicts mean something broke" → Conflicts just mean Git can't auto-decide. They're normal.
- "Fast-forward is always better" → Not if you want preserved branch topology in history.

## References
- Pro Git Book, Chapter 3.2: Basic Branching and Merging
