---
id: contains-duplicate
title: Contains Duplicate
difficulty: Easy
pattern: arrays-hashing
source: NeetCode
---

# Contains Duplicate

**Difficulty:** Easy
**Pattern:** arrays-hashing
**LeetCode:** https://leetcode.com/problems/contains-duplicate/

## Problem

Given an integer array nums, return true if any value appears at least twice in the array, and return false if every element is distinct.

## Examples

### Example 1
**Input:** nums = [1,2,3,1]
**Output:** true
**Explanation:** The element 1 appears at indices 0 and 3.

### Example 2
**Input:** nums = [1,2,3,4]
**Output:** false
**Explanation:** All elements are distinct.

### Example 3
**Input:** nums = [1,1,1,3,3,4,3,2,4,2]
**Output:** true
**Explanation:** Multiple elements appear more than once.

## Constraints

- 1 <= nums.length <= 10^5
- -10^9 <= nums[i] <= 10^9

## Hints

<details>
<summary>Click to reveal hints</summary>

1. A set can only contain unique elements
2. Compare the length of the set to the length of the original array
3. You can also add elements to a set one by one and check for duplicates

</details>

## Key Insights

*(Fill in after solving - what makes this problem tick)*

## Solution Template

```python
def containsDuplicate(nums: list[int]) -> bool:
    # Your implementation here
    pass
```

## Related Problems

- Pattern: [arrays-hashing](../arrays-hashing/concept.md)
