# Largest Rectangle in Histogram

**LeetCode 84** | Difficulty: Hard | Pattern: Monotonic Stack

## Problem
Given an array of bar heights, find the area of the largest rectangle that fits in the histogram.

```
Input: heights = [2,1,5,6,2,3]
Output: 10  (rectangle of height 2, width 5, at indices 1-4)
```

## Approach: Monotonic Increasing Stack

**Key Insight:** For each bar, find how far left and right it can extend (where bars are taller). Use a stack of indices with increasing heights.

```python
def largestRectangleArea(heights):
    stack = []  # indices, increasing height order
    max_area = 0
    heights.append(0)  # sentinel to flush stack at end

    for i, h in enumerate(heights):
        while stack and heights[stack[-1]] > h:
            height = heights[stack.pop()]
            # Width = current index - previous stack top - 1
            width = i if not stack else i - stack[-1] - 1
            max_area = max(max_area, height * width)
        stack.append(i)

    return max_area
```

## Walkthrough
```
heights = [2, 1, 5, 6, 2, 3, 0]  (with sentinel)

i=0, h=2: stack=[], push 0 → stack=[0]
i=1, h=1: heights[0]=2 > 1, pop 0
  height=2, width=1 (i=1, stack empty), area=2
  push 1 → stack=[1]
i=2, h=5: push 2 → stack=[1,2]
i=3, h=6: push 3 → stack=[1,2,3]
i=4, h=2: heights[3]=6 > 2, pop 3
  height=6, width=1 (i=4, stack[-1]=2), area=6
  heights[2]=5 > 2, pop 2
  height=5, width=2 (i=4, stack[-1]=1), area=10 ✓
  push 4 → stack=[1,4]
i=5, h=3: push 5 → stack=[1,4,5]
i=6, h=0: heights[5]=3 > 0, pop 5
  height=3, width=1, area=3
  heights[4]=2 > 0, pop 4
  height=2, width=4 (i=6, stack[-1]=1), area=8
  heights[1]=1, not > 0, stop
  push 6 → stack=[1,6]

Result: max_area = 10
```

## Why This Works
- Stack maintains bars in increasing height order
- When a shorter bar is encountered, all taller bars can't extend further right
- The previous stack element gives the left boundary
- Width = right_boundary - left_boundary - 1

## Complexity
- Time: O(n) — each bar pushed/popped once
- Space: O(n) for stack

## Variations
- **Maximal Rectangle** (LC 85): Binary matrix — apply histogram per row
- **Max Area of Island** (LC 695): Similar boundary-finding concept

## Key Pattern
```
# Monotonic increasing stack for "how far can this extend"
stack = []  # indices
for i, val in enumerate(array):
    while stack and array[stack[-1]] > val:
        idx = stack.pop()
        width = i if not stack else i - stack[-1] - 1
        result = max(result, array[idx] * width)
    stack.append(i)
```

## Common Mistakes
1. **Forgetting sentinel:** Without `heights.append(0)`, stack isn't flushed
2. **Wrong width calculation:** `i - stack[-1] - 1`, not `i - idx`
3. **Stack stores values vs indices:** Need indices to calculate width
