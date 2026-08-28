# Graphs

## Summary
Graphs model relationships between entities. In coding interviews, most graph problems involve **traversal** (BFS/DFS), **connectivity** (components, cycles), or **ordering** (topological sort). The key insight: **most graph problems reduce to "visit nodes in the right order with a visited set."**

## Key Points

1. **Adjacency List vs Matrix** — Use adjacency list (`dict[node, list]`) for sparse graphs (most interview problems); use matrix for grid-based problems or dense graphs
2. **Directed vs Undirected** — Directed edges go one-way (prerequisites); undirected go both ways (friendships). Undirected graphs are just directed graphs with edges in both directions
3. **Connected Components** — A group of nodes reachable from each other. Use DFS/BFS from each unvisited node to count or explore components
4. **Cycle Detection** — In directed graphs, track nodes in the current recursion stack (3-color: white/gray/black). In undirected, just check if neighbor is visited and not parent
5. **Topological Sort** — Ordering of nodes in a DAG such that for every edge u→v, u comes before v. Use Kahn's (BFS with in-degree) or DFS with post-order reversal

## Time Complexities
| Algorithm | Time | Space | Notes |
|-----------|------|-------|-------|
| BFS | O(V + E) | O(V) | Queue, level-order |
| DFS | O(V + E) | O(V) | Stack or recursion |
| Dijkstra | O((V + E) log V) | O(V) | Min-heap, non-negative weights |
| Topological Sort | O(V + E) | O(V) | BFS (Kahn's) or DFS |
| Union-Find | O(alpha(n)) per op | O(n) | Nearly O(1) with path compression + union by rank |

V = vertices, E = edges. All assume adjacency list representation.

## Common Patterns

### Pattern 1: Grid DFS/BFS (Number of Islands, Flood Fill)
Treat the grid as an implicit graph. Each cell connects to its neighbors (4-directional or 8-directional).
```python
def num_islands(grid):
    if not grid:
        return 0

    rows, cols = len(grid), len(grid[0])
    count = 0

    def dfs(r, c):
        if r < 0 or r >= rows or c < 0 or c >= cols or grid[r][c] == '0':
            return
        grid[r][c] = '0'  # mark visited
        dfs(r + 1, c)
        dfs(r - 1, c)
        dfs(r, c + 1)
        dfs(r, c - 1)

    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == '1':
                count += 1
                dfs(r, c)

    return count
```
**When to use:** Grid-based problems where you need to explore regions, count connected areas, or flood fill.

### Pattern 2: Graph DFS with Visited Set (Clone Graph)
Maintain a visited map to avoid infinite loops and to store cloned references.
```python
def clone_graph(node):
    if not node:
        return None

    clones = {}

    def dfs(n):
        if n in clones:
            return clones[n]

        clone = Node(n.val)
        clones[n] = clone
        for neighbor in n.neighbors:
            clone.neighbors.append(dfs(neighbor))
        return clone

    return dfs(node)
```
**When to use:** Deep copy, graph traversal where you need to process each node exactly once.

### Pattern 3: Topological Sort — BFS / Kahn's (Course Schedule)
Process nodes with zero in-degree first. If all nodes are processed, no cycle exists.
```python
from collections import deque, defaultdict

def can_finish(num_courses, prerequisites):
    graph = defaultdict(list)
    in_degree = [0] * num_courses

    for dest, src in prerequisites:
        graph[src].append(dest)
        in_degree[dest] += 1

    queue = deque(i for i in range(num_courses) if in_degree[i] == 0)
    count = 0

    while queue:
        node = queue.popleft()
        count += 1
        for neighbor in graph[node]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    return count == num_courses
```
**When to use:** Dependency ordering, cycle detection in directed graphs, scheduling problems.

### Pattern 4: Union-Find (Connected Components)
Disjoint set to efficiently group and query connected components.
```python
class UnionFind:
    def __init__(self, n):
        self.parent = list(range(n))
        self.rank = [0] * n

    def find(self, x):
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])  # path compression
        return self.parent[x]

    def union(self, x, y):
        px, py = self.find(x), self.find(y)
        if px == py:
            return False
        if self.rank[px] < self.rank[py]:
            px, py = py, px
        self.parent[py] = px
        if self.rank[px] == self.rank[py]:
            self.rank[px] += 1
        return True

def count_components(n, edges):
    uf = UnionFind(n)
    components = n
    for u, v in edges:
        if uf.union(u, v):
            components -= 1
    return components
```
**When to use:** Dynamic connectivity, counting components, detecting cycles in undirected graphs.

## Common Mistakes

1. **Forgetting visited set** — Leads to infinite loops in cyclic graphs. Always mark nodes as visited before recursing, not after
2. **Off-by-one in grid bounds** — Check `0 <= r < rows` and `0 <= c < cols` before accessing `grid[r][c]`
3. **Not handling disconnected components** — BFS/DFS from a single node only explores one component. Loop over all nodes to find all components
4. **Modifying grid vs using separate visited** — Mutating the grid to mark visited (changing `'1'` to `'0'`) works but modifies input. Use a separate `visited` set if input must be preserved
5. **Directed vs undirected cycle detection** — Simple `visited` check only works for undirected. Directed graphs need the gray-set (in-recursion-stack) check
6. **Confusing adjacency list initialization** — Use `defaultdict(list)` not `defaultdict(set)` unless you need deduplication

## Python Built-ins
```python
from collections import deque, defaultdict

# deque — efficient BFS queue
q = deque([start])
q.popleft()  # O(1)

# defaultdict — auto-create adjacency list
graph = defaultdict(list)
graph[node].append(neighbor)

# Graph from edge list
for u, v in edges:
    graph[u].append(v)
    graph[v].append(u)  # remove for directed

# Adjacency matrix
grid = [[0] * n for _ in range(n)]
```

## Practice Questions
1. Explain the difference between BFS and DFS. When would you use one over the other?
2. How do you detect a cycle in a directed graph? What about undirected?
3. What is topological sort? When does it fail (cycle)?
4. How does Union-Find work? What is path compression and union by rank?
5. How do you handle a grid as a graph? What are the boundary conditions?
6. What's the time complexity of BFS/DFS? Why O(V+E) not O(V)?

## Related Problems
- Number of Islands (Medium)
- Flood Fill (Easy)
- Clone Graph (Medium)
- Course Schedule (Medium)
- Pacific Atlantic Water Flow (Medium)
- Rotting Oranges (Medium)
- Number of Connected Components (Medium)
- Graph Valid Tree (Medium)
- Clone Graph (Medium)
- Word Ladder (Hard)
