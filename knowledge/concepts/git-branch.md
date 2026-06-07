---
id: git-branch
title: Branching
difficulty: 2
prerequisites: [git-commit]
tags: [core, collaboration]
---

## Summary
A branch is a lightweight movable pointer to a commit. Creating branches is nearly free in Git — it's just a file with a commit hash. Branches enable parallel lines of work without interference.

## Key Points
- `git branch <name>` creates a new branch pointer at the current commit
- `git checkout <branch>` / `git switch <branch>` moves HEAD to that branch
- `git checkout -b <name>` creates and switches in one step
- HEAD is a pointer to the current branch (or commit in detached HEAD state)
- Branches diverge when commits are added to them independently

## Deep Dive
A branch in Git is literally a 41-byte file in `.git/refs/heads/` containing a commit hash. This is why branching is instant — no data is copied.

When you commit on a branch, the branch pointer moves forward to the new commit. Other branches stay where they are.

**Detached HEAD:** When you checkout a commit directly (not a branch), HEAD points to a commit hash instead of a branch name. Commits made here are unreachable once you switch away — unless you create a branch.

`git log --oneline --graph --all` shows the branch topology.

## Practice Questions
1. What is a branch, technically (what does it store)?
2. What is detached HEAD state and how do you end up in it?
3. You created commits in detached HEAD state. How do you keep them?

## Common Misconceptions
- "Branching copies all the files" → No, branches are just pointers. Files aren't duplicated.
- "Deleting a branch deletes commits" → Only if those commits are unreachable from all other branches/tags.

## References
- Pro Git Book, Chapter 3.1: Branches in a Nutshell
