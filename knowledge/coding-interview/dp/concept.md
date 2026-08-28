# Dynamic Programming

## Summary
Dynamic Programming (DP) solves problems by breaking them into overlapping subproblems and storing results to avoid redundant computation. The key insight: **if a problem has optimal substructure and overlapping subproblems, you can trade space for time by caching results**. Most interview DP problems boil down to defining the right state transition and base case.

## Key Points

1. **Optimal Substructure** — The optimal solution to the problem can be built from optimal solutions to its subproblems. If you can express `dp[i]` in terms of smaller subproblems, you have optimal substructure.
2. **Overlapping Subproblems** — The same subproblem is solved multiple times in a naive recursive approach. DP eliminates this by caching results (memoization or tabulation).
3. **Top-Down (Memoization)** — Start from the original problem, recurse down, cache results. Easier to reason about, but uses call stack space.
4. **Bottom-Up (Tabulation)** — Start from base cases, build up to the answer iteratively. No recursion overhead, easier to space-optimize.
5. **State Definition is Everything** — Before writing code, define: what does `dp[i]` (or `dp[i][j]`) represent? The wrong definition makes the transition impossible.

## Time Complexities
| Pattern | Time | Space | Space (optimized) |
|---------|------|-------|--------------------|
| 1D DP (n states) | O(n) | O(n) | O(1) |
| 2D Grid DP (m x n) | O(m*n) | O(m*n) | O(n) |
| Coin Change (n coins, amount) | O(n * amount) | O(amount) | O(amount) |
| LIS (naive) | O(n^2) | O(n) | — |
| LIS (binary search) | O(n log n) | O(n) | — |

## Common Patterns

### Pattern 1: 1D DP — Linear Recurrence (Climbing Stairs)
State: `dp[i]` = number of ways to reach step `i`.
Transition: `dp[i] = dp[i-1] + dp[i-2]`
```python
def climb_stairs(n: int) -> int:
    if n <= 2:
        return n
    prev2, prev1 = 1, 2  # base cases: dp[1]=1, dp[2]=2
    for i in range(3, n + 1):
        prev2, prev1 = prev1, prev1 + prev2
    return prev1
```

### Pattern 2: 1D DP with Decision (House Robber)
State: `dp[i]` = max money from houses `0..i`.
Transition: at each house, rob it (add to `dp[i-2]`) or skip it (`dp[i-1]`).
```python
def rob(nums: list[int]) -> int:
    if len(nums) <= 2:
        return max(nums)
    prev2, prev1 = nums[0], max(nums[0], nums[1])
    for i in range(2, len(nums)):
        prev2, prev1 = prev1, max(prev1, prev2 + nums[i])
    return prev1
```

### Pattern 3: Unbounded Knapsack (Coin Change)
State: `dp[i]` = min coins to make amount `i`.
Transition: try every coin, take the minimum.
```python
def coin_change(coins: list[int], amount: int) -> int:
    dp = [float('inf')] * (amount + 1)
    dp[0] = 0
    for i in range(1, amount + 1):
        for coin in coins:
            if coin <= i and dp[i - coin] + 1 < dp[i]:
                dp[i] = dp[i - coin] + 1
    return dp[amount] if dp[amount] != float('inf') else -1
```

### Pattern 4: 2D Grid DP (Unique Paths)
State: `dp[i][j]` = number of paths from `(0,0)` to `(i,j)`.
Transition: come from above or from the left.
```python
def unique_paths(m: int, n: int) -> int:
    row = [1] * n  # first row is all 1s
    for i in range(1, m):
        for j in range(1, n):
            row[j] += row[j - 1]  # row[j] already has dp[i-1][j], add dp[i][j-1]
    return row[n - 1]
```

## Space Optimization Technique

When `dp[i]` only depends on `dp[i-1]` (and maybe `dp[i-2]`), you don't need the full array. Use rolling variables instead:

```python
# Full table: O(n) space
dp = [0] * (n + 1)
for i in range(2, n + 1):
    dp[i] = dp[i-1] + dp[i-2]

# Rolling variables: O(1) space
prev2, prev1 = 0, 1
for i in range(2, n + 1):
    prev2, prev1 = prev1, prev1 + prev2
```

For 2D DP, you can often reduce from `O(m*n)` to `O(n)` by keeping only the previous row:
```python
# Only keep previous row
prev = [1] * n
for i in range(1, m):
    curr = [1] * n
    for j in range(1, n):
        curr[j] = prev[j] + curr[j-1]
    prev = curr
```

## Common Mistakes

1. **Wrong Base Case** — `dp[0]` vs `dp[1]` matters. For Climbing Stairs: `dp[0]=1, dp[1]=1`. For House Robber: `dp[0]=nums[0]`. Always check: what does the problem look like at the smallest input?
2. **Off-by-One in Loop Range** — `range(n)` vs `range(1, n)` vs `range(2, n)`. Start your loop where the recurrence actually begins, not from 0.
3. **Forgetting to Handle Negative Indices** — When accessing `dp[i-coin]` or `dp[i-2]`, ensure the index is >= 0. Add bounds checks before accessing.
4. **Not Initializing `dp[0]` Correctly** — In Coin Change, `dp[0] = 0` (zero coins to make amount 0). Getting this wrong breaks everything downstream.
5. **Using `min`/`max` on Uninitialized Values** — Initialize with `float('inf')` for min problems or `0` for max problems. Never leave `dp` entries as 0 for min problems.
6. **Confusing Count vs Min/Max** — Count problems sum subproblems (`dp[i] += dp[i-coin]`). Min problems take minimum (`dp[i] = min(dp[i], dp[i-coin]+1)`). Max problems take maximum. Don't mix them up.

## Practice Problems

1. **Climbing Stairs** (Easy) — Count ways to reach step n. Classic 1D DP.
2. **House Robber** (Medium) — Max money without robbing adjacent houses. 1D DP with skip/rob decision.
3. **Coin Change** (Medium) — Min coins to make amount. Unbounded knapsack.
4. **Longest Increasing Subsequence** (Medium) — Find length of LIS. O(n^2) DP or O(n log n) with binary search.
5. **Word Break** (Medium) — Can string be segmented into dictionary words? 1D DP with set lookup.
6. **Unique Paths** (Medium) — Count paths in grid from top-left to bottom-right. 2D grid DP, space-optimizable to 1D.
