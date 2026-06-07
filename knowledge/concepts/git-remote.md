---
id: git-remote
title: Working with Remotes
difficulty: 2
prerequisites: [git-commit]
tags: [collaboration]
---

## Summary
Remotes are named references to other repositories (usually on a server). `git push` uploads commits; `git fetch` downloads them without affecting your working directory; `git pull` fetches and merges.

## Key Points
- `git remote add <name> <url>` registers a remote (conventionally named `origin`)
- `git push <remote> <branch>` uploads local commits to remote
- `git fetch <remote>` downloads remote commits into `refs/remotes/<remote>/`
- `git pull` = `git fetch` + `git merge` (or rebase if configured)
- Remote-tracking branches (`origin/main`) are read-only local snapshots of remote state

## Deep Dive
**Remote-tracking branches** (`origin/main`) are updated only on fetch/pull. They show where the remote was last time you synced — not necessarily where it is now.

**Tracking relationships:** `git push -u origin main` sets `main` to track `origin/main`. After that, `git push` and `git pull` need no arguments.

**Fetch vs Pull:**
- `git fetch` is always safe — downloads data, changes nothing in working dir
- `git pull` merges fetched changes into current branch — can cause conflicts

**Force push (`--force-with-lease`):** Rewrites remote history. Dangerous on shared branches; safer alternative to `--force` (fails if remote has commits you haven't fetched).

## Practice Questions
1. What is the difference between `git fetch` and `git pull`?
2. What does `origin/main` represent and when does it update?
3. Why is `git push --force` dangerous on a shared branch?

## Common Misconceptions
- "`git fetch` is the safe version of `git pull`" → Mostly true, but fetch just downloads — you still need to merge/rebase separately.
- "origin is special" → It's just a convention. You can name remotes anything.

## References
- Pro Git Book, Chapter 2.5: Working with Remotes
