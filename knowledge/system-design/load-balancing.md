# Load Balancing

## Definition
A load balancer distributes incoming network traffic across multiple backend servers to ensure no single server is overwhelmed. It sits between clients and servers, routing requests based on various algorithms.

## Key Terms
- **Round-robin**: Requests distributed sequentially (1, 2, 3, 1, 2, 3...).
- **Weighted round-robin**: More powerful servers get proportionally more requests.
- **Least connections**: Route to the server with fewest active connections.
- **IP hash**: Route based on client IP — ensures same client hits same server (sticky sessions).
- **Health checks**: Periodic probes to detect and remove unhealthy servers from the pool.
- **Layer 4 vs Layer 7**: L4 routes based on IP/port (fast), L7 routes based on content (flexible).
- **Sticky session**: Binding a client to one server for the duration of a session.
- **Reverse proxy**: Load balancer that sits in front of servers (vs forward proxy in front of clients).

## Why It Matters
Load balancers are the entry point of any scalable architecture. They enable horizontal scaling, high availability, and zero-downtime deployments. Every system design diagram includes one.

## Interview Questions
1. "How would you distribute traffic across 10 servers?"
2. "What happens when a server goes down behind a load balancer?"
3. "How do you handle sticky sessions with horizontal scaling?"

## Gotchas
- Forgetting health checks — without them, traffic goes to dead servers.
- Sticky sessions break horizontal scaling benefits — externalize session state instead.
- Single load balancer is a single point of failure — need redundancy (active-passive or active-active).
- Not considering that L7 load balancing adds latency vs L4.
