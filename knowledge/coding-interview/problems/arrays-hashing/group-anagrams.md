---
id: group-anagrams
title: Group Anagrams
difficulty: Medium
pattern: arrays-hashing
source: NeetCode
---

# Group Anagrams

**Difficulty:** Medium
**Pattern:** arrays-hashing
**LeetCode:** https://leetcode.com/problems/group-anagrams/

## Problem

Given an array of strings strs, group the anagrams together. You can return the answer in any order.

## Examples

### Example 1
**Input:** strs = ["eat","tea","tan","ate","nat","bat"]
**Output:** [["bat"],["nat","tan"],["ate","eat","tea"]]
**Explanation:** There is no string in strs that can be rearranged to form "bat". The strings "nat" and "tan" are anagrams as they can be rearranged to form each other. The strings "ate", "eat", and "tea" are anagrams as they can be rearranged to form each other.

### Example 2
**Input:** strs = [""]
**Output:** [[""]]
**Explanation:** An empty string is its own anagram group.

### Example 3
**Input:** strs = ["a"]
**Output:** [["a"]]
**Explanation:** A single character string is its own anagram group.

## Constraints

- 1 <= strs.length <= 10^4
- 0 <= strs[i].length <= 100
- strs[i] consists of lowercase English letters.

## Hints

<details>
<summary>Click to reveal hints</summary>

1. Two strings are anagrams if they have the same character counts
2. Use the sorted version of each string as a key in a hash map
3. Alternatively, use a character count tuple as the key

</details>

## Key Insights

*(Fill in after solving - what makes this problem tick)*

## Solution Template

```python
def groupAnagrams(strs: list[str]) -> list[list[str]]:
    # Your implementation here
    pass
```

## Related Problems

- Pattern: [arrays-hashing](../arrays-hashing/concept.md)
