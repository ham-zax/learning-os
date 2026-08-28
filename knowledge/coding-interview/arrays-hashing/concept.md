# Arrays + Hashing

## Summary
Arrays and hash maps are the foundation of most coding interview problems. The key insight: **when you need to look up something quickly, use a hash map**. Arrays give O(1) access by index; hash maps give O(1) access by key.

## Key Points

1. **Hash Map for Complements** — When looking for pairs (Two Sum pattern), store what you've seen in a hash map, check if complement exists
2. **Counting Pattern** — Use hash map to count occurrences (Valid Anagram, Group Anagrams)
3. **Set for Duplicates** — When checking for duplicates, a set is O(1) lookup vs O(n) for list
4. **Index Mapping** — Store {value: index} when you need to return positions
5. **Frequency Bucketing** — Group items by frequency (Top K Frequent) using Counter or defaultdict

## Time Complexities
| Operation | Array | Hash Map | Set |
|-----------|-------|----------|-----|
| Access | O(1) | O(1) | N/A |
| Search | O(n) | O(1) | O(1) |
| Insert | O(n)* | O(1) | O(1) |
| Delete | O(n)* | O(1) | O(1) |

*Array insert/delete is O(n) due to shifting, O(1) at end

## Common Patterns

### Pattern 1: Two Sum (Complement Lookup)
```
seen = {}
for i, num in enumerate(nums):
    complement = target - num
    if complement in seen:
        return [seen[complement], i]
    seen[num] = i
```

### Pattern 2: Counting (Anagram Check)
```
count = Counter(s)    # or defaultdict(int)
for char in s:
    count[char] += 1
# Compare with expected counts
```

### Pattern 3: Grouping (Anagram Groups)
```
groups = defaultdict(list)
for word in words:
    key = tuple(sorted(word))  # or use char count as key
    groups[key].append(word)
return list(groups.values())
```

### Pattern 4: Duplicate Detection
```
seen = set()
for num in nums:
    if num in seen:
        return True
    seen.add(num)
return False
```

## Python Built-ins
```python
from collections import Counter, defaultdict
import collections

# Counter — count occurrences
c = Counter("aabbcc")  # {'a': 2, 'b': 2, 'c': 2}
c.most_common(2)        # [('a', 2), ('b', 2)]

# defaultdict — auto-create missing keys
d = defaultdict(int)    # default 0
d = defaultdict(list)   # default []
d[key].append(value)    # no KeyError

# set — O(1) membership test
s = set(nums)
if x in s: ...
```

## Edge Cases to Consider
- Empty array/hash map
- Single element
- All elements same
- Negative numbers
- Target not found
- Duplicate values

## Practice Questions
1. Explain the Two Sum approach. Why is hash map better than brute force?
2. How would you check if two strings are anagrams? What's the time complexity?
3. When would you use a set vs a hash map?
4. How do you group anagrams together? What's the key?
5. What's the time complexity of checking for duplicates in an array?

## Deep Dive: Why Hash Maps Work

Hash maps use a **hash function** to convert keys into array indices. This gives:
- **O(1) average** lookup, insert, delete
- **O(n) worst case** (hash collisions, rare with good hash functions)

The trade-off: **space for time**. You use O(n) extra space to get O(1) lookups.

When you see "find two numbers that..." or "check if exists..." — think hash map.

## Related Problems
- Two Sum (Easy)
- Contains Duplicate (Easy)
- Valid Anagram (Easy)
- Group Anagrams (Medium)
- Top K Frequent Elements (Medium)
- Product of Array Except Self (Medium)
