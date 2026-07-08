---
id: product-of-array-except-self
title: Product of Array Except Self
difficulty: Medium
pattern: arrays-hashing
source: NeetCode
---

# Product of Array Except Self

**Difficulty:** Medium
**Pattern:** arrays-hashing
**LeetCode:** https://leetcode.com/problems/product-of-array-except-self/

## Problem

Given an integer array nums, return an array answer such that answer[i] is equal to the product of all the elements of nums except nums[i]. The product of any prefix or suffix of nums is guaranteed to fit in a 32-bit integer. You must write an algorithm that runs in O(n) time and without using the division operation.

## Examples

### Example 1
**Input:** nums = [1,2,3,4]
**Output:** [24,12,8,6]
**Explanation:** answer[0] = 2*3*4 = 24, answer[1] = 1*3*4 = 12, answer[2] = 1*2*4 = 8, answer[3] = 1*2*3 = 6

### Example 2
**Input:** nums = [-1,1,0,-3,3]
**Output:** [0,0,9,0,0]
**Explanation:** Since there is a zero in the array, most products will be zero except where the zero element is excluded.

## Constraints

- 2 <= nums.length <= 10^5
- -30 <= nums[i] <= 30
- The product of any prefix or suffix of nums is guaranteed to fit in a 32-bit integer.

## Hints

<details>
<summary>Click to reveal hints</summary>

1. Think about computing prefix products and suffix products
2. Use two passes: left-to-right for prefix, right-to-left for suffix
3. The answer at each index is prefix[i] * suffix[i]
4. Can you do it with O(1) extra space by using the output array?

</details>

## Key Insights

*(Fill in after solving - what makes this problem tick)*

## Solution Template

```python
def productExceptSelf(nums: list[int]) -> list[int]:
    # Your implementation here
    pass
```

## Related Problems

- Pattern: [arrays-hashing](../arrays-hashing/concept.md)
