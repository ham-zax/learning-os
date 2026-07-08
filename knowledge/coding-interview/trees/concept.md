# Trees

## Summary
Trees are a core data structure in coding interviews. The key insight: **most tree problems are solved with recursion**. A tree is just a node with a left and right subtree — solve for the current node, then recurse on children. Binary Search Trees (BSTs) add ordering, which enables O(log n) search.

## Key Points

1. **BST Property** — For every node: all left descendants < node < all right descendants. This holds recursively.
2. **Tree Traversals** — Inorder (sorted for BST), Preorder (root first), Postorder (children before root). All are O(n).
3. **Level-order BFS** — Use a deque to traverse level by level. Essential when you need level information or shortest path.
4. **Recursive DFS** — Most tree problems decompose into: do something with current node, recurse left, recurse right.
5. **Null Nodes Matter** — Always check for `None`/`null` before accessing `.left` or `.right`. Base case is usually the null node.

## Time Complexities
| Operation | Binary Tree | Binary Search Tree (balanced) |
|-----------|-------------|-------------------------------|
| Search | O(n) | O(log n) |
| Insert | O(n) | O(log n) |
| Delete | O(n) | O(log n) |
| Traversal | O(n) | O(n) |
| Height | O(n) | O(log n) balanced, O(n) worst |

*n = number of nodes. BST is O(n) worst case if unbalanced (linked list shape).

## Common Patterns

### Pattern 1: Recursive DFS (Max Depth / Invert Tree)
Most tree problems fit this pattern. Process current node, recurse on children.
```python
def max_depth(root):
    if not root:
        return 0
    left = max_depth(root.left)
    right = max_depth(root.right)
    return 1 + max(left, right)

def invert_tree(root):
    if not root:
        return None
    root.left, root.right = invert_tree(root.right), invert_tree(root.left)
    return root
```

### Pattern 2: Level-order BFS (using deque)
Use when you need to process nodes level by level, or find shortest path.
```python
from collections import deque

def level_order(root):
    if not root:
        return []
    result = []
    queue = deque([root])
    while queue:
        level = []
        for _ in range(len(queue)):
            node = queue.popleft()
            level.append(node.val)
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
        result.append(level)
    return result
```

### Pattern 3: BST Validation (Min/Max Bounds)
Pass valid range down the tree. Each node must fall within its bounds.
```python
def is_valid_bst(root, lo=float('-inf'), hi=float('inf')):
    if not root:
        return True
    if root.val <= lo or root.val >= hi:
        return False
    return (is_valid_bst(root.left, lo, root.val) and
            is_valid_bst(root.right, root.val, hi))
```

### Pattern 4: Lowest Common Ancestor
Leverage BST ordering, or use post-order DFS on general binary trees.
```python
# BST version — exploit ordering
def lca_bst(root, p, q):
    while root:
        if p.val < root.val and q.val < root.val:
            root = root.left
        elif p.val > root.val and q.val > root.val:
            root = root.right
        else:
            return root

# General binary tree version
def lca(root, p, q):
    if not root or root == p or root == q:
        return root
    left = lca(root.left, p, q)
    right = lca(root.right, p, q)
    if left and right:
        return root
    return left or right
```

## Common Mistakes

1. **Forgetting the base case** — Every recursive function needs `if not root: return ...`. Without it, you get NoneType errors.
2. **Confusing BST with sorted array** — Inorder traversal of a BST gives sorted order, but you can't do binary search by index.
3. **Not handling duplicates** — Clarify with interviewer: does the BST allow duplicates? Usually left <= root < right, or strict left < root < right.
4. **Off-by-one in bounds check** — For BST validation, use strict inequality (`<` / `>`) when the spec says no duplicates.
5. **Using DFS when BFS is needed** — If you need level info or shortest path, use BFS. DFS gives depth but not level grouping.
6. **Modifying tree structure unintentionally** — When doing inorder/preorder, don't reassign `.left`/`.right` unless that's the goal.
7. **Stack overflow on deep trees** — Python recursion limit is ~1000. For very deep trees, use iterative DFS with an explicit stack.

## Practice Problems
1. **Invert Binary Tree** (Easy) — Swap left and right children recursively
2. **Maximum Depth of Binary Tree** (Easy) — Classic recursive DFS
3. **Same Tree** (Easy) — Compare two trees node by node
4. **Subtree of Another Tree** (Easy) — Check if one tree matches another's subtree
5. **Binary Tree Level Order Traversal** (Medium) — BFS with level grouping
6. **Validate BST** (Medium) — Pass min/max bounds down
7. **Lowest Common Ancestor** (Medium) — BST ordering or post-order DFS
8. **Kth Smallest Element in BST** (Medium) — Inorder traversal stops at k-th
