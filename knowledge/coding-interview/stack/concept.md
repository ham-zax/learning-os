# Stack

## Summary
Stack is a LIFO (Last In, First Out) data structure. It excels at **matching and nesting problems** (parentheses, HTML tags, function calls) and, in its monotonic variant, at **next greater/smaller element** problems. If you need to "remember what you just saw" or "process things in reverse order," think stack.

## Key Points

1. **LIFO Principle** — The last element pushed is the first one popped. This naturally models nesting, undo operations, and expression evaluation
2. **Python List as Stack** — `append()` to push, `pop()` to pop, `[-1]` to peek. No need for a separate stack class
3. **Monotonic Stack Pattern** — Maintain a stack that is strictly increasing or decreasing. When a new element violates the order, pop and process. This finds next greater/smaller elements in O(n)
4. **Matching Pairs** — Push opening delimiters, pop on closing delimiters. If the popped element doesn't match, the string is invalid
5. **Auxiliary Stack** — Use a second stack to track running min/max/sum for O(1) retrieval (Min Stack pattern)

## Time Complexities
| Operation | Stack | Monotonic Stack (amortized) |
|-----------|-------|-----------------------------|
| Push | O(1) | O(1)* |
| Pop | O(1) | O(1)* |
| Peek | O(1) | O(1) |
| Search | O(n) | O(n) |
| Full traversal | O(n) | O(n) |

*Each element is pushed and popped at most once, so n operations total O(n)

## Common Patterns

### Pattern 1: Valid Parentheses (Matching Pairs)
Push opening brackets; on closing bracket, pop and check if they match.
```
def isValid(s: str) -> bool:
    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    for ch in s:
        if ch in pairs:
            if not stack or stack[-1] != pairs[ch]:
                return False
            stack.pop()
        else:
            stack.append(ch)
    return len(stack) == 0
```

### Pattern 2: Min Stack (Auxiliary Stack for O(1) Min)
Maintain a parallel stack that tracks the minimum at each level.
```
class MinStack:
    def __init__(self):
        self.stack = []
        self.min_stack = []  # tracks running minimum

    def push(self, val: int) -> None:
        self.stack.append(val)
        min_val = min(val, self.min_stack[-1] if self.min_stack else val)
        self.min_stack.append(min_val)

    def pop(self) -> None:
        self.stack.pop()
        self.min_stack.pop()

    def top(self) -> int:
        return self.stack[-1]

    def getMin(self) -> int:
        return self.min_stack[-1]
```

### Pattern 3: Monotonic Stack (Next Greater Element / Daily Temperatures)
Build a decreasing stack. When a warmer day appears, pop all cooler days and record the distance.
```
def dailyTemperatures(temps: list[int]) -> list[int]:
    result = [0] * len(temps)
    stack = []  # stores indices, stack is decreasing by temperature
    for i, t in enumerate(temps):
        while stack and temps[stack[-1]] < t:
            j = stack.pop()
            result[j] = i - j
        stack.append(i)
    return result
```

General next greater element pattern:
```
def nextGreater(nums: list[int]) -> list[int]:
    result = [-1] * len(nums)
    stack = []  # stores indices, decreasing by value
    for i, num in enumerate(nums):
        while stack and nums[stack[-1]] < num:
            j = stack.pop()
            result[j] = num
        stack.append(i)
    return result
```

### Pattern 4: Evaluate Expression (Postfix / Reverse Polish Notation)
Push numbers; on operator, pop two operands, compute, push result.
```
def evalRPN(tokens: list[str]) -> int:
    stack = []
    ops = {
        '+': lambda a, b: a + b,
        '-': lambda a, b: a - b,
        '*': lambda a, b: a * b,
        '/': lambda a, b: int(a / b),  # truncate toward zero
    }
    for token in tokens:
        if token in ops:
            b = stack.pop()
            a = stack.pop()
            stack.append(ops[token](a, b))
        else:
            stack.append(int(token))
    return stack[0]
```

## Common Mistakes

1. **Empty stack access** — Always check `if stack` before `stack[-1]` or `stack.pop()`. Accessing an empty stack raises IndexError
2. **Forgetting to process remaining stack** — After the loop, the stack may still have elements. For "next greater" problems, remaining elements get -1 (already initialized). For matching problems, non-empty stack means invalid
3. **Popping operands in wrong order** — For subtraction and division, order matters. Pop `b` first, then `a`, then compute `a op b`
4. **Using stack for random access** — Stack is O(n) for search. If you need O(1) lookup, use a hash map instead
5. **Monotonic stack direction confusion** — Decreasing stack finds next greater element; increasing stack finds next smaller element. Pick the wrong direction and you get wrong answers
6. **Integer division truncation** — Python's `//` floors (toward negative infinity), but LeetCode expects truncation toward zero. Use `int(a / b)` instead

## Edge Cases to Consider
- Empty input string or array
- Single element
- All elements the same
- Already sorted (ascending or descending)
- Nested structures: `((()))` vs `()()()`
- Negative numbers in expression evaluation
- Unclosed brackets / extra opening brackets

## Practice Questions
1. Explain how a stack solves Valid Parentheses. What's the time and space complexity?
2. How does the Min Stack achieve O(1) for getMin? What's the space trade-off?
3. Describe the monotonic stack pattern. When do you use decreasing vs increasing?
4. Walk through Daily Temperatures with `[73, 74, 75, 71, 69, 72, 76, 73]`. What's on the stack at each step?
5. How do you handle integer division in Reverse Polish Notation? Why not just use `//`?
6. When would you use a stack vs a queue? Give an example of each.

## Deep Dive: Why Monotonic Stacks Work

The monotonic stack pattern achieves O(n) because **each element is pushed once and popped at most once**. The while loop inside the for loop looks like O(n^2), but the total number of pops across all iterations is at most n.

The key insight: when you pop element `j` at index `i`, you've found `j`'s answer (the next greater/smaller element is at index `i`). Once popped, `j` is never pushed again. So the total work is bounded by 2n (n pushes + n pops) = O(n).

This is the same amortized analysis as dynamic array resizing. The inner while loop can do many pops in one iteration, but it "borrows" from future iterations which will do fewer pops.

## Related Problems
- Valid Parentheses (Easy)
- Min Stack (Medium)
- Daily Temperatures (Medium)
- Next Greater Element I (Easy)
- Next Greater Element II (Medium)
- Evaluate Reverse Polish Notation (Medium)
- Largest Rectangle in Histogram (Hard)
- Trapping Rain Water (Hard)
- Decode String (Medium)
- Asteroid Collision (Medium)
