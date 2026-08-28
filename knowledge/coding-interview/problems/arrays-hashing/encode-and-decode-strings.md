---
id: encode-and-decode-strings
title: Encode and Decode Strings
difficulty: Medium
pattern: arrays-hashing
source: NeetCode
---

# Encode and Decode Strings

**Difficulty:** Medium
**Pattern:** arrays-hashing
**LeetCode:** https://leetcode.com/problems/encode-and-decode-strings/

## Problem

Design an algorithm to encode a list of strings to a string. The encoded string is then sent over the network and is decoded back to the original list of strings. Please implement encode and decode.

## Examples

### Example 1
**Input:** Input: ["Hello","World"]
**Output:** Encoded: "5#Hello5#World", Decoded: ["Hello","World"]
**Explanation:** The encoded string contains the length of each string followed by a delimiter '#' and then the string itself.

### Example 2
**Input:** Input: [""]
**Output:** Encoded: "0#", Decoded: [""]
**Explanation:** An empty string is encoded as "0#".

### Example 3
**Input:** Input: ["we", "say", ":", "yes"]
**Output:** Encoded: "2#we3#say1#:3#yes", Decoded: ["we", "say", ":", "yes"]
**Explanation:** Each string is prefixed with its length and the delimiter '#'.

## Constraints

- 0 <= strs.length < 200
- 0 <= strs[i].length < 200
- strs[i] contains any possible characters out of 256 valid ASCII characters.

## Hints

<details>
<summary>Click to reveal hints</summary>

1. Use a delimiter that won't appear in the strings
2. Prefix each string with its length followed by a special character
3. The format 'length#string' allows you to know exactly how many characters to read
4. Handle edge cases like empty strings and strings containing the delimiter

</details>

## Key Insights

*(Fill in after solving - what makes this problem tick)*

## Solution Template

```python
class Codec:
    def encode(self, strs: list[str]) -> str:
        """Encodes a list of strings to a single string."""
        # Your implementation here
        pass

    def decode(self, s: str) -> list[str]:
        """Decodes a single string to a list of strings."""
        # Your implementation here
        pass
```

## Related Problems

- Pattern: [arrays-hashing](../arrays-hashing/concept.md)
