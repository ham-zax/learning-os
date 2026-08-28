# Sliding Window

## Summary
Sliding window solves problems involving **contiguous** subarrays or substrings. Instead of checking every possible subarray (O(n^2)), you maintain a "window" over the data and slide it forward — adding one element on the right, removing one on the left. This reduces brute force to linear time. The key insight: **when the problem asks for something about a contiguous sequence, think sliding window**.

## Key Points

1. **Fixed vs Variable Window** — Fixed: window size is given (e.g., "subarray of size k"). Variable: window grows/shrinks based on a condition (e.g., "longest substring without repeats")
2. **Window Validity Condition** — The condition that determines whether the current window is valid (no duplicates, sum < target, etc.). This drives when to expand vs shrink
3. **When to Shrink** — Shrink from the left when the window becomes invalid (violates the condition). For variable windows, shrinking is how you find the optimal answer
4. **Two Pointers** — The window is defined by `left` and `right` pointers. `right` always moves forward; `left` moves forward only when shrinking
5. **Hash Map/Counter for Window State** — Track what's inside the window with a hash map or counter. This lets you check validity in O(1)

## Time Complexities
| Approach | Time | Space |
|----------|------|-------|
| Brute force (all subarrays) | O(n^2) | O(1) |
| Sliding window (single pass) | O(n) | O(k) |
| Sliding window (worst case) | O(2n) | O(k) |

O(2n) happens when each element is added once (right pointer) and removed once (left pointer) — still linear.

## Common Patterns

### Pattern 1: Variable Window — Longest Substring Without Repeating Characters
Grow the window until a duplicate appears, then shrink from the left until valid again.

```python
def length_of_longest_substring(s: str) -> int:
    char_set = set()
    left = 0
    result = 0

    for right in range(len(s)):
        # Shrink until window is valid (no duplicates)
        while s[right] in char_set:
            char_set.remove(s[left])
            left += 1
        char_set.add(s[right])
        result = max(result, right - left + 1)

    return result
```

### Pattern 2: Fixed Window — Maximum Sum Subarray of Size K
Window size is fixed. Slide it forward by adding the new element and removing the old one.

```python
def max_sum_subarray(nums: list[int], k: int) -> int:
    window_sum = sum(nums[:k])
    result = window_sum

    for right in range(k, len(nums)):
        window_sum += nums[right] - nums[right - k]  # slide window
        result = max(result, window_sum)

    return result
```

### Pattern 3: Window with Counter — Minimum Window Substring
Expand to find a valid window, then shrink to minimize it. Use a counter to track what's still needed.

```python
from collections import Counter

def min_window(s: str, t: str) -> str:
    need = Counter(t)
    missing = len(t)  # total chars still needed
    left = 0
    start, end = 0, float('inf')

    for right, char in enumerate(s):
        if need[char] > 0:
            missing -= 1
        need[char] -= 1

        # All chars found — shrink to minimize
        while missing == 0:
            if right - left < end - start:
                start, end = left, right
            need[s[left]] += 1
            if need[s[left]] > 0:
                missing += 1
            left += 1

    return s[start:end + 1] if end != float('inf') else ""
```

### Pattern 4: Window with Condition — Longest Repeating Character Replacement
Expand the window as long as the "budget" of allowed replacements is not exceeded. Track the most frequent char in the window.

```python
def character_replacement(s: str, k: int) -> int:
    count = {}
    left = 0
    max_freq = 0  # frequency of most common char in window
    result = 0

    for right in range(len(s)):
        count[s[right]] = count.get(s[right], 0) + 1
        max_freq = max(max_freq, count[s[right]])

        # Window is invalid if we need more than k replacements
        window_size = right - left + 1
        if window_size - max_freq > k:
            count[s[left]] -= 1
            left += 1

        result = max(result, right - left + 1)

    return result
```

## Common Mistakes

1. **Forgetting to shrink the window** — The `while` loop to shrink must be inside the `for` loop. If you only check once per iteration, you may not shrink enough
2. **Off-by-one on window size** — Window size is `right - left + 1`, not `right - left`. The `-1` error is extremely common
3. **Wrong validity check** — Checking the condition *after* updating the window vs *before* changes behavior. Be consistent
4. **Removing from counter incorrectly** — When shrinking, decrement the count before moving `left`. If count hits 0, consider deleting the key to avoid false positives with `in` checks
5. **Not handling empty input** — Always check for empty strings/arrays before entering the loop
6. **Fixed window: wrong initial sum** — When computing the initial window sum for fixed-size, make sure you sum exactly `k` elements, not `k-1`

## Edge Cases to Consider
- Empty string or array
- Window size larger than the input
- All elements the same
- Single element
- Target not achievable (e.g., minimum window substring with chars not in source)
- Window size of 1

## Practice Questions
1. Explain when you would use a fixed vs variable sliding window.
2. For "Longest Substring Without Repeating Characters," why do we use a set instead of a list?
3. In the minimum window substring pattern, what does the `missing` counter represent? Why not just check if `need` is empty?
4. For "Longest Repeating Character Replacement," why does `max_freq` not need to be decremented when the window shrinks?
5. What's the difference between sliding window and two pointers? When do they overlap?

## Related Problems
- Best Time to Buy and Sell Stock (Easy)
- Longest Substring Without Repeating Characters (Medium)
- Minimum Window Substring (Hard)
- Longest Repeating Character Replacement (Medium)
- Permutation in String (Medium)
- Sliding Window Maximum (Hard)
- Maximum Average Subarray I (Easy)
- Fruits Into Baskets (Medium)
