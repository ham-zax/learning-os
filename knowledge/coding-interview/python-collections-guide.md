# Python Collections for Coding Interviews

## Why Collections Matter

Python's `collections` module gives you powerful data structures that solve problems in fewer lines with better complexity.

---

## 1. Counter — Count Occurrences

### What It Does
Counts how many times each element appears.

```python
from collections import Counter

# Count characters
count = Counter("aabbc")  # Counter({'a': 2, 'b': 2, 'c': 1})

# Count array elements
count = Counter([1, 1, 2, 2, 3])  # Counter({1: 2, 2: 2, 3: 1})

# Access counts
count['a']  # 2
count['z']  # 0 (no KeyError!)

# Most common elements
count.most_common(2)  # [('a', 2), ('b', 2)]

# Update counts
count.update([1, 1, 1])  # Counter({1: 5, 2: 2, 3: 1})
```

### Time Complexity
- Build: O(n)
- Lookup: O(1)
- most_common(k): O(n log k)

### When to Use
- Counting frequencies
- Finding most/least common elements
- Comparing two collections

### Example: Valid Anagram
```python
def isAnagram(s: str, t: str) -> bool:
    return Counter(s) == Counter(t)
# Time: O(n) | Space: O(n)
```

### Example: Top K Frequent Elements
```python
def topKFrequent(nums: list[int], k: int) -> list[int]:
    count = Counter(nums)
    return [x for x, _ in count.most_common(k)]
# Time: O(n log k) | Space: O(n)
```

---

## 2. defaultdict — Auto-Create Missing Keys

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
```

### When to Use
- Grouping elements
- Building adjacency lists
- Accumulating values

### Example: Group Anagrams
```python
def groupAnagrams(strs: list[str]) -> list[list[str]]:
    groups = defaultdict(list)
    for s in strs:
        key = tuple(sorted(s))  # or use Counter as key
        groups[key].append(s)
    return list(groups.values())
# Time: O(n * k log k) | Space: O(n)
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
# Time: O(n) | Space: O(n)
```

---

## 3. deque — Double-Ended Queue

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

# Max length
q = deque(maxlen=3)
q.append(1)  # [1]
q.append(2)  # [1, 2]
q.append(3)  # [1, 2, 3]
q.append(4)  # [2, 3, 4] (1 is dropped)
```

### When to Use
- BFS (breadth-first search)
- Sliding window
- Queue operations

### Example: Sliding Window Maximum
```python
from collections import deque

def maxSlidingWindow(nums: list[int], k: int) -> list[int]:
    dq = deque()
    result = []
    
    for i, num in enumerate(nums):
        # Remove elements outside window
        while dq and dq[0] < i - k + 1:
            dq.popleft()
        
        # Remove smaller elements (they're useless)
        while dq and nums[dq[-1]] < num:
            dq.pop()
        
        dq.append(i)
        
        if i >= k - 1:
            result.append(nums[dq[0]])
    
    return result
# Time: O(n) | Space: O(k)
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
heapq.heappushpop(heap, 10)  # Push 10, pop smallest

# Get k largest/smallest
k_largest = heapq.nlargest(3, heap)  # O(n + k log n)
k_smallest = heapq.nsmallest(3, heap)
```

### When to Use
- Finding kth largest/smallest element
- Merging sorted lists
- Priority-based processing

### Example: Kth Largest Element
```python
import heapq

def findKthLargest(nums: list[int], k: int) -> int:
    return heapq.nlargest(k, nums)[-1]
# Time: O(n + k log n) | Space: O(k)
```

### Example: Top K Frequent (Heap Version)
```python
import heapq
from collections import Counter

def topKFrequent(nums: list[int], k: int) -> list[int]:
    count = Counter(nums)
    return heapq.nlargest(k, count.keys(), key=count.get)
# Time: O(n + k log n) | Space: O(n)
```

---

## 5. OrderedDict — Dict That Remembers Order

### What It Does
Like a regular dict, but maintains insertion order (Python 3.7+ dicts do this too, but OrderedDict has extra methods).

```python
from collections import OrderedDict

d = OrderedDict()
d['a'] = 1
d['b'] = 2
d['c'] = 3

# Move to end
d.move_to_end('a')  # {'b': 2, 'c': 3, 'a': 1}

# Move to beginning
d.move_to_end('a', last=False)  # {'a': 1, 'b': 2, 'c': 3}
```

### When to Use
- LRU Cache implementation
- When you need to reorder keys

---

## 6. ChainMap — Merge Multiple Dicts

### What It Does
Combines multiple dicts into one view.

```python
from collections import ChainMap

d1 = {'a': 1, 'b': 2}
d2 = {'b': 3, 'c': 4}

merged = ChainMap(d1, d2)
print(merged['a'])  # 1 (from d1)
print(merged['b'])  # 2 (from d1, first match)
print(merged['c'])  # 4 (from d2)
```

### When to Use
- Merging configurations
- Scoping (like variable lookup)

---

## Quick Reference Table

| Collection | Use Case | Time Complexity |
|------------|----------|-----------------|
| Counter | Count frequencies | O(n) build, O(1) lookup |
| defaultdict | Group elements | O(1) access |
| deque | Queue/Stack | O(1) append/pop both ends |
| heapq | Priority queue | O(log n) push/pop |
| OrderedDict | Ordered dict with reorder | O(1) access |
| ChainMap | Merge dicts | O(1) access |

---

## Practice Problems Using Collections

### Problem 1: Contains Duplicate (Counter)
```python
from collections import Counter

def containsDuplicate(nums: list[int]) -> bool:
    count = Counter(nums)
    return any(v > 1 for v in count.values())
```

### Problem 2: Valid Anagram (Counter)
```python
from collections import Counter

def isAnagram(s: str, t: str) -> bool:
    return Counter(s) == Counter(t)
```

### Problem 3: Group Anagrams (defaultdict)
```python
from collections import defaultdict

def groupAnagrams(strs: list[str]) -> list[list[str]]:
    groups = defaultdict(list)
    for s in strs:
        key = tuple(sorted(s))
        groups[key].append(s)
    return list(groups.values())
```

### Problem 4: Top K Frequent (Counter + heapq)
```python
import heapq
from collections import Counter

def topKFrequent(nums: list[int], k: int) -> list[int]:
    count = Counter(nums)
    return heapq.nlargest(k, count.keys(), key=count.get)
```

### Problem 5: Two Sum (defaultdict)
```python
from collections import defaultdict

def twoSum(nums: list[int], target: int) -> list[int]:
    seen = defaultdict(int)
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []
```

---

## The Pattern: When to Use What

```
Need to count? → Counter
Need to group? → defaultdict
Need a queue? → deque
Need priority? → heapq
Need order? → OrderedDict
Need to merge? → ChainMap
```
