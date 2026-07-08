# Two Pointers

## Summary
Two pointers is a technique where you use two indices to traverse an array or string, usually converging toward the middle or moving in the same direction. It turns O(n^2) brute-force pair searches into O(n) by exploiting sorted order or structural constraints. The key insight: **when the array is sorted, you can eliminate half the remaining search space with each comparison**.

## Key Points

1. **Converging Pointers** — Start at both ends, move inward based on comparison. Works on sorted arrays for pair-finding, and on strings for palindrome checks
2. **Same-Direction Pointers** — Both start at one end; one writes, one reads. Used for in-place array modification (remove duplicates, move zeros)
3. **Fast/Slow Pointers** — Two pointers moving at different speeds. Classic for linked list cycle detection (Floyd's algorithm)
4. **Sort First** — If the problem asks for pairs/triplets with a sum condition, sorting first enables the two-pointer inner loop. Trade: O(n log n) sort to save an O(n^2) or O(n^3) search
5. **Skip Duplicates** — In problems like 3Sum, you must skip duplicate values after processing them to avoid duplicate triplets in the result

## Time Complexities
| Approach | Time | Space | When to Use |
|----------|------|-------|-------------|
| Converging (sorted input) | O(n) | O(1) | Pair sum, palindrome, container problems |
| Same-direction | O(n) | O(1) | In-place array modification |
| Fast/slow | O(n) | O(1) | Cycle detection, finding middle |
| Sort + two-pointer | O(n log n) | O(1)* | 3Sum, pair sum on unsorted input |
| Three pointers (3Sum) | O(n^2) | O(1)* | Finding triplets with sum condition |

*Excluding output space

## Common Patterns

### Pattern 1: Converging Pointers (Sorted Two Sum, Palindrome)
Pointers start at both ends and move inward based on the current sum or comparison.

**Sorted Two Sum:**
```python
def two_sum_sorted(nums, target):
    left, right = 0, len(nums) - 1
    while left < right:
        current = nums[left] + nums[right]
        if current == target:
            return [left, right]
        elif current < target:
            left += 1
        else:
            right -= 1
    return []
```

**Palindrome Check:**
```python
def is_palindrome(s):
    left, right = 0, len(s) - 1
    while left < right:
        if s[left] != s[right]:
            return False
        left += 1
        right -= 1
    return True
```

### Pattern 2: Same Direction (Remove Duplicates, Move Zeros)
A slow pointer marks where to write; a fast pointer scans ahead.

**Remove Duplicates from Sorted Array:**
```python
def remove_duplicates(nums):
    if not nums:
        return 0
    slow = 0
    for fast in range(1, len(nums)):
        if nums[fast] != nums[slow]:
            slow += 1
            nums[slow] = nums[fast]
    return slow + 1
```

**Move Zeros:**
```python
def move_zeros(nums):
    slow = 0
    for fast in range(len(nums)):
        if nums[fast] != 0:
            nums[slow], nums[fast] = nums[fast], nums[slow]
            slow += 1
```

### Pattern 3: Fast/Slow Pointers (Linked List Cycle Detection)
Two pointers move at different speeds. If a cycle exists, they will meet.

**Floyd's Cycle Detection:**
```python
def has_cycle(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow == fast:
            return True
    return False
```

**Find Middle of Linked List:**
```python
def find_middle(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
    return slow
```

### Pattern 4: Three Pointers / 3Sum (Sort + Two-Pointer Inner Loop)
Sort first, then for each element, use converging two-pointer on the rest.

**3Sum:**
```python
def three_sum(nums):
    nums.sort()
    result = []
    for i in range(len(nums) - 2):
        # Skip duplicate for first element
        if i > 0 and nums[i] == nums[i - 1]:
            continue
        left, right = i + 1, len(nums) - 1
        while left < right:
            total = nums[i] + nums[left] + nums[right]
            if total == 0:
                result.append([nums[i], nums[left], nums[right]])
                # Skip duplicates for second and third elements
                while left < right and nums[left] == nums[left + 1]:
                    left += 1
                while left < right and nums[right] == nums[right - 1]:
                    right -= 1
                left += 1
                right -= 1
            elif total < 0:
                left += 1
            else:
                right -= 1
    return result
```

**Container With Most Water:**
```python
def max_area(height):
    left, right = 0, len(height) - 1
    max_water = 0
    while left < right:
        w = right - left
        h = min(height[left], height[right])
        max_water = max(max_water, w * h)
        # Move the shorter side inward
        if height[left] < height[right]:
            left += 1
        else:
            right -= 1
    return max_water
```

## Common Mistakes

1. **Off-by-one errors** — Using `<=` instead of `<` in while condition, or forgetting `left < right` guard
2. **Forgetting to skip duplicates in 3Sum** — Without skipping `nums[i] == nums[i-1]`, `nums[left] == nums[left+1]`, and `nums[right] == nums[right-1]`, you get duplicate triplets
3. **Not sorting first** — Two-pointer converging only works on sorted input. If input is unsorted, sort it or use a hash map approach
4. **Modifying while iterating** — In same-direction pattern, make sure the write pointer and read pointer don't interfere
5. **Wrong pointer update in Container With Most Water** — Always move the shorter side; moving the taller side can never increase the area
6. **Confusing index vs value** — In Two Sum II (sorted), remember the problem may expect 1-indexed return values
7. **Cycle detection: wrong starting condition** — Both pointers must start at the head; fast starting at head.next changes the math

## Practice Questions
1. Explain why two pointers works for sorted Two Sum. What property of sorted arrays makes this possible?
2. How do you detect a cycle in a linked list without extra space? What happens when fast reaches the end?
3. In 3Sum, why do you need three separate duplicate-skipping checks? Where do each go?
4. For Container With Most Water, prove that moving the taller pointer inward can never increase the area.
5. What's the difference between converging and same-direction pointers? Give an example of each.
6. How would you find all pairs with a given difference in a sorted array?

## Related Problems
- Valid Palindrome (Easy)
- Two Sum II - Input Array Is Sorted (Medium)
- 3Sum (Medium)
- Container With Most Water (Medium)
- Remove Duplicates from Sorted Array (Easy)
- Move Zeroes (Easy)
- Linked List Cycle (Easy)
- Trapping Rain Water (Hard)
