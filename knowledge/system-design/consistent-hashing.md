# Consistent Hashing

## Definition
A distributed hashing technique that maps both servers and keys onto a hash ring. When a server is added or removed, only a fraction of keys need to be remapped (K/N on average), rather than all keys. Minimizes disruption during scaling events.

## Key Terms
- **Hash ring**: A circular hash space (0 to 2^32-1) where servers and keys are placed.
- **Virtual nodes (vnodes)**: Multiple positions per physical server on the ring — ensures even distribution.
- **Key remapping**: When a node is added/removed, only keys in the affected range move.
- **Hotspot**: A range of the ring receiving disproportionate key assignments.
- **Rendezvous hashing**: Alternative approach — compute hash(key + each server), pick highest. Simpler but O(N).

## Why It Matters
Any system that distributes data across nodes (databases, caches, CDNs) needs a key distribution strategy. Consistent hashing is the standard solution. Interviewers test this to see if you understand how data gets routed in distributed systems.

## Interview Questions
1. "How would you distribute user data across 100 database shards?"
2. "What happens when you add a new cache server?"
3. "Why not just use modulo hashing (key % N)?"

## Gotchas
- Modulo hashing (key % N) remaps almost ALL keys when N changes — disastrous for caches.
- Without virtual nodes, distribution is uneven — some servers get much more load.
- Consistent hashing doesn't solve the "how many vnodes" question — too few = imbalance, too many = memory overhead.
- Implementation details matter in interviews — know the ring lookup algorithm (binary search).
