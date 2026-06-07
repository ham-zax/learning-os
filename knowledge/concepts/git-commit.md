---
id: git-commit
title: Staging and Committing
difficulty: 1
prerequisites: [git-init]
tags: [core]
---

## Summary
Git uses a two-step process: staging (index) and committing. The staging area lets you precisely control what goes into each commit, making history clean and intentional.

## Key Points
- `git add <file>` stages changes to the index
- `git commit -m "message"` creates a snapshot of staged changes
- The index (staging area) sits between working directory and commit history
- `git status` shows what's staged vs unstaged vs untracked
- Each commit stores: tree snapshot, parent commit hash, author, timestamp, message

## Deep Dive
Git's three-tree model:
1. **Working directory** — files on disk, possibly modified
2. **Index (staging area)** — proposed next commit; populated with `git add`
3. **HEAD** — pointer to last commit; what you committed previously

`git diff` → diff between working dir and index
`git diff --staged` → diff between index and HEAD
`git diff HEAD` → diff between working dir and HEAD

A commit is immutable — it's a SHA-1 hash of its contents. Changing anything creates a new commit with a new hash.

## Practice Questions
1. What is the purpose of the staging area? Why not commit directly from working directory?
2. You modified 3 files but only want to commit 2 of them. What do you do?
3. What does `git diff --staged` show?

## Common Misconceptions
- "`git add .` is always fine" → It stages everything including debug files, secrets. Be explicit.
- "Commits are like saves" → Commits are snapshots + metadata. Each is permanently addressable by hash.

## References
- Pro Git Book, Chapter 2.2: Recording Changes to the Repository
