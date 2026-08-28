# Problem Solving Checklist — The 7-Step Framework

Use this checklist EVERY time you solve a problem. Print it, memorize it, live it.

---

## Step 1: Understand (2-3 min)

**Before writing any code, answer these:**

- [ ] What are the **inputs**? (type, size, constraints)
- [ ] What are the **outputs**? (type, format)
- [ ] Can I restate the problem in my own words?
- [ ] What are the **edge cases**?
  - Empty input?
  - Single element?
  - All same elements?
  - Negative numbers?
  - Very large input?

**Example: Two Sum**
- Input: array of integers, target integer
- Output: indices of two numbers that add up to target
- Edge cases: No solution? Same element twice? Negative numbers?

---

## Step 2: Match (1-2 min)

**Which pattern does this look like?**

| Pattern | Signal Words |
|---------|--------------|
| Hash Map | "find pair", "count", "frequency", "exists" |
| Two Pointers | "sorted array", "pair", "palindrome" |
| Sliding Window | "subarray", "substring", "contiguous" |
| Stack | "matching", "valid", "nested" |
| Binary Search | "sorted", "search", "find" |
| Tree/Graph | "connected", "path", "level" |
| Dynamic Programming | "count ways", "min/max", "optimal" |

**For Two Sum:** "find pair that adds to target" → Hash Map pattern

---

## Step 3: Explore (2-3 min)

**Ask these questions:**

- [ ] What's the brute force approach? (always start here)
- [ ] What's its time complexity?
- [ ] Can I do better?
- [ ] What data structure would help?
- [ ] Is there a pattern I can reuse?

**For Two Sum:**
- Brute force: Check every pair → O(n²)
- Better: Use hash map to store complements → O(n)

---

## Step 4: Plan (2-3 min)

**Write pseudocode BEFORE coding:**

```
1. Create empty hash map
2. For each number at index i:
   a. Calculate complement = target - num
   b. If complement in hash map: return [map[complement], i]
   c. Else: store num → i in hash map
3. Return [] (no solution)
```

**Verify:**
- [ ] Does this handle all edge cases?
- [ ] What's the time complexity?
- [ ] What's the space complexity?

---

## Step 5: Implement (5-10 min)

**Write clean code:**

```python
def twoSum(nums: list[int], target: int) -> list[int]:
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []
```

**While coding:**
- [ ] Use meaningful variable names
- [ ] Handle edge cases
- [ ] Don't rush — speed comes with practice

---

## Step 6: Test (2-3 min)

**Walk through your code with examples:**

```
nums = [2, 7, 11, 15], target = 9

i=0: num=2, complement=7, seen={}, 7 not in seen → seen={2:0}
i=1: num=7, complement=2, seen={2:0}, 2 in seen → return [0, 1] ✓
```

**Test edge cases:**
- [ ] Example from problem
- [ ] Edge case: empty array
- [ ] Edge case: no solution
- [ ] Edge case: duplicate values

---

## Step 7: Optimize (1-2 min)

**Ask yourself:**
- [ ] Can I reduce time complexity?
- [ ] Can I reduce space complexity?
- [ ] Is there a cleaner way to write this?

**For Two Sum:**
- Current: O(n) time, O(n) space
- Can't do better — must look at each element at least once

---

## The Complete Checklist (Print This!)

```
□ STEP 1: UNDERSTAND
  □ Inputs: type, size, constraints
  □ Outputs: type, format
  □ Restate problem in own words
  □ Edge cases: empty, single, all same, negative, large

□ STEP 2: MATCH
  □ Which pattern? (hash, two-pointer, sliding-window, etc.)
  □ What are the signal words?

□ STEP 3: EXPLORE
  □ Brute force approach?
  □ Brute force complexity?
  □ Can I do better?
  □ What data structure helps?

□ STEP 4: PLAN
  □ Write pseudocode
  □ Handle edge cases?
  □ Time complexity?
  □ Space complexity?

□ STEP 5: IMPLEMENT
  □ Clean code
  □ Meaningful names
  □ Handle edge cases

□ STEP 6: TEST
  □ Walk through examples
  □ Test edge cases
  □ Verify output

□ STEP 7: OPTIMIZE
  □ Can reduce time?
  □ Can reduce space?
  □ Cleaner code?
```

---

## Time Budget (Total: 20-30 min per problem)

| Step | Time | Purpose |
|------|------|---------|
| Understand | 2-3 min | Don't rush this! |
| Match | 1-2 min | Pattern recognition |
| Explore | 2-3 min | Find the approach |
| Plan | 2-3 min | Pseudocode first |
| Implement | 5-10 min | Write clean code |
| Test | 2-3 min | Verify correctness |
| Optimize | 1-2 min | Final polish |

---

## Common Mistakes to Avoid

1. **Jumping to code too fast** — Always understand first
2. **Not testing edge cases** — Empty, single, all same
3. **Using wrong data structure** — Hash map vs array vs set
4. **Overcomplicating** — Simplest solution first
5. **Not explaining your thinking** — Talk through your approach

---

## When You're Stuck

1. **Re-read the problem** — Did you miss a constraint?
2. **Try a smaller example** — Trace through by hand
3. **Think about the data structure** — What would make this easier?
4. **Consider the opposite** — What if you had the answer, how would you verify it?
5. **Use the 5-minute rule** — If stuck for 5 min, look at hints (not solution)
