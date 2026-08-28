# Big O Notation — Complexity Analysis

## Why Big O Matters in Interviews

Interviewers ask: "What's the time/space complexity?" after every solution. If you can't answer, you lose points even if your code works.

Big O tells you **how your solution scales** as input grows.

---

## The Cheat Sheet

| Big O | Name | Example |
|-------|------|---------|
| O(1) | Constant | Hash map lookup, array access by index |
| O(log n) | Logarithmic | Binary search |
| O(n) | Linear | Single loop through array |
| O(n log n) | Linearithmic | Merge sort, Tim sort |
| O(n²) | Quadratic | Nested loops |
| O(2ⁿ) | Exponential | Recursive Fibonacci (naive) |
| O(n!) | Factorial | Generate all permutations |

## How to Calculate: The Rules

### Rule 1: Drop Constants
```python
# O(2n) → O(n)
for i in arr:
    print(i)
for i in arr:
    print(i)

# O(n + 5) → O(n)
for i in arr:
    print(i)
print("done")
```

### Rule 2: Drop Non-Dominant Terms
```python
# O(n² + n) → O(n²)
for i in arr:
    for j in arr:
        print(i, j)
for i in arr:
    print(i)
```

### Rule 3: Different Inputs = Different Variables
```python
# O(a + b) — NOT O(n)
for i in arr_a:
    print(i)
for j in arr_b:
    print(j)

# O(a * b) — NOT O(n²)
for i in arr_a:
    for j in arr_b:
        print(i, j)
```

### Rule 4: Nested Loops Multiply
```python
# O(n²)
for i in arr:
    for j in arr:
        print(i, j)

# O(n * m)
for i in arr_a:
    for j in arr_b:
        print(i, j)
```

---

## Common Patterns and Their Complexities

### Pattern: Hash Map Lookup
```python
seen = {}  # O(n) space
for num in arr:  # O(n) time
    if target - num in seen:  # O(1) lookup
        return [seen[target - num], i]
    seen[num] = i
```
**Time: O(n) | Space: O(n)**

### Pattern: Two Pointers
```python
left, right = 0, len(arr) - 1
while left < right:  # O(n) — each pointer moves at most n times
    if arr[left] + arr[right] == target:
        return [left, right]
    elif arr[left] + arr[right] < target:
        left += 1
    else:
        right -= 1
```
**Time: O(n) | Space: O(1)**

### Pattern: Sorting
```python
arr.sort()  # O(n log n)
```
**Time: O(n log n) | Space: O(1) or O(n)**

### Pattern: Binary Search
```python
left, right = 0, len(arr) - 1
while left <= right:  # O(log n) — halves search space each step
    mid = (left + right) // 2
    if arr[mid] == target:
        return mid
    elif arr[mid] < target:
        left = mid + 1
    else:
        right = mid - 1
```
**Time: O(log n) | Space: O(1)**

### Pattern: Nested Loops (Same Array)
```python
for i in range(len(arr)):
    for j in range(i + 1, len(arr)):  # j starts from i+1
        if arr[i] + arr[j] == target:
            return [i, j]
```
**Time: O(n²) | Space: O(1)**

### Pattern: Counter / Frequency Map
```python
from collections import Counter
count = Counter(arr)  # O(n) to build
count.most_common(k)  # O(n log k) for heap-based
```
**Time: O(n) to build | Space: O(n)**

---

## Space Complexity

### Rule: Count What You Store
```python
# O(n) space — storing up to n elements
seen = set()
for num in arr:
    seen.add(num)

# O(1) space — only storing pointers
left, right = 0, len(arr) - 1

# O(n) space — building new array
result = [x * 2 for x in arr]
```

### Common Space Complexities
| Pattern | Space |
|---------|-------|
| Variables only | O(1) |
| Hash map/set of n items | O(n) |
| New array of n items | O(n) |
| Recursion depth n | O(n) |
| 2D array n×n | O(n²) |

---

## Interview Cheat Sheet

When asked "What's the complexity?":

1. **Count the loops** — each loop = multiply by n
2. **Check for hash lookups** — O(1) each
3. **Check for sorting** — O(n log n)
4. **Count what you store** — space complexity

### Quick Reference
- Single loop → O(n)
- Nested loops → O(n²)
- Binary search → O(log n)
- Hash map operations → O(1) per operation
- Sorting → O(n log n)
- Building hash map from array → O(n) time, O(n) space
