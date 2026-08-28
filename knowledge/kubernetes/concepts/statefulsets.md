# StatefulSets

## Summary
StatefulSet manages stateful applications. It provides guarantees about ordering and uniqueness of Pods, stable network identity, and persistent storage — things Deployments cannot offer.

## Key Points

### When to Use StatefulSet
- Stable, unique network identifiers needed
- Stable, persistent storage needed
- Ordered, graceful deployment and scaling needed
- Ordered, automated rolling updates needed
- Examples: databases (PostgreSQL, MySQL), message queues (Kafka, RabbitMQ), distributed systems (ZooKeeper, etcd)

### Stable Network Identity
- Pod name: `<statefulset-name>-<ordinal>` (e.g., `web-0`, `web-1`, `web-2`)
- DNS: `<pod-name>.<service-name>.<namespace>.svc.cluster.local`
- Requires a **headless Service** (`clusterIP: None`) to create DNS entries
- Identity is stable — if `web-0` is rescheduled, it keeps the name `web-0`

### Persistent Storage
- `volumeClaimTemplates` creates a PVC per Pod
- Each Pod binds to its own PVC
- When Pod is rescheduled, it reattaches to the same PVC
- PVC is NOT deleted when Pod is deleted (data survives)
- Must be manually cleaned up if you delete the StatefulSet

### Ordered Operations

**Scaling Up**
- Pods are created sequentially: `web-0` must be Running and Ready before `web-1` starts
- Ensures each member is healthy before adding the next (important for clusters)

**Scaling Down**
- Pods are deleted in reverse order: `web-2` first, then `web-1`, then `web-0`
- Each Pod must be fully terminated before the next one starts terminating
- Ensures quorum is maintained during scale-down

**Rolling Update**
- Updates Pods in reverse ordinal order
- `partition` field: Pods with ordinal >= partition are updated, others are not
- Use case: canary rollout — set partition to N-1 to update only the last Pod first

### Update Strategies
- **RollingUpdate** (default) — reverse-order rolling update
- **OnDelete** — Pod is only updated when manually deleted (legacy behavior)

### Pod Management Policy
- `OrderedReady` (default) — sequential creation/deletion
- `Parallel` — create/delete all Pods simultaneously (for stateless workloads that use StatefulSet only for identity)

## Gotchas
- StatefulSet requires a headless Service — without it, DNS entries aren't created
- Deleting a StatefulSet does NOT delete PVCs — you must clean them up manually
- If a Pod gets stuck, all Pods after it are blocked (no progress)
- `OnDelete` strategy doesn't integrate with `kubectl rollout` commands
- StatefulSet can't do rolling update of the headless Service
- Volume claim templates are immutable — you can't change them after creation
