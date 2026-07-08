# Python Built-ins for Coding Interviews — Complete Guide

**Goal:** Know these so well you can use them without thinking. No web search needed.

---

## 1. collections.Counter — Count Frequencies

### What It Does
Counts how many times each element appears.

```python
from collections import Counter

# Count characters
count = Counter("aabbc")  # Counter({'a': 2, 'b': 2, 'c': 1})

# Count array elements
count = Counter([1, 1, 2, 2, 3])  # Counter({1: 2, 2: 2, 3: 1})

# Access counts (no KeyError for missing keys!)
count['a']  # 2
count['z']  # 0

# Most common elements
count.most_common(2)  # [('a', 2), ('b', 2)]

# Update counts
count.update([1, 1, 1])  # Counter({1: 5, 2: 2, 3: 1})

# Subtract counts
count.subtract([1, 1])  # Counter({1: 3, 2: 2, 3: 1})

# Arithmetic
c1 = Counter(a=3, b=1)
c2 = Counter(a=1, b=2)
c1 + c2  # Counter({'a': 4, 'b': 3})
c1 - c2  # Counter({'a': 2})  (only positive)
c1 & c2  # Counter({'a': 1, 'b': 1})  (min)
c1 | c2  # Counter({'a': 3, 'b': 2})  (max)
```

### When to Use
- Counting frequencies
- Finding most/least common elements
- Comparing two collections (anagram check)
- Character frequency problems

### Example: Valid Anagram
```python
def isAnagram(s: str, t: str) -> bool:
    return Counter(s) == Counter(t)
```

### Example: Top K Frequent
```python
def topKFrequent(nums: list[int], k: int) -> list[int]:
    return [x for x, _ in Counter(nums).most_common(k)]
```

### Example: Character Replacement
```python
def characterReplacement(s: str, k: int) -> int:
    count = Counter()
    left = 0
    max_freq = 0
    result = 0

    for right in range(len(s)):
        count[s[right]] += 1
        max_freq = max(max_freq, count[s[right]])

        # Window size - max_freq > k means too many replacements
        if (right - left + 1) - max_freq > k:
            count[s[left]] -= 1
            left += 1

        result = max(result, right - left + 1)

    return result
```

---

## 2. collections.defaultdict — Auto-Create Missing Keys

### What It Does
Like a regular dict, but creates a default value when accessing a missing key.

```python
from collections import defaultdict

# Default value is 0
d = defaultdict(int)
d['a'] += 1  # No KeyError! d = {'a': 1}

# Default value is empty list
d = defaultdict(list)
d['a'].append(1)  # d = {'a': [1]}

# Default value is empty set
d = defaultdict(set)
d['a'].add(1)  # d = {'a': {1}}

# Default value from lambda
d = defaultdict(lambda: "default")
d['a']  # "default"
```

### When to Use
- Grouping elements
- Building adjacency lists
- Accumulating values
- Any time you'd check `if key not in dict`

### Example: Group Anagrams
```python
def groupAnagrams(strs: list[str]) -> list[list[str]]:
    groups = defaultdict(list)
    for s in strs:
        key = tuple(sorted(s))
        groups[key].append(s)
    return list(groups.values())
```

### Example: Two Sum (Alternative)
```python
def twoSum(nums: list[int], target: int) -> list[int]:
    seen = defaultdict(int)
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []
```

### Example: Adjacency List for Graph
```python
def build_graph(edges):
    graph = defaultdict(list)
    for u, v in edges:
        graph[u].append(v)
        graph[v].append(u)  # Undirected
    return graph
```

---

## 3. collections.deque — Double-Ended Queue

### What It Does
O(1) append/pop from both ends (list is O(n) for pop(0)).

```python
from collections import deque

q = deque()
q.append(1)      # Add to right: [1]
q.append(2)      # Add to right: [1, 2]
q.appendleft(0)  # Add to left:  [0, 1, 2]
q.pop()          # Remove from right: [0, 1]
q.popleft()      # Remove from left:  [1]

# Max length (auto-removes from opposite end)
q = deque(maxlen=3)
q.append(1)  # [1]
q.append(2)  # [1, 2]
q.append(3)  # [1, 2, 3]
q.append(4)  # [2, 3, 4] (1 is dropped)

# Initialize with values
q = deque([1, 2, 3])

# Rotate
q = deque([1, 2, 3, 4, 5])
q.rotate(2)    # [4, 5, 1, 2, 3]
q.rotate(-2)   # [1, 2, 3, 4, 5]
```

### When to Use
- BFS (breadth-first search)
- Sliding window maximum
- Queue operations
- Any time you need O(1) pop from left

### Example: BFS
```python
from collections import deque

def bfs(graph, start):
    visited = set()
    queue = deque([start])
    visited.add(start)

    while queue:
        node = queue.popleft()
        # Process node
        for neighbor in graph[node]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)
```

### Example: Sliding Window Maximum
```python
from collections import deque

def maxSlidingWindow(nums: list[int], k: int) -> list[int]:
    dq = deque()  # Store indices
    result = []

    for i, num in enumerate(nums):
        # Remove indices outside window
        while dq and dq[0] < i - k + 1:
            dq.popleft()

        # Remove smaller elements (they're useless)
        while dq and nums[dq[-1]] < num:
            dq.pop()

        dq.append(i)

        if i >= k - 1:
            result.append(nums[dq[0]])

    return result
```

---

## 4. heapq — Priority Queue (Min-Heap)

### What It Does
Always gives you the smallest element in O(log n) time.

```python
import heapq

# Create heap
heap = [3, 1, 4, 1, 5]
heapq.heapify(heap)  # O(n)

# Push and pop
heapq.heappush(heap, 2)  # O(log n)
smallest = heapq.heappop(heap)  # O(log n)

# Peek (without removing)
smallest = heap[0]  # O(1)

# Push and pop together
result = heapq.heappushpop(heap, 10)  # Push 10, pop smallest

# Get k largest/smallest
k_largest = heapq.nlargest(3, heap)  # O(n + k log n)
k_smallest = heapq.nsmallest(3, heap)

# Heap with custom key
heap = []
heapq.heappush(heap, (priority, item))
```

### Max-Heap Trick
Python only has min-heap. For max-heap, negate values.

```python
# Max-heap
max_heap = []
heapq.heappush(max_heap, -value)  # Negate when pushing
max_val = -heapq.heappop(max_heap)  # Negate when popping
```

### When to Use
- Finding kth largest/smallest element
- Merging sorted lists
- Priority-based processing
- Dijkstra's algorithm
- Task scheduling

### Example: Kth Largest Element
```python
import heapq

def findKthLargest(nums: list[int], k: int) -> int:
    return heapq.nlargest(k, nums)[-1]
```

### Example: Top K Frequent (Heap Version)
```python
import heapq
from collections import Counter

def topKFrequent(nums: list[int], k: int) -> list[int]:
    count = Counter(nums)
    return heapq.nlargest(k, count.keys(), key=count.get)
```

### Example: Merge K Sorted Lists
```python
import heapq

def mergeKSortedLists(lists):
    heap = []
    for i, lst in enumerate(lists):
        if lst:
            heapq.heappush(heap, (lst[0], i, 0))

    result = []
    while heap:
        val, list_idx, elem_idx = heapq.heappop(heap)
        result.append(val)
        if elem_idx + 1 < len(lists[list_idx]):
            next_val = lists[list_idx][elem_idx + 1]
            heapq.heappush(heap, (next_val, list_idx, elem_idx + 1))

    return result
```

---

## 5. bisect — Binary Search on Sorted Lists

### What It Does
Binary search for insertion points.

```python
import bisect

arr = [1, 3, 5, 7, 9]

# Find insertion point (leftmost)
bisect.bisect_left(arr, 5)  # 2
bisect.bisect_left(arr, 6)  # 3

# Find insertion point (rightmost)
bisect.bisect_right(arr, 5)  # 3
bisect.bisect_right(arr, 6)  # 3

# Insert while maintaining sorted order
bisect.insort(arr, 6)  # arr = [1, 3, 5, 6, 7, 9]

# Check if element exists
idx = bisect.bisect_left(arr, 5)
exists = idx < len(arr) and arr[idx] == 5
```

### When to Use
- Binary search on sorted list
- Finding insertion point
- Maintaining sorted order
- Finding closest element

### Example: Search Insert Position
```python
import bisect

def searchInsert(nums: list[int], target: int) -> int:
    return bisect.bisect_left(nums, target)
```

### Example: Find Closest Element
```python
import bisect

def findClosest(arr, target):
    idx = bisect.bisect_left(arr, target)
    if idx == 0:
        return arr[0]
    if idx == len(arr):
        return arr[-1]
    before = arr[idx - 1]
    after = arr[idx]
    if after - target < target - before:
        return after
    return before
```

---

## 6. itertools — Combinations and Permutations

### What It Does
Generate combinations and permutations.

```python
import itertools

# Permutations (order matters)
list(itertools.permutations([1, 2, 3], 2))
# [(1, 2), (1, 3), (2, 1), (2, 3), (3, 1), (3, 2)]

# Combinations (order doesn't matter)
list(itertools.combinations([1, 2, 3], 2))
# [(1, 2), (1, 3), (2, 3)]

# Combinations with replacement
list(itertools.combinations_with_replacement([1, 2], 2))
# [(1, 1), (1, 2), (2, 2)]

# Cartesian product
list(itertools.product([1, 2], ['a', 'b']))
# [(1, 'a'), (1, 'b'), (2, 'a'), (2, 'b')]

# Chain iterables
list(itertools.chain([1, 2], [3, 4]))
# [1, 2, 3, 4]
```

### When to Use
- Generating all subsets
- Generating all permutations
- Brute force solutions
- Backtracking problems

---

## 7. sorted() with key — Custom Sorting

### What It Does
Sort with custom key function.

```python
# Sort by absolute value
arr = [-3, 1, -2, 5]
sorted(arr, key=abs)  # [1, -2, -3, 5]

# Sort by second element
pairs = [(1, 'b'), (2, 'a'), (3, 'c')]
sorted(pairs, key=lambda x: x[1])  # [(2, 'a'), (1, 'b'), (3, 'c')]

# Sort by multiple criteria
students = [('Alice', 90), ('Bob', 85), ('Charlie', 90)]
sorted(students, key=lambda x: (-x[1], x[0]))
# [('Alice', 90), ('Charlie', 90), ('Bob', 85)]

# Reverse sort
sorted(arr, reverse=True)

# Sort strings by length
words = ["apple", "hi", "banana"]
sorted(words, key=len)  # ["hi", "apple", "banana"]
```

---

## 8. Other Useful Built-ins

### enumerate — Index + Value
```python
for i, val in enumerate(arr):
    print(f"Index {i}: {val}")

# Start from 1
for i, val in enumerate(arr, 1):
    print(f"#{i}: {val}")
```

### zip — Parallel Iteration
```python
names = ["Alice", "Bob"]
scores = [90, 85]
for name, score in zip(names, scores):
    print(f"{name}: {score}")

# Unzip
pairs = [(1, 'a'), (2, 'b')]
nums, letters = zip(*pairs)
```

### any() and all()
```python
any([False, True, False])  # True
all([True, True, False])   # False

# Check if any element satisfies condition
any(x > 5 for x in arr)
all(x > 0 for x in arr)
```

### map() and filter()
```python
# Apply function to all elements
list(map(int, ["1", "2", "3"]))  # [1, 2, 3]

# Filter elements
list(filter(lambda x: x > 0, [-1, 2, -3, 4]))  # [2, 4]
```

### max() and min() with key
```python
max(arr, key=lambda x: x[1])  # Max by second element
min(arr, key=lambda x: x[0])  # Min by first element
```

### sum() with generator
```python
sum(x for x in arr if x > 0)  # Sum of positive numbers
```

---

## Quick Reference Table

| Task | Function | Example |
|------|----------|---------|
| Count frequencies | Counter | Counter(arr) |
| Group elements | defaultdict | defaultdict(list) |
| BFS queue | deque | deque([start]) |
| Priority queue | heapq | heappush/pop |
| Binary search | bisect | bisect_left(arr, x) |
| Combinations | itertools | combinations(arr, k) |
| Custom sort | sorted(key=) | sorted(arr, key=lambda) |
| Parallel loop | zip | zip(arr1, arr2) |
| Index + value | enumerate | enumerate(arr) |
| Any/All check | any/all | any(x > 0 for x in arr) |

---

## Practice Problems Using These Built-ins

### Problem 1: Top K Frequent (Counter + heapq)
```python
import heapq
from collections import Counter

def topKFrequent(nums: list[int], k: int) -> list[int]:
    count = Counter(nums)
    return heapq.nlargest(k, count.keys(), key=count.get)
```

### Problem 2: Group Anagrams (defaultdict)
```python
from collections import defaultdict

def groupAnagrams(strs: list[str]) -> list[list[str]]:
    groups = defaultdict(list)
    for s in strs:
        key = tuple(sorted(s))
        groups[key].append(s)
    return list(groups.values())
```

### Problem 3: Sliding Window Maximum (deque)
```python
from collections import deque

def maxSlidingWindow(nums: list[int], k: int) -> list[int]:
    dq = deque()
    result = []
    for i, num in enumerate(nums):
        while dq and dq[0] < i - k + 1:
            dq.popleft()
        while dq and nums[dq[-1]] < num:
            dq.pop()
        dq.append(i)
        if i >= k - 1:
            result.append(nums[dq[0]])
    return result
```

### Problem 4: Kth Largest (heapq)
```python
import heapq

def findKthLargest(nums: list[int], k: int) -> int:
    return heapq.nlargest(k, nums)[-1]
```

### Problem 5: Search Insert Position (bisect)
```python
import bisect

def searchInsert(nums: list[int], target: int) -> int:
    return bisect.bisect_left(nums, target)
```

---

*Generated: 2026-06-16*
