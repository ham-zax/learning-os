---
id: git-init
title: Initializing a Repository
difficulty: 1
prerequisites: []
tags: [core]
---

## Summary
A Git repository is initialized with `git init`, creating a `.git` directory that tracks all version history. Understanding what this directory contains is fundamental to understanding Git.

## Key Points
- `git init` creates a new `.git/` directory in the current folder
- The `.git/` directory contains: objects (file snapshots), refs (branch pointers), HEAD (current branch)
- A repo can also be created by cloning: `git clone <url>`
- `git init` is idempotent — running it again won't destroy existing history

## Deep Dive
When you run `git init`, Git creates a hidden `.git` directory with this structure:
- `objects/` — stores all file content as compressed blobs, trees (directories), and commits
- `refs/` — stores branch and tag pointers (just files containing commit hashes)
- `HEAD` — a file pointing to the current branch ref (e.g., `ref: refs/heads/main`)
- `config` — repo-level configuration
- `hooks/` — scripts that run on events (pre-commit, post-merge, etc.)

The working directory (everything outside `.git/`) is where you edit files. Git compares working directory state against the last commit to determine what changed.

## Practice Questions
1. What does `git init` create and where?
2. What is the purpose of the `.git/objects` directory?
3. If you delete the `.git/` directory, what happens to your files? What do you lose?

## Common Misconceptions
- "git init uploads something to GitHub" → No, it's purely local. Remote connection requires `git remote add`.
- "You need to init before clone" → No, `clone` includes initialization.

## References
- Pro Git Book, Chapter 2.1: Getting a Git Repository
- Git Internals: https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain
