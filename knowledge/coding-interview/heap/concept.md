# Heaps / Priority Queues

## Summary
A heap is a tree-based data structure that gives you O(log n) insert and O(log n) remove-min/max. In coding interviews, heaps solve three families of problems: **finding the k-th element**, **merging sorted sequences**, and **maintaining a running statistic** (like median). The key insight: **when you need repeated access to the min or max of a changing collection, use a heap**.

## Key Points

1. **Python only has min-heap** — `heapq` implements a min-heap. To simulate a max-heap, negate values when pushing/popping: `heappush(h, -val)`, then `-heappop(h)`
2. **`heapq` operates on plain lists** — no separate class; `heapq.heappush(lst, item)` and `heapq.heappop(lst)` mutate a list in-place
3. **Heap vs Sorting** — Sorting is O(n log n) once; a heap is O(log n) per operation. Use a heap when you process elements incrementally or only need the top-k, not the full sorted order
4. **Two-heap trick** — Split a stream into a max-heap (lower half) and min-heap (upper half) to get O(log n) median
5. **Tuple ordering** — Python compares tuples lexicographically, so push `(priority, count, item)` to break ties cleanly

## Time Complexities

| Operation | Heap |
|-----------|------|
| Push | O(log n) |
| Pop (min/max) | O(log n) |
| Peek (min/max) | O(1) |
| Heapify (build from list) | O(n) |
| Heapreplace (pop + push) | O(log n) |
| nlargest / nsmallest | O(n + k log n) |

## Common Patterns

### Pattern 1: Kth Largest / Smallest (heap of size k)
Maintain a heap of exactly k elements. For k-th largest, use a **min-heap** of size k — the root is the answer.

```python
import heapq

def find_kth_largest(nums, k):
    min_heap = []
    for num in nums:
        heapq.heappush(min_heap, num)
        if len(min_heap) > k:
            heapq.heappop(min_heap)  # remove smallest, keep k largest
    return min_heap[0]  # root is k-th largest
```

For k-th smallest, use a **max-heap** (negate values) of size k.

### Pattern 2: Top K Frequent (Counter + heap)
Count frequencies first, then use a heap to pick the top k.

```python
import heapq
from collections import Counter

def top_k_frequent(nums, k):
    count = Counter(nums)
    # nlargest returns k largest by key; O(n log k)
    return heapq.nlargest(k, count.keys(), key=count.get)
```

Alternative: bucket sort gives O(n) but heap approach is cleaner and sufficient in interviews.

### Pattern 3: Merge K Sorted Lists (min-heap with k elements)
Push the head of each list into a min-heap. Pop the smallest, push its next node.

```python
import heapq

def merge_k_sorted(lists):
    heap = []
    for i, lst in enumerate(lists):
        if lst:
            heapq.heappush(heap, (lst[0], i, 0))  # (val, list_idx, elem_idx)

    result = []
    while heap:
        val, list_idx, elem_idx = heapq.heappop(heap)
        result.append(val)
        if elem_idx + 1 < len(lists[list_idx]):
            next_val = lists[list_idx][elem_idx + 1]
            heapq.heappush(heap, (next_val, list_idx, elem_idx + 1))
    return result
```

For linked lists, push `(node.val, tie_breaker, node)` and advance `node = node.next`.

### Pattern 4: Running Median (two heaps)
Max-heap holds the lower half, min-heap holds the upper half. Rebalance so their sizes differ by at most 1.

```python
import heapq

class MedianFinder:
    def __init__(self):
        self.lo = []  # max-heap (negated values)
        self.hi = []  # min-heap

    def add_num(self, num):
        heapq.heappush(self.lo, -num)          # push to max-heap
        heapq.heappush(self.hi, -heapq.heappop(self.lo))  # balance
        if len(self.hi) > len(self.lo):        # keep lo >= hi in size
            heapq.heappush(self.lo, -heapq.heappop(self.hi))

    def find_median(self):
        if len(self.lo) > len(self.hi):
            return -self.lo[0]
        return (-self.lo[0] + self.hi[0]) / 2
```

## Common Mistakes

1. **Forgetting Python is min-heap only** — `heapq.heappush(h, val)` always makes val smallest. For max-heap, negate: `heappush(h, -val)`
2. **Pushing a list into a heap** — Elements must be comparable. If items have the same value, use a tuple with a unique tiebreaker: `(val, index, item)`
3. **Not checking for empty heap** — `heappop([])` raises IndexError. Guard with `if h:` or `if len(h) > 0`
4. **Using heap when sort is simpler** — If you need all elements sorted once, just use `sorted()`. Heap is for incremental access
5. **Mutating heap elements** — Don't modify items after pushing; the heap invariant breaks silently
6. **Confusing nlargest with nth element** — `nlargest(k, nums)` returns a list of k items; index `[0]` gives the largest, `[-1]` gives the k-th largest

## Practice Problems

| Problem | Difficulty | Pattern |
|---------|-----------|---------|
| Kth Largest Element in a Stream | Easy | Pattern 1 (heap of size k) |
| Last Stone Weight | Easy | Pattern 1 (max-heap, simulate) |
| Top K Frequent Elements | Medium | Pattern 2 (Counter + heap) |
| Kth Largest Element in an Array | Medium | Pattern 1 (heap of size k) |
| Merge K Sorted Lists | Hard | Pattern 3 (min-heap merge) |
| Find Median from Data Stream | Hard | Pattern 4 (two heaps) |
| K Closest Points to Origin | Medium | Pattern 1 (heap of size k) |
| Task Scheduler | Medium | Pattern 2 (Counter + heap) |
