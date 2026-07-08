---
tags:
  - coding-interview
  - monotonic-stack
  - practice
last-updated: 2026-06-22
type: practice
---

# Monotonic Stack — Practice Problems

> [!note] Scheduled for future review. Master this pattern before the interview.

## Pattern Summary

**When to recognize:** "Next greater/smaller element" problems.

**Key insight:** Process from right to left, maintain a stack in decreasing order.

**Template:**
```python
def nextGreater(nums):
    n = len(nums)
    answer = [-1] * n
    stack = []

    for i in range(n - 1, -1, -1):
        while stack and stack[-1] <= nums[i]:
            stack.pop()
        if stack:
            answer[i] = stack[-1]
        stack.append(nums[i])

    return answer
```

## Problems to Practice

### Easy
- [ ] **Next Greater Element I** (LeetCode 496)
- [ ] **Next Greater Element II** (LeetCode 503) — circular array
- [ ] **Daily Temperatures** (LeetCode 739) — ✅ Done

### Medium
- [ ] **Stock Span Problem** — find consecutive days with lower price
- [ ] **Largest Rectangle in Histogram** (LeetCode 84)
- [ ] **Trapping Rain Water** (LeetCode 42) — uses similar concept
- [ ] **Online Stock Span** (LeetCode 901)

### Hard
- [ ] **Maximal Rectangle** (LeetCode 85) — 2D version of histogram
- [ ] **Sum of Subarray Minimums** (LeetCode 907)

## Key Variations

| Variation | Stack Order | Condition |
|-----------|-------------|-----------|
| Next Greater | Decreasing | Pop while ≤ current |
| Next Smaller | Increasing | Pop while ≥ current |
| Previous Greater | Decreasing (process left→right) | Pop while < current |
| Previous Smaller | Increasing (process left→right) | Pop while > current |

## Practice Schedule
- Week 1: Easy problems (496, 503, 739)
- Week 2: Medium problems (Stock Span, Histogram, Rain Water)
- Week 3: Hard problems (Maximal Rectangle, Subarray Minimums)
