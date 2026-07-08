# Intervals

## Summary

Interval problems involve ranges `[start, end]` and ask you to merge, count, or find overlaps. The key insight: **sort by start time first**, then process linearly. Most interval problems reduce to a single pass after sorting.

## Key Points

1. **Sort First** — Almost always sort intervals by start time (or end time for specific cases)
2. **Merge Condition** — Two intervals overlap if `a.end >= b.start`
3. **Greedy Works** — Most interval problems have greedy solutions after sorting
4. **End-Time Tracking** — Track the maximum end time seen so far to detect overlaps
5. **Counting vs Merging** — Some problems count overlaps (meeting rooms), others merge them

## Time Complexities

| Operation | Time | Space |
|-----------|------|-------|
| Sort intervals | O(n log n) | O(1) or O(n) |
| Merge all overlaps | O(n) | O(n) |
| Count overlaps | O(n log n) | O(n) |
| Insert interval | O(n) | O(n) |

## Common Patterns

### Pattern 1: Merge Overlapping Intervals
```
Sort by start time
result = [first_interval]
for each interval in remaining:
    if interval.start <= result[-1].end:
        result[-1].end = max(result[-1].end, interval.end)
    else:
        result.append(interval)
```

### Pattern 2: Count Overlaps (Meeting Rooms II)
```
Sort start times and end times separately
Use two pointers: one for starts, one for ends
When start < end → new room needed (increment count)
When start >= end → room freed (decrement count)
Track maximum count
```

### Pattern 3: Insert Interval
```
1. Add all intervals that end before new_interval starts
2. Merge all overlapping intervals with new_interval
3. Add remaining intervals
```

### Pattern 4: Non-overlapping Intervals (Greedy)
```
Sort by end time (not start!)
count = 0, prev_end = -infinity
for each interval:
    if interval.start >= prev_end:
        prev_end = interval.end  # keep this interval
    else:
        count += 1  # remove this interval
return count
```

## Common Mistakes

- **Wrong sort key** — Merging needs sort-by-start; non-overlapping needs sort-by-end
- **Off-by-one in overlap** — `a.end >= b.start` (not `>`) for touching intervals
- **Not updating end** — When merging, use `max(end, current.end)`, not just `current.end`
- **Forgetting to sort** — Interval problems almost always need sorting first
- **Edge cases** — Empty list, single interval, non-overlapping, fully nested

## Practice Problems

| Problem | Difficulty | Pattern |
|---------|------------|---------|
| Merge Intervals | Medium | Merge overlapping |
| Insert Interval | Medium | Insert + merge |
| Non-overlapping Intervals | Medium | Greedy by end time |
| Meeting Rooms | Easy | Sort + check overlap |
| Meeting Rooms II | Medium | Count overlaps |
| Interval List Intersections | Medium | Two pointers |

## Related Patterns

- **Two Pointers** — Used in interval intersection problems
- **Greedy** — Non-overlapping intervals uses greedy end-time selection
- **Heap** — Meeting Rooms II can also use a min-heap for end times
