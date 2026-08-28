# Currency Conversion Graph (Bellman-Ford)

**LeetCode 1834** variant | Difficulty: Medium | Pattern: Graph + Shortest Path

## Problem
Given exchange rates between currencies, find the best conversion rate from source to target. Rates are given as directed edges with weights (exchange rates).

```
Input: rates = [["USD","EUR",0.9],["EUR","GBP",0.8],["USD","GBP",0.75]]
Query: USD → GBP
Output: 0.75 (direct) vs 0.9 * 0.8 = 0.72 (via EUR) → 0.72 is better
```

## Why Bellman-Ford?

| Algorithm | Use Case | Handles Negative? |
|-----------|----------|-------------------|
| Dijkstra | Shortest path, non-negative weights | No |
| Bellman-Ford | Shortest path, any weights | Yes |
| Floyd-Warshall | All-pairs shortest path | Yes |

For currency conversion:
- We want to **maximize** the product of rates (not minimize sum)
- Convert to log space: maximize product → minimize negative sum
- Bellman-Ford handles this naturally

## Approach: Bellman-Ford in Log Space

**Key Insight:** `rate1 * rate2 * rate3` → `-log(rate1) - log(rate2) - log(rate3)`. Minimize the sum of negative logs = maximize the product of rates.

```python
import math
from collections import defaultdict

def bestRate(rates, source, target):
    # Build graph: -log(rate) as edge weight
    graph = defaultdict(dict)
    for src, dst, rate in rates:
        graph[src][dst] = -math.log(rate)

    # Bellman-Ford
    dist = {source: 0}
    for _ in range(len(graph) - 1):
        for src in graph:
            for dst in graph[src]:
                new_dist = dist.get(src, float('inf')) + graph[src][dst]
                if new_dist < dist.get(dst, float('inf')):
                    dist[dst] = new_dist

    return math.exp(-dist.get(target, float('inf')))
```

## Walkthrough
```
rates = [("USD","EUR",0.9), ("EUR","GBP",0.8), ("USD","GBP",0.75)]

Graph (with -log weights):
  USD → EUR: -log(0.9) ≈ 0.105
  EUR → GBP: -log(0.8) ≈ 0.223
  USD → GBP: -log(0.75) ≈ 0.288

Bellman-Ford from USD:
  Initial: dist = {USD: 0}
  
  Iteration 1:
    USD→EUR: dist[EUR] = 0 + 0.105 = 0.105
    EUR→GBP: dist[GBP] = 0.105 + 0.223 = 0.328
    USD→GBP: dist[GBP] = min(0.328, 0 + 0.288) = 0.288
  
  Iteration 2: No updates
  
  Result: dist[GBP] = 0.288
  Rate = exp(-0.288) ≈ 0.75 (direct is better)
```

## Why Not Dijkstra?
Dijkstra assumes non-negative weights. In log space, `-log(rate)` is always positive (rates > 0), so Dijkstra works too. But Bellman-Ford generalizes better and detects negative cycles (arbitrage opportunities).

## Detecting Arbitrage
A negative cycle in the log-space graph means arbitrage exists:
```
USD → EUR → GBP → USD
If the product of rates > 1, you make money on each cycle
In log space: sum of -log(rates) < 0 = negative cycle
```

Run one extra iteration of Bellman-Ford — if any distance decreases, arbitrage exists.

## Complexity
- Time: O(V × E) — V iterations, each checks all edges
- Space: O(V) for distance array

## Airwallex Relevance
- **FX conversion:** Finding best rate across multiple currency pairs
- **Settlement:** Converting amounts between currencies
- **Risk:** Detecting arbitrage in rate feeds

## Implementation (Without Log Space)
For simplicity, use multiplication directly:

```python
def bestRate(rates, source, target):
    graph = defaultdict(dict)
    for src, dst, rate in rates:
        graph[src][dst] = rate

    best = {source: 1.0}

    for _ in range(len(graph) - 1):
        for src in graph:
            for dst, rate in graph[src].items():
                if src in best:
                    best[dst] = max(best.get(dst, 0), best[src] * rate)

    return best.get(target, 0)
```

## Key Pattern
```
# "Best path through multiplicative weights" → Bellman-Ford
for _ in range(n - 1):  # n = number of nodes
    for u, v, weight in edges:
        dist[v] = min(dist[v], dist[u] + weight)  # or max for product
```
