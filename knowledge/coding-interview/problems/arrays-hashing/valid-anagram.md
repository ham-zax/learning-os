---
id: valid-anagram
title: Valid Anagram
difficulty: Easy
pattern: arrays-hashing
source: NeetCode
---

# Valid Anagram

**Difficulty:** Easy
**Pattern:** arrays-hashing
**LeetCode:** https://leetcode.com/problems/valid-anagram/

## Problem

Given two strings s and t, return true if t is an anagram of s, and false otherwise. An Anagram is a word or phrase formed by rearranging the letters of a different word or phrase, typically using all the original letters exactly once.

## Examples

### Example 1
**Input:** s = "anagram", t = "nagaram"
**Output:** true
**Explanation:** Both strings contain the same characters with the same frequencies.

### Example 2
**Input:** s = "rat", t = "car"
**Output:** false
**Explanation:** The strings contain different characters.

## Constraints

- 1 <= s.length, t.length <= 5 * 10^4
- s and t consist of lowercase English letters.

## Hints

<details>
<summary>Click to reveal hints</summary>

1. If the lengths differ, they can't be anagrams
2. Count the frequency of each character in both strings
3. A hash map or array of size 26 can track character counts

</details>

## Key Insights

*(Fill in after solving - what makes this problem tick)*

## Solution Template

```python
def isAnagram(s: str, t: str) -> bool:
    # Your implementation here
    pass
```

## Related Problems

- Pattern: [arrays-hashing](../arrays-hashing/concept.md)
