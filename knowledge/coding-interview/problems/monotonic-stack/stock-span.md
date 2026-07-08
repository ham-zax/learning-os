# Stock Span Problem

**LeetCode 901** | Difficulty: Medium | Pattern: Monotonic Stack

## Problem
Design a class that collects daily stock prices and returns the span — the maximum number of consecutive days (including today) where the price was ≤ today's price.

```
Input: [100, 80, 60, 70, 60, 75, 85]
Output: [1,   1,  1,  2,  1,  4,  6]
```

## Approach: Monotonic Decreasing Stack

**Key Insight:** Maintain a stack of `(price, span)` in decreasing order. For each new price, pop all smaller prices and accumulate their spans.

```python
class StockSpanner:
    def __init__(self):
        self.stack = []  # (price, span)

    def next(self, price: int) -> int:
        span = 1
        while self.stack and self.stack[-1][0] <= price:
            span += self.stack.pop()[1]
        self.stack.append((price, span))
        return span
```

## Walkthrough
```
Price 100: stack=[], span=1, stack=[(100,1)]
Price 80:  stack=[(100,1)], 80<=100? No, span=1, stack=[(100,1),(80,1)]
Price 60:  stack=[...], 60<=80? No, span=1, stack=[(100,1),(80,1),(60,1)]
Price 70:  pop (60,1) since 60<=70, span=1+1=2, stack=[(100,1),(80,1),(70,2)]
Price 60:  stack=[...], 60<=70? No, span=1, stack=[(100,1),(80,1),(70,2),(60,1)]
Price 75:  pop (60,1), pop (70,2), span=1+1+2=4, stack=[(100,1),(80,1),(75,4)]
Price 85:  pop (75,4), pop (80,1), span=1+4+1=6, stack=[(100,1),(85,6)]
```

## Complexity
- Time: O(1) amortized per call — each element pushed/popped once
- Space: O(n) for stack

## Why Amortized O(1)?
Each price is pushed once and popped once across all calls. Total work across n calls = O(n), so amortized = O(1) per call.

## Key Pattern
```
# Online algorithm — processes elements one at a time
while stack and stack[-1] <= current:
    accumulated += stack.pop()
stack.append(current)
```

## Real-World Application
- **Financial analysis:** Finding trends in time-series data
- **Temperature spans:** How many days since it was cooler?
- **Load balancing:** How many consecutive requests were lighter?
