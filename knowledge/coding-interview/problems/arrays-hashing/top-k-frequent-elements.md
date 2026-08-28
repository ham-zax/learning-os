---
id: top-k-frequent-elements
title: Top K Frequent Elements
difficulty: Medium
pattern: arrays-hashing
source: NeetCode
---

# Top K Frequent Elements

**Difficulty:** Medium
**Pattern:** arrays-hashing
**LeetCode:** https://leetcode.com/problems/top-k-frequent-elements/

## Problem

Given an integer array nums and an integer k, return the k most frequent elements. You may return the answer in any order.

## Examples

### Example 1
**Input:** nums = [1,1,1,2,2,3], k = 2
**Output:** [1,2]
**Explanation:** The two most frequent elements are 1 (appears 3 times) and 2 (appears 2 times).

### Example 2
**Input:** nums = [1], k = 1
**Output:** [1]
**Explanation:** There is only one element, so it is the most frequent.

## Constraints

- 1 <= nums.length <= 10^5
- -10^4 <= nums[i] <= 10^4
- k is in the range [1, the number of unique elements in the array]
- It is guaranteed that the answer is unique.

## Hints

<details>
<summary>Click to reveal hints</summary>

1. Count the frequency of each element using a hash map
2. Use bucket sort where the index represents frequency
3. Alternatively, use a heap to get the top k elements

</details>

## Key Insights

*(Fill in after solving - what makes this problem tick)*

## Solution Template

```python
def topKFrequent(nums: list[int], k: int) -> list[int]:
    # Your implementation here
    pass
```

## Related Problems

- Pattern: [arrays-hashing](../arrays-hashing/concept.md)
