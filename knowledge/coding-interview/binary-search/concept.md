# Binary Search

## Summary
Binary search is a divide-and-conquer algorithm that repeatedly halves the search space. It works on **sorted arrays** or any **monotonic search space** where you can decide which half to discard. The key insight: **if you can eliminate half the candidates per step, you get O(log n) time**. Beyond sorted arrays, binary search applies to any "find the minimum/maximum value that satisfies a condition" problem (search-on-answer).

## Key Points

1. **Search Space Reduction** — Each step cuts the problem in half. 1 billion elements takes only ~30 steps.
2. **Left/Right Boundaries** — `left` and `right` define the current candidate range. Decide: is `right` inclusive or exclusive?
3. **Mid Calculation** — Use `left + (right - left) // 2` instead of `(left + right) // 2` to avoid integer overflow in languages with fixed-width ints. In Python this doesn't matter (arbitrary precision), but it's good habit.
4. **Search-on-Answer Pattern** — When the answer is a number and you can check "is X enough?" in O(n), binary search on the answer space for O(n log n).
5. **Boundary Update Matters** — `left = mid + 1` vs `left = mid` determines whether you get `bisect_left` or `bisect_right` behavior. Get this wrong and you get infinite loops.

## Time Complexities
| Operation | Complexity |
|-----------|------------|
| Binary search (sorted array) | O(log n) |
| Binary search + sorting first | O(n log n) |
| Search-on-answer (check is O(n)) | O(n log n) |
| Search-on-answer (check is O(1)) | O(log n) |

Space: O(1) iterative, O(log n) recursive (call stack).

## Common Patterns

### Pattern 1: Standard Binary Search (Find Target)
Classic lookup in a sorted array. Returns index or -1.
```python
def search(nums: list[int], target: int) -> int:
    left, right = 0, len(nums) - 1
    while left <= right:
        mid = left + (right - left) // 2
        if nums[mid] == target:
            return mid
        elif nums[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1
```
Key detail: `left <= right` (not `<`) because when `left == right`, that single element still needs checking.

### Pattern 2: Search Insert Position (bisect_left)
Find the first index where value >= target. Python's `bisect_left`.
```python
def search_insert(nums: list[int], target: int) -> int:
    left, right = 0, len(nums)
    while left < right:
        mid = left + (right - left) // 2
        if nums[mid] < target:
            left = mid + 1
        else:
            right = mid
    return left
```
Key differences from Pattern 1:
- `right = len(nums)` (exclusive upper bound, allows insert at end)
- `left < right` (not `<=`) because `right` is exclusive
- `right = mid` (not `mid - 1`) because `mid` itself might be the answer

### Pattern 3: Find Minimum in Rotated Sorted Array
Array is sorted but rotated (e.g., `[4,5,6,7,0,1,2]`). Find the minimum.
```python
def find_min(nums: list[int]) -> int:
    left, right = 0, len(nums) - 1
    while left < right:
        mid = left + (right - left) // 2
        if nums[mid] > nums[right]:
            # Minimum is in the right half (mid is in the rotated part)
            left = mid + 1
        else:
            # Minimum is at mid or in the left half
            right = mid
    return nums[left]
```
Insight: Compare `mid` with `right` (not `left`) to determine which half is unsorted. If `nums[mid] > nums[right]`, the pivot (minimum) is to the right.

### Pattern 4: Binary Search on Answer (Koko Eating Bananas)
Koko eats at speed `k` bananas/hour. Given piles and hours `h`, find minimum `k` such that she finishes in time.
```python
import math

def min_eating_speed(piles: list[int], h: int) -> int:
    def can_finish(k: int) -> bool:
        return sum(math.ceil(p / k) for p in piles) <= h

    left, right = 1, max(piles)
    while left < right:
        mid = left + (right - left) // 2
        if can_finish(mid):
            right = mid      # try smaller k
        else:
            left = mid + 1   # need larger k
    return left
```
The pattern:
1. Define a monotonic predicate: `can_finish(k)` is `False, False, ..., True, True, ...`
2. Binary search for the first `True`
3. Search space is `[1, max(piles)]` — not the input array

## Common Mistakes

1. **Infinite loop from wrong boundary update** — Using `left = mid` with `left < right` and `right = mid - 1` creates an infinite loop when `left + 1 == right`. Pick ONE convention and stick to it:
   - Convention A: `left <= right`, `right = mid - 1`, `left = mid + 1` (Pattern 1)
   - Convention B: `left < right`, `right = mid`, `left = mid + 1` (Patterns 2-4)

2. **Integer overflow in mid** — `(left + right) // 2` overflows in C++/Java when `left + right > INT_MAX`. Always use `left + (right - left) // 2`.

3. **Off-by-one on boundaries** — Forgetting whether `right` is inclusive (`len(nums) - 1`) or exclusive (`len(nums)`). Convention A uses inclusive, Convention B uses exclusive.

4. **Comparing with wrong side in rotated array** — Comparing `nums[mid]` with `nums[left]` instead of `nums[right]` fails when the left half is fully sorted but the minimum is on the right.

5. **Not verifying monotonicity in search-on-answer** — Binary search on answer only works if the predicate is monotonic (all `False` then all `True`). If it's `False, True, False`, binary search breaks.

6. **Using binary search on unsorted input** — Binary search requires sorted data or a monotonic predicate. Sorting first costs O(n log n), which may negate the benefit.

## Edge Cases to Consider
- Empty array
- Single element
- Target not in array (insert position)
- All elements equal
- Rotated at index 0 (not actually rotated)
- Search space of size 1 or 2 (boundary conditions)
- Answer at the boundary of search space (min or max possible value)

## Practice Problems
1. Binary Search (Easy) — classic lookup
2. Search Insert Position (Easy) — bisect_left
3. Find Minimum in Rotated Sorted Array (Medium) — rotated array search
4. Search in Rotated Sorted Array (Medium) — find target in rotated array
5. Koko Eating Bananas (Medium) — binary search on answer
6. Search a 2D Matrix (Medium) — binary search on flattened sorted structure
7. Time Based Key-Value Store (Medium) — bisect_right on timestamps
8. Find Peak Element (Medium) — binary search on unsorted array with local decision
