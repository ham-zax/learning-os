# Services

## Summary
A Service is an abstract way to expose an application running on a set of Pods as a network service. It provides stable networking (DNS name and IP) for ephemeral Pods.

## Key Points

### Why Services?
- Pods have ephemeral IPs that change on restart
- Services provide a stable virtual IP (ClusterIP) and DNS name
- Load-balance traffic across matching Pods
- Decouple frontend from backend — frontend talks to Service, not Pods

### Service Types

**ClusterIP** (default)
- Internal-only virtual IP
- Accessible only within the cluster
- DNS: `<service>.<namespace>.svc.cluster.local`

**NodePort**
- Exposes the Service on a static port (30000-32767) on every node
- Accessible from outside: `<NodeIP>:<NodePort>`
- Also creates a ClusterIP

**LoadBalancer**
- Provisions an external load balancer (cloud provider specific)
- Gets an external IP address
- Also creates a NodePort and ClusterIP

**ExternalName**
- Maps a Service to a DNS name (CNAME record)
- No proxying — just DNS redirection
- Use case: pointing to an external database

### Service Discovery

**Environment variables**
- kubelet adds `<SERVICE_NAME>_SERVICE_HOST` and `<SERVICE_NAME>_SERVICE_PORT` to every Pod
- Service must exist before Pod for this to work

**DNS** (preferred)
- `<service-name>` — same namespace
- `<service-name>.<namespace>` — cross-namespace
- `<service-name>.<namespace>.svc.cluster.local` — FQDN

### Selectors and Endpoints
- Service uses `selector` to find matching Pods (by label)
- Endpoints object tracks the actual Pod IPs matching the selector
- A Service with no selector creates no Endpoints — you manage them manually
- Use case: external service, or migration between in-cluster and external

### Headless Services
- `clusterIP: None` — no virtual IP
- DNS returns the Pod IPs directly
- Use for StatefulSets (stable DNS per Pod) or when client needs to discover all backends

### Session Affinity
- `sessionAffinity: ClientIP` — requests from same client IP go to same Pod
- Default: `None` (round-robin)
- Not the same as sticky sessions at the application layer

## Gotchas
- Service load balancing is L4 (TCP/UDP), not L7 — no path-based routing (use Ingress for that)
- `externalTrafficPolicy: Local` preserves source IP but can cause uneven load distribution
- NodePort binds to the same port on ALL nodes, even if no Pods run there
- Deleting and recreating a Service may give it a different ClusterIP (use `ipFamily` for stability)
