---
id: longest-consecutive-sequence
title: Longest Consecutive Sequence
difficulty: Medium
pattern: arrays-hashing
source: NeetCode
---

# Longest Consecutive Sequence

**Difficulty:** Medium
**Pattern:** arrays-hashing
**LeetCode:** https://leetcode.com/problems/longest-consecutive-sequence/

## Problem

Given an unsorted array of integers nums, return the length of the longest consecutive elements sequence. You must write an algorithm that runs in O(n) time.

## Examples

### Example 1
**Input:** nums = [100,4,200,1,3,2]
**Output:** 4
**Explanation:** The longest consecutive elements sequence is [1, 2, 3, 4]. Therefore its length is 4.

### Example 2
**Input:** nums = [0,3,7,2,5,8,4,6,0,1]
**Output:** 9
**Explanation:** The longest consecutive elements sequence is [0, 1, 2, 3, 4, 5, 6, 7, 8]. Therefore its length is 9.

## Constraints

- 0 <= nums.length <= 10^5
- -10^9 <= nums[i] <= 10^9

## Hints

<details>
<summary>Click to reveal hints</summary>

1. Convert the array to a set for O(1) lookups
2. Only start counting from the beginning of a sequence (when num-1 is not in the set)
3. For each starting number, count how long the consecutive sequence extends

</details>

## Key Insights

*(Fill in after solving - what makes this problem tick)*

## Solution Template

```python
def longestConsecutive(nums: list[int]) -> int:
    # Your implementation here
    pass
```

## Related Problems

- Pattern: [arrays-hashing](../arrays-hashing/concept.md)
