# Python Coding Test Foundation — Complete Guide

**For:** Someone who hasn't done coding tests in years
**Goal:** Build the mindset, framework, and muscle memory to solve medium problems

---

## Part 1: The Mindset

### How Interviewers Think

Interviewers don't just want a working solution. They want to see:

1. **Communication** — Can you explain your thinking?
2. **Problem decomposition** — Can you break down the problem?
3. **Pattern recognition** — Do you know common patterns?
4. **Code quality** — Is your code clean and readable?
5. **Complexity analysis** — Do you understand Big O?
6. **Edge cases** — Do you handle corner cases?

### The 80/20 Rule

80% of interview problems use 20% of the patterns. Master these patterns:

| Pattern | Frequency | Difficulty |
|---------|-----------|------------|
| Hash Map | Very High | Easy |
| Two Pointers | High | Easy-Medium |
| Sliding Window | High | Medium |
| Binary Search | High | Easy-Medium |
| BFS/DFS | High | Medium |
| Stack | Medium | Easy-Medium |
| Heap | Medium | Medium |
| Dynamic Programming | Medium | Medium-Hard |
| Union-Find | Medium | Medium |
| Graph (Dijkstra) | Low-Medium | Medium |

### The Growth Mindset

**Wrong approach:** "I need to memorize solutions"
**Right approach:** "I need to learn patterns and apply them"

Every problem is a variation of a pattern. Your job is to:
1. Recognize the pattern
2. Apply the template
3. Adapt to the specific problem

---

## Part 2: The Framework (7-Step Process)

Use this EVERY time you solve a problem. Print it, memorize it, live it.

### Step 1: Understand (2-3 min)

**Before writing any code, answer these:**

```
□ What are the inputs? (type, size, constraints)
□ What are the outputs? (type, format)
□ Can I restate the problem in my own words?
□ What are the edge cases?
  □ Empty input?
  □ Single element?
  □ All same elements?
  □ Negative numbers?
  □ Very large input?
```

**Example: Two Sum**
- Input: array of integers, target integer
- Output: indices of two numbers that add up to target
- Edge cases: No solution? Same element twice? Negative numbers?

### Step 2: Match (1-2 min)

**Which pattern does this look like?**

```
□ "Find pair" → Hash Map or Two Pointers
□ "Count frequency" → Counter
□ "Group elements" → defaultdict
□ "Sorted array" → Binary Search or Two Pointers
□ "Subarray/substring" → Sliding Window
□ "Matching/nesting" → Stack
□ "Kth largest/smallest" → Heap
□ "Connected components" → Union-Find or DFS
□ "Shortest path" → Dijkstra or BFS
□ "Count ways/min/max" → Dynamic Programming
```

### Step 3: Explore (2-3 min)

**Ask these questions:**

```
□ What's the brute force approach?
□ What's its time complexity?
□ Can I do better?
□ What data structure would help?
□ Is there a pattern I can reuse?
```

### Step 4: Plan (2-3 min)

**Write pseudocode BEFORE coding:**

```
1. [Step 1]
2. [Step 2]
   a. [Sub-step]
3. [Step 3]

Time: O(?) | Space: O(?)
```

### Step 5: Implement (5-10 min)

**Write clean code:**

```python
def solution(params):
    # 1. Handle edge cases
    if not params:
        return default_value

    # 2. Initialize data structures
    seen = {}
    result = []

    # 3. Main logic
    for item in params:
        # Process
        pass

    # 4. Return result
    return result
```

### Step 6: Test (2-3 min)

**Walk through your code with examples:**

```
Input: [2, 7, 11, 15], target = 9

i=0: num=2, complement=7, seen={}, 7 not in seen → seen={2:0}
i=1: num=7, complement=2, seen={2:0}, 2 in seen → return [0, 1] ✓
```

**Test edge cases:**
- Example from problem
- Edge case: empty array
- Edge case: no solution
- Edge case: duplicate values

### Step 7: Optimize (1-2 min)

**Ask yourself:**
```
□ Can I reduce time complexity?
□ Can I reduce space complexity?
□ Is there a cleaner way to write this?
```

---

## Part 3: Python Coding Patterns

### Pattern 1: Hash Map (Counter, defaultdict)

**When to use:** Counting, grouping, lookup

```python
from collections import Counter, defaultdict

# Counter — count frequencies
count = Counter(arr)
count.most_common(k)
count['key']  # 0 if missing

# defaultdict — auto-create missing keys
d = defaultdict(list)
d['key'].append(value)

d = defaultdict(int)
d['key'] += 1

d = defaultdict(set)
d['key'].add(value)
```

**Problems:** Two Sum, Group Anagrams, Top K Frequent

### Pattern 2: Two Pointers

**When to use:** Sorted array, pair finding, palindrome

```python
# Standard two pointers
left, right = 0, len(arr) - 1
while left < right:
    curr = arr[left] + arr[right]
    if curr == target:
        return [left, right]
    elif curr < target:
        left += 1
    else:
        right -= 1

# Fast/slow pointers (linked list cycle)
slow = fast = head
while fast and fast.next:
    slow = slow.next
    fast = fast.next.next
    if slow == fast:
        return True
```

**Problems:** 3Sum, Container With Most Water, Valid Palindrome

### Pattern 3: Sliding Window

**When to use:** Subarray/substring, contiguous elements

```python
# Variable size window
window = {}
left = 0
result = 0

for right in range(len(arr)):
    # Add to window
    window[arr[right]] = window.get(arr[right], 0) + 1

    # Shrink window if needed
    while window_invalid:
        window[arr[left]] -= 1
        if window[arr[left]] == 0:
            del window[arr[left]]
        left += 1

    # Update result
    result = max(result, right - left + 1)

# Fixed size window
window = deque()
for i in range(len(arr)):
    # Remove outside window
    if window and window[0] < i - k + 1:
        window.popleft()

    # Add to window
    window.append(i)

    # Process window
    if i >= k - 1:
        process(window)
```

**Problems:** Longest Substring, Minimum Window, Sliding Window Maximum

### Pattern 4: Binary Search

**When to use:** Sorted array, search space reduction

```python
# Standard binary search
left, right = 0, len(arr) - 1
while left <= right:
    mid = (left + right) // 2
    if arr[mid] == target:
        return mid
    elif arr[mid] < target:
        left = mid + 1
    else:
        right = mid - 1
return -1

# Binary search on answer
left, right = min_val, max_val
while left < right:
    mid = (left + right) // 2
    if is_valid(mid):
        right = mid
    else:
        left = mid + 1
return left

# Using bisect
import bisect
idx = bisect.bisect_left(arr, target)
```

**Problems:** Search in Rotated Array, Find Minimum, Koko Bananas

### Pattern 5: BFS/DFS

**When to use:** Tree/graph traversal, level order, connected components

```python
from collections import deque

# BFS (level order)
def bfs(root):
    if not root:
        return []
    result = []
    queue = deque([root])
    while queue:
        level = []
        for _ in range(len(queue)):
            node = queue.popleft()
            level.append(node.val)
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
        result.append(level)
    return result

# DFS (recursive)
def dfs(node):
    if not node:
        return
    # Process node
    dfs(node.left)
    dfs(node.right)

# DFS (iterative)
def dfs(root):
    stack = [root]
    while stack:
        node = stack.pop()
        # Process node
        if node.right:
            stack.append(node.right)
        if node.left:
            stack.append(node.left)

# Grid DFS
def dfs_grid(grid, i, j):
    if i < 0 or i >= len(grid) or j < 0 or j >= len(grid[0]):
        return
    if grid[i][j] == visited_marker:
        return
    grid[i][j] = visited_marker
    dfs_grid(grid, i + 1, j)
    dfs_grid(grid, i - 1, j)
    dfs_grid(grid, i, j + 1)
    dfs_grid(grid, i, j - 1)
```

**Problems:** Number of Islands, Level Order Traversal, Clone Graph

### Pattern 6: Stack

**When to use:** Matching, nesting, monotonic stack

```python
# Valid parentheses
def isValid(s):
    stack = []
    mapping = {')': '(', ']': '[', '}': '{'}
    for char in s:
        if char in mapping:
            if not stack or stack[-1] != mapping[char]:
                return False
            stack.pop()
        else:
            stack.append(char)
    return len(stack) == 0

# Monotonic stack (next greater element)
def nextGreaterElement(nums):
    stack = []
    result = [-1] * len(nums)
    for i in range(len(nums)):
        while stack and nums[stack[-1]] < nums[i]:
            result[stack.pop()] = nums[i]
        stack.append(i)
    return result
```

**Problems:** Valid Parentheses, Daily Temperatures, Next Greater Element

### Pattern 7: Heap (Priority Queue)

**When to use:** Kth largest/smallest, merging, priority

```python
import heapq

# Min-heap
heap = []
heapq.heappush(heap, val)
smallest = heapq.heappop(heap)
peek = heap[0]

# Max-heap (negate values)
max_heap = []
heapq.heappush(max_heap, -val)
max_val = -heapq.heappop(max_heap)

# K largest/smallest
k_largest = heapq.nlargest(k, arr)
k_smallest = heapq.nsmallest(k, arr)

# Custom key
heap = []
heapq.heappush(heap, (priority, item))
```

**Problems:** Kth Largest, Meeting Rooms II, Merge K Sorted Lists

### Pattern 8: Dynamic Programming

**When to use:** Count ways, min/max, optimal substructure

```python
# 1D DP
def dp_1d(nums):
    n = len(nums)
    dp = [0] * n
    dp[0] = nums[0]
    for i in range(1, n):
        dp[i] = max(dp[i-1], dp[i-2] + nums[i])
    return dp[-1]

# 2D DP
def dp_2d(grid):
    m, n = len(grid), len(grid[0])
    dp = [[0] * n for _ in range(m)]
    for i in range(m):
        dp[i][0] = 1
    for j in range(n):
        dp[0][j] = 1
    for i in range(1, m):
        for j in range(1, n):
            dp[i][j] = dp[i-1][j] + dp[i][j-1]
    return dp[m-1][n-1]

# Space-optimized 1D
def dp_optimized(nums):
    prev2, prev1 = 0, 0
    for num in nums:
        curr = max(prev1, prev2 + num)
        prev2 = prev1
        prev1 = curr
    return prev1
```

**Problems:** Climbing Stairs, House Robber, Coin Change, Unique Paths

### Pattern 9: Union-Find

**When to use:** Connected components, cycle detection, grouping

```python
class UnionFind:
    def __init__(self, n):
        self.parent = list(range(n))
        self.rank = [0] * n

    def find(self, x):
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])  # Path compression
        return self.parent[x]

    def union(self, x, y):
        px, py = self.find(x), self.find(y)
        if px == py:
            return False
        if self.rank[px] < self.rank[py]:
            px, py = py, px
        self.parent[py] = px
        if self.rank[px] == self.rank[py]:
            self.rank[px] += 1
        return True

    def connected(self, x, y):
        return self.find(x) == self.find(y)
```

**Problems:** Number of Islands, Graph Valid Tree, Redundant Connection

### Pattern 10: Dijkstra (Shortest Path)

**When to use:** Shortest path with non-negative weights

```python
import heapq
from collections import defaultdict

def dijkstra(graph, start):
    # graph = {node: [(neighbor, weight), ...]}
    heap = [(0, start)]
    dist = {}

    while heap:
        d, node = heapq.heappop(heap)
        if node in dist:
            continue
        dist[node] = d
        for neighbor, weight in graph[node]:
            if neighbor not in dist:
                heapq.heappush(heap, (d + weight, neighbor))

    return dist

# Build graph from edges
def build_graph(edges):
    graph = defaultdict(list)
    for u, v, w in edges:
        graph[u].append((v, w))
        # graph[v].append((u, w))  # Uncomment for undirected
    return graph
```

**Problems:** Network Delay Time, Cheapest Flights, Path with Maximum Probability

---

## Part 4: Common Mistakes and How to Avoid Them

### Mistake 1: Jumping to Code Too Fast

**Wrong:** Read problem → start coding
**Right:** Read problem → understand → match pattern → plan → code

**Fix:** Use the 7-step framework. Spend 5-7 minutes planning before coding.

### Mistake 2: Not Testing Edge Cases

**Wrong:** Test with example → assume correct
**Right:** Test with example → test edge cases → verify

**Fix:** Always test:
- Empty input
- Single element
- All same elements
- Negative numbers
- Very large input

### Mistake 3: Using Wrong Data Structure

**Wrong:** Use list for O(1) lookup
**Right:** Use set/dict for O(1) lookup

**Fix:** Know when to use each:
- List: ordered, index access
- Set: unique elements, O(1) lookup
- Dict: key-value, O(1) lookup
- Heap: priority queue
- Deque: O(1) append/pop both ends

### Mistake 4: Not Knowing Python Built-ins

**Wrong:** Implement everything from scratch
**Right:** Use Counter, defaultdict, heapq, bisect

**Fix:** Memorize the templates in Part 3.

### Mistake 5: Overcomplicating Solutions

**Wrong:** Complex solution with many edge cases
**Right:** Simple solution that handles all cases

**Fix:** Start with brute force, then optimize. Don't overthink.

### Mistake 6: Not Explaining Your Thinking

**Wrong:** Silent coding
**Right:** Talk through your approach

**Fix:** Practice explaining your solution out loud.

---

## Part 5: How to Think Through Problems

### The Pattern Recognition Flowchart

```
Start
  ↓
Is it about pairs/sums? → Hash Map or Two Pointers
  ↓
Is it about subarrays/substrings? → Sliding Window
  ↓
Is it sorted? → Binary Search or Two Pointers
  ↓
Is it about nesting/matching? → Stack
  ↓
Is it about Kth largest/smallest? → Heap
  ↓
Is it about connected components? → Union-Find or DFS
  ↓
Is it about shortest path? → Dijkstra or BFS
  ↓
Is it about counting ways/min/max? → Dynamic Programming
  ↓
Is it about tree traversal? → BFS or DFS
  ↓
Can't identify pattern? → Try brute force first
```

### The Problem Decomposition Process

1. **What is the core operation?**
   - Lookup? → Hash Map
   - Comparison? → Sorting or Two Pointers
   - Traversal? → BFS or DFS
   - Optimization? → DP or Greedy

2. **What is the constraint?**
   - Time limit? → Need efficient algorithm
   - Space limit? → Need in-place or streaming
   - Sorted input? → Can use binary search

3. **What is the output format?**
   - Single value? → Usually O(n) or O(n log n)
   - All solutions? → Usually O(2^n) or O(n!)
   - Count? → Usually DP or combinatorics

### The Debugging Process

When your solution doesn't work:

1. **Read the error message** — What type of error?
2. **Check the failing test case** — What's different?
3. **Trace through your code** — Where does it go wrong?
4. **Check edge cases** — Did you handle them?
5. **Check your logic** — Is the algorithm correct?
6. **Check your implementation** — Is the code correct?

---

## Part 6: Python Coding Test Specifics

### Code Structure Template

```python
def solution(params):
    # 1. Handle edge cases
    if not params:
        return default_value

    # 2. Initialize data structures
    seen = {}  # or Counter, defaultdict, set, etc.
    result = []

    # 3. Main logic
    for item in params:
        # Process item
        if condition:
            # Do something
            pass

    # 4. Return result
    return result
```

### Common Python Idioms

```python
# Enumerate with index
for i, val in enumerate(arr):
    pass

# Zip parallel arrays
for a, b in zip(arr1, arr2):
    pass

# List comprehension
result = [x for x in arr if condition]
result = [func(x) for x in arr]

# Dict comprehension
result = {k: v for k, v in d.items() if condition}

# Set comprehension
result = {x for x in arr if condition}

# Generator expression
total = sum(x for x in arr if condition)

# Unpacking
a, b = 1, 2
first, *rest = arr
a, b = b, a  # Swap

# Default dict
from collections import defaultdict
d = defaultdict(list)
d['key'].append(value)

# Counter
from collections import Counter
count = Counter(arr)
count.most_common(k)

# Heap
import heapq
heapq.heappush(heap, val)
smallest = heapq.heappop(heap)

# Bisect
import bisect
idx = bisect.bisect_left(arr, target)

# Deque
from collections import deque
q = deque()
q.append(val)
q.popleft()
```

### Input/Output Patterns

```python
# Reading input
import sys
input = sys.stdin.readline

n = int(input())
arr = list(map(int, input().split()))
s = input().strip()

# Multiple test cases
t = int(input())
for _ in range(t):
    n = int(input())
    arr = list(map(int, input().split()))
    # Solve
    print(result)
```

---

## Part 7: Practice Strategy

### Week 1: Foundation
- Day 1-2: Memorize Python built-ins (Counter, defaultdict, deque, heapq, bisect)
- Day 3-4: Practice Hash Map and Two Pointers patterns
- Day 5-6: Practice Sliding Window and Binary Search patterns
- Day 7: Review and mock

### Week 2: Advanced
- Day 8-9: Practice BFS/DFS and Tree patterns
- Day 10-11: Practice Union-Find and Dijkstra patterns
- Day 12-13: Practice Dynamic Programming patterns
- Day 14: Final review and mock

### Daily Practice (2 hours)
- 15 min: Review templates
- 15 min: Study pattern
- 45 min: Solve 2-3 problems
- 30 min: Review solutions
- 15 min: Update progress

### How to Review Solutions

1. **Did you get the right answer?**
   - If no, find the bug
   - If yes, continue

2. **Is your solution optimal?**
   - Check time complexity
   - Check space complexity
   - Compare with optimal solution

3. **Can you improve it?**
   - Simpler code?
   - Better data structure?
   - More Pythonic?

4. **What did you learn?**
   - New pattern?
   - New Python built-in?
   - New approach?

---

## Part 8: Union-Find Deep Dive

### When to Use Union-Find

1. **Connected components** — How many groups?
2. **Cycle detection** — Is there a cycle?
3. **Grouping** — Which elements belong together?
4. **Redundant connections** — Which edge creates a cycle?

### The Algorithm

```python
class UnionFind:
    def __init__(self, n):
        self.parent = list(range(n))
        self.rank = [0] * n
        self.components = n

    def find(self, x):
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])  # Path compression
        return self.parent[x]

    def union(self, x, y):
        px, py = self.find(x), self.find(y)
        if px == py:
            return False
        # Union by rank
        if self.rank[px] < self.rank[py]:
            px, py = py, px
        self.parent[py] = px
        if self.rank[px] == self.rank[py]:
            self.rank[px] += 1
        self.components -= 1
        return True

    def connected(self, x, y):
        return self.find(x) == self.find(y)
```

### Complexity
- Find: O(α(n)) ≈ O(1)
- Union: O(α(n)) ≈ O(1)
- Space: O(n)

### Example Problems

**Number of Connected Components**
```python
def countComponents(n, edges):
    uf = UnionFind(n)
    for u, v in edges:
        uf.union(u, v)
    return uf.components
```

**Graph Valid Tree**
```python
def validTree(n, edges):
    if len(edges) != n - 1:
        return False
    uf = UnionFind(n)
    for u, v in edges:
        if not uf.union(u, v):
            return False  # Cycle detected
    return True
```

**Redundant Connection**
```python
def findRedundantConnection(edges):
    uf = UnionFind(len(edges) + 1)
    for u, v in edges:
        if not uf.union(u, v):
            return [u, v]
```

---

## Part 9: Dijkstra Deep Dive

### When to Use Dijkstra

1. **Shortest path** with non-negative weights
2. **Network delay time**
3. **Cheapest flights**
4. **Path with maximum probability** (negate weights)

### The Algorithm

```python
import heapq
from collections import defaultdict

def dijkstra(graph, start):
    # graph = {node: [(neighbor, weight), ...]}
    heap = [(0, start)]
    dist = {}

    while heap:
        d, node = heapq.heappop(heap)
        if node in dist:
            continue
        dist[node] = d
        for neighbor, weight in graph[node]:
            if neighbor not in dist:
                heapq.heappush(heap, (d + weight, neighbor))

    return dist
```

### Complexity
- Time: O((V + E) log V)
- Space: O(V + E)

### Example Problems

**Network Delay Time**
```python
def networkDelayTime(times, n, k):
    graph = defaultdict(list)
    for u, v, w in times:
        graph[u].append((v, w))

    heap = [(0, k)]
    dist = {}

    while heap:
        d, node = heapq.heappop(heap)
        if node in dist:
            continue
        dist[node] = d
        for neighbor, weight in graph[node]:
            if neighbor not in dist:
                heapq.heappush(heap, (d + weight, neighbor))

    return max(dist.values()) if len(dist) == n else -1
```

**Cheapest Flights Within K Stops**
```python
def findCheapestPrice(n, flights, src, dst, k):
    graph = defaultdict(list)
    for u, v, w in flights:
        graph[u].append((v, w))

    # (cost, node, stops)
    heap = [(0, src, 0)]
    # (node, stops) -> cost
    visited = {}

    while heap:
        cost, node, stops = heapq.heappop(heap)
        if node == dst:
            return cost
        if stops > k:
            continue
        if (node, stops) in visited and visited[(node, stops)] <= cost:
            continue
        visited[(node, stops)] = cost
        for neighbor, price in graph[node]:
            heapq.heappush(heap, (cost + price, neighbor, stops + 1))

    return -1
```

---

## Summary

### The Key Takeaways

1. **Use the 7-step framework** — Every time, no exceptions
2. **Learn Python built-ins** — Counter, defaultdict, deque, heapq, bisect
3. **Master the patterns** — Hash Map, Two Pointers, Sliding Window, Binary Search, BFS/DFS, Stack, Heap, DP, Union-Find, Dijkstra
4. **Practice, practice, practice** — 2 hours daily for 2 weeks
5. **Review solutions** — Learn from every problem

### The Mindset

- **Don't memorize solutions** — Learn patterns
- **Don't rush** — Spend time planning
- **Don't give up** — Struggle is learning
- **Don't skip review** — Learn from mistakes
- **Do practice daily** — Consistency beats intensity

---

*Generated: 2026-06-16*
*Goal: Pass medium-level coding tests in 2 weeks*
