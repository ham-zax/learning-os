# Linked Lists

## Summary
Linked lists are node-based data structures where each node contains a value and a pointer to the next node. The key insight: **manipulating pointers is the skill being tested**. Unlike arrays, you cannot access elements by index — you must traverse. Most linked list problems boil down to careful pointer re-wiring and handling edge cases (empty list, single node, head/tail operations).

## Key Points

1. **Singly vs Doubly Linked** — Singly: each node points to next only. Doubly: nodes have both `next` and `prev` pointers. Most interview problems use singly linked lists.
2. **Dummy Head Technique** — Create a sentinel node before the real head. This eliminates special-casing the head node during insertions/deletions. The real head becomes just another node.
3. **Fast/Slow Pointers** — Two pointers moving at different speeds. Fast moves 2 steps, slow moves 1. Used for cycle detection, finding the middle, and detecting patterns.
4. **Two Pointers with Gap** — Maintain a fixed gap between two pointers (e.g., N apart). Advance both until the lead pointer hits the end — the trailing pointer is at the target.
5. **In-Place Manipulation** — Most problems require O(1) extra space. You re-wire existing nodes rather than creating new ones (unless building a new list like merge).

## Time Complexities
| Operation | Singly Linked | Doubly Linked |
|-----------|---------------|---------------|
| Access by index | O(n) | O(n) |
| Search | O(n) | O(n) |
| Insert at head | O(1) | O(1) |
| Insert at tail | O(n)* | O(1) |
| Insert at known position | O(1) | O(1) |
| Delete at head | O(1) | O(1) |
| Delete at known position | O(1) | O(1) |

*Singly linked list insert at tail is O(n) unless you maintain a tail pointer

## Common Patterns

### Pattern 1: Reverse Linked List (Iterative with 3 Pointers)
```python
def reverse_list(head):
    prev = None
    curr = head
    while curr:
        next_node = curr.next  # save next before overwriting
        curr.next = prev       # reverse the link
        prev = curr            # advance prev
        curr = next_node       # advance curr
    return prev                # prev is the new head
```
Key: Always save `curr.next` before overwriting it, or you lose the rest of the list.

### Pattern 2: Merge Two Sorted Lists (Dummy Head + Compare)
```python
def merge_two_lists(l1, l2):
    dummy = ListNode(0)       # sentinel avoids head special-case
    curr = dummy
    while l1 and l2:
        if l1.val <= l2.val:
            curr.next = l1
            l1 = l1.next
        else:
            curr.next = l2
            l2 = l2.next
        curr = curr.next
    curr.next = l1 or l2      # attach remaining nodes
    return dummy.next          # skip sentinel
```
Key: The dummy node means you never have to ask "is this the first node?"

### Pattern 3: Cycle Detection (Floyd's Tortoise and Hare)
```python
def has_cycle(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow is fast:       # identity check, not value check
            return True
    return False

def detect_cycle_start(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow is fast:
            # Reset one pointer to head, advance both at same speed
            slow = head
            while slow is not fast:
                slow = slow.next
                fast = fast.next
            return slow        # cycle start node
    return None
```
Key: Use `is` not `==` for identity comparison. The math behind cycle start detection: distance from head to cycle start equals distance from meeting point to cycle start.

### Pattern 4: Remove Nth Node From End (Two Pointers with Gap)
```python
def remove_nth_from_end(head, n):
    dummy = ListNode(0, head)  # dummy.next = head
    fast = slow = dummy
    # Advance fast by n+1 steps to create a gap of n
    for _ in range(n + 1):
        fast = fast.next
    # Move both until fast reaches end
    while fast:
        fast = fast.next
        slow = slow.next
    # slow.next is the node to remove
    slow.next = slow.next.next
    return dummy.next
```
Key: Gap of `n` between fast and slow means when fast reaches the end, slow is exactly one node before the target. The `+1` accounts for the node you need to skip over.

## Common Mistakes

1. **Losing reference to next node** — Overwriting `curr.next` before saving it. Always store `next_node = curr.next` first.
2. **Not handling None/empty list** — Forgetting to check `if not head` at the start. Many solutions crash on empty input.
3. **Off-by-one in gap** — When removing Nth from end, the gap must be `n+1` (not `n`) because you need to be one node *before* the target to re-wire.
4. **Using `==` instead of `is`** — In cycle detection, you need identity comparison (`is`), not equality (`==`). Two different nodes can have the same value.
5. **Forgetting to update tail** — After appending, `tail.next` should be `None`. Stale pointers create accidental cycles.
6. **Head mutation without dummy** — Without a dummy node, inserting/deleting at position 0 requires separate logic. Dummy eliminates this.

## Edge Cases to Consider
- Empty list (`head is None`)
- Single node
- Two nodes
- Target is head (first node)
- Target is tail (last node)
- Remove only node (result is empty list)
- Cycle at head vs cycle at tail
- N equals list length (remove head)

## Practice Questions
1. Reverse a linked list both iteratively and recursively. What's the space complexity of each?
2. How do you detect if a linked list has a cycle? How do you find where the cycle starts?
3. Merge two sorted linked lists in O(n+m) time and O(1) space.
4. Remove the Nth node from the end in one pass. How do you do it with two pointers?
5. Find the middle of a linked list. What happens with even-length lists?
6. How would you check if a linked list is a palindrome?

## Related Problems
- Reverse Linked List (Easy)
- Merge Two Sorted Lists (Easy)
- Linked List Cycle (Easy)
- Linked List Cycle II (Medium)
- Remove Nth Node From End of List (Medium)
- Middle of the Linked List (Easy)
- Reorder List (Medium)
- Palindrome Linked List (Easy)
