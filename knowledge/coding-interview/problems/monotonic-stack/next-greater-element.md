# Next Greater Element I

**LeetCode 496** | Difficulty: Easy | Pattern: Monotonic Stack

## Problem
Given two arrays `nums1` and `nums2`, find the next greater element for each element in `nums1` within `nums2`. The next greater element is the first element to the right that is greater. If none exists, return -1.

```
Input: nums1 = [4,1,2], nums2 = [1,3,4,2]
Output: [-1,3,-1]
```

## Approach: Monotonic Decreasing Stack

**Key Insight:** Process `nums2` right-to-left, maintaining a stack of elements in decreasing order. For each element, pop all smaller elements — the top of the stack is the next greater element.

```python
def nextGreaterElement(nums1, nums2):
    # Build map: element -> next greater element
    nge = {}
    stack = []  # monotonic decreasing

    for num in reversed(nums2):
        # Pop elements smaller than current
        while stack and stack[-1] <= num:
            stack.pop()

        # Top of stack is next greater (or empty = -1)
        nge[num] = stack[-1] if stack else -1
        stack.append(num)

    return [nge[num] for num in nums1]
```

## Walkthrough
```
nums2 = [1, 3, 4, 2], processing right-to-left:

Process 2: stack=[], nge[2]=-1, stack=[2]
Process 4: pop 2 (2<=4), stack=[], nge[4]=-1, stack=[4]
Process 3: stack=[4], nge[3]=4, stack=[4,3]
Process 1: stack=[4,3], nge[1]=3, stack=[4,3,1]

Result for nums1=[4,1,2]: nge[4]=-1, nge[1]=3, nge[2]=-1
```

## Complexity
- Time: O(n) — each element pushed/popped at most once
- Space: O(n) for stack + map

## Variations
- **Next Greater Element II** (LC 503): Circular array — process array twice
- **Next Greater Element III** (LC 556): Find next greater permutation of digits

## Key Pattern
```
for element in reversed(array):
    while stack and stack[-1] <= element:
        stack.pop()
    result[element] = stack[-1] if stack else -1
    stack.append(element)
```
