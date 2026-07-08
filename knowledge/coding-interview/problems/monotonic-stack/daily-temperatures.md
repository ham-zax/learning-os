# Daily Temperatures

**LeetCode 739** | Difficulty: Medium | Pattern: Monotonic Stack

## Problem
Given an array of temperatures, return an array where each element is the number of days until a warmer temperature. If no warmer day exists, use 0.

```
Input:  [73, 74, 75, 71, 69, 72, 76, 73]
Output: [1,  1,  4,  2,  1,  1,  0,  0]
```

## Approach: Monotonic Decreasing Stack

**Key Insight:** Process left-to-right, maintaining a stack of indices with decreasing temperatures. When a warmer day is found, pop all cooler days and calculate their wait time.

```python
def dailyTemperatures(temperatures):
    n = len(temperatures)
    result = [0] * n
    stack = []  # indices, decreasing temperature order

    for i, temp in enumerate(temperatures):
        while stack and temperatures[stack[-1]] < temp:
            prev_idx = stack.pop()
            result[prev_idx] = i - prev_idx
        stack.append(i)

    return result
```

## Walkthrough
```
temperatures = [73, 74, 75, 71, 69, 72, 76, 73]

i=0, temp=73: stack=[], push 0 → stack=[0]
i=1, temp=74: 73<74, pop 0, result[0]=1-0=1, push 1 → stack=[1]
i=2, temp=75: 74<75, pop 1, result[1]=2-1=1, push 2 → stack=[2]
i=3, temp=71: 75>71, push 3 → stack=[2,3]
i=4, temp=69: 71>69, push 4 → stack=[2,3,4]
i=5, temp=72: 69<72, pop 4, result[4]=5-4=1
              71<72, pop 3, result[3]=5-3=2
              75>72, stop, push 5 → stack=[2,5]
i=6, temp=76: 72<76, pop 5, result[5]=6-5=1
              75<76, pop 2, result[2]=6-2=4
              stack=[], push 6 → stack=[6]
i=7, temp=73: 76>73, push 7 → stack=[6,7]

Result: [1, 1, 4, 2, 1, 1, 0, 0]
```

## Complexity
- Time: O(n) — each index pushed/popped once
- Space: O(n) for stack

## Why Left-to-Right Works
- Stack holds indices waiting for a warmer day
- When we find a warmer day, all cooler days in stack get their answer
- Each index is pushed once and popped once → O(n) total

## Key Pattern
```
# "How long until something bigger?" — monotonic decreasing stack
stack = []  # indices
for i, val in enumerate(array):
    while stack and array[stack[-1]] < val:
        prev = stack.pop()
        result[prev] = i - prev
    stack.append(i)
```

## Related Problems
- **Next Greater Element I** (LC 496): Same pattern, different output format
- **Online Stock Span** (LC 901): "How many days since something smaller?"
- **Trapping Rain Water** (LC 42): Different approach but similar stack usage
