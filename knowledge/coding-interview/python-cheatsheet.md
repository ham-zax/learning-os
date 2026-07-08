# Python Interview Cheat Sheet

## Data Structures

### Hash Map (Dictionary)
```python
d = {}
d[key] = value
if key in d: ...
for k, v in d.items(): ...
d.get(key, default)
d.pop(key, default)
```

### Stack (List)
```python
stack = []
stack.append(x)    # push
x = stack.pop()    # pop
top = stack[-1]    # peek
len(stack)         # size
```

### Queue (deque)
```python
from collections import deque
q = deque()
q.append(x)        # enqueue right
x = q.popleft()    # dequeue left
q.appendleft(x)    # enqueue left
x = q.pop()        # dequeue right
```

### Heap (Priority Queue)
```python
import heapq
heap = []
heapq.heappush(heap, x)
x = heapq.heappop(heap)
heapq.heapify(arr)       # O(n)
heapq.nlargest(k, arr)   # top k
heapq.nsmallest(k, arr)  # bottom k
# Max-heap: negate values
```

### Default Dict
```python
from collections import defaultdict
d = defaultdict(int)      # default 0
d = defaultdict(list)     # default []
d = defaultdict(set)      # default set()
d[key].append(value)      # no KeyError
```

### Counter
```python
from collections import Counter
c = Counter(arr)          # count occurrences
c = Counter("aabbcc")    # {'a':2, 'b':2, 'c':2}
c.most_common(k)          # top k
c.update(arr)             # add counts
```

### Set
```python
s = set()
s.add(x)
s.remove(x)       # KeyError if missing
s.discard(x)      # no error if missing
if x in s: ...
s1 & s2           # intersection
s1 | s2           # union
s1 - s2           # difference
```

## Common Operations

### List
```python
arr.sort()                    # in-place, O(n log n)
arr.sort(key=lambda x: x[1]) # custom key
sorted(arr)                   # returns new list
arr.reverse()                 # in-place
arr[::-1]                     # reversed copy
len(arr)
arr.append(x)
arr.pop()                     # last element
arr.insert(0, x)              # O(n)
```

### String
```python
s.split()           # by whitespace
s.split(',')        # by delimiter
''.join(arr)        # join list
s.strip()           # remove whitespace
s.lower() / s.upper()
s.startswith('x') / s.endswith('x')
s.count('x')
s.find('x')         # -1 if not found
s.replace(old, new)
```

### Binary Search
```python
import bisect
idx = bisect.bisect_left(arr, target)    # leftmost insertion point
idx = bisect.bisect_right(arr, target)   # rightmost insertion point
```

### Enumerate + Zip
```python
for i, val in enumerate(arr): ...
for a, b in zip(arr1, arr2): ...
for i, (a, b) in enumerate(zip(arr1, arr2)): ...
```

### Matrix
```python
# Create 2D array
matrix = [[0] * cols for _ in range(rows)]  # NOT [[0]*cols]*rows

# Directions
dirs = [(0,1), (0,-1), (1,0), (-1,0)]  # right, left, down, up

# Bounds check
if 0 <= r < rows and 0 <= c < cols: ...
```

## Complexity Cheat Sheet

| Operation | Array | Hash Map | Set | Heap |
|-----------|-------|----------|-----|------|
| Access | O(1) | O(1) | N/A | N/A |
| Search | O(n) | O(1) | O(1) | O(n) |
| Insert | O(1)* | O(1) | O(1) | O(log n) |
| Delete | O(n) | O(1) | O(1) | O(log n) |
| Sort | O(n log n) | N/A | N/A | N/A |

*At end; O(n) at arbitrary position

## Node Definitions

### Tree
```python
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right
```

### Linked List
```python
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next
```

### Graph (Adjacency List)
```python
graph = defaultdict(list)
graph[node].append(neighbor)
```

## Template: BFS (Level Order)
```python
from collections import deque

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
```

## Template: DFS (Recursive)
```python
def dfs(node, result):
    if not node:
        return
    # Pre-order: process before children
    result.append(node.val)
    dfs(node.left, result)
    dfs(node.right, result)
    # In-order: process between children
    # Post-order: process after children
```

## Template: Binary Search
```python
def binary_search(arr, target):
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
```

## Template: Sliding Window
```python
def sliding_window(arr, k):
    window_sum = sum(arr[:k])
    max_sum = window_sum
    for i in range(k, len(arr)):
        window_sum += arr[i] - arr[i - k]
        max_sum = max(max_sum, window_sum)
    return max_sum
```

## Template: Two Pointers
```python
def two_sum_sorted(arr, target):
    left, right = 0, len(arr) - 1
    while left < right:
        curr = arr[left] + arr[right]
        if curr == target:
            return [left, right]
        elif curr < target:
            left += 1
        else:
            right -= 1
    return []
```
