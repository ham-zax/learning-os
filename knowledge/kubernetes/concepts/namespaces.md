# Namespaces

## Summary
Namespaces provide a mechanism for isolating groups of resources within a single Kubernetes cluster. They are intended for use in environments with many users spread across multiple teams or projects.

## Key Points

### Purpose
- Virtual cluster within a physical cluster
- Resource isolation between teams/environments
- Scope for resource names (same name can exist in different namespaces)
- Basis for RBAC, NetworkPolicy, and resource quotas

### Default Namespaces
- `default` — where Pods go if no namespace specified
- `kube-system` — Kubernetes system components (kubelet, controller-manager, etcd)
- `kube-public` — publicly readable data (cluster info)
- `kube-node-lease` — node heartbeat data

### What is Namespaced vs Not
**Namespaced:** Pods, Services, Deployments, ConfigMaps, Secrets, PVCs
**Not Namespaced:** Nodes, PersistentVolumes, StorageClasses, ClusterRoles

### Resource Quotas per Namespace
- Limit total CPU, memory, number of objects
- Example: `requests.cpu: "4"`, `limits.memory: "8Gi"`, `pods: "20"`
- Without quotas, a single namespace can consume all cluster resources

### LimitRanges per Namespace
- Set default requests/limits for containers in a namespace
- Enforce min/max resource constraints per container
- Prevents containers without explicit resource specs from consuming unbounded resources

### DNS and Namespaces
- Service DNS: `<service-name>.<namespace>.svc.cluster.local`
- Within same namespace: just use `<service-name>`
- Cross-namespace: must use FQDN or `<service>.<namespace>`

### NetworkPolicy and Namespaces
- Can target all Pods in a namespace
- Can allow/deny traffic between namespaces
- Default: all Pods in all namespaces can communicate (no NetworkPolicy)

## Gotchas
- Deleting a namespace deletes ALL resources in it
- Some resources (like ClusterRoles) are not namespaced — they exist cluster-wide
- `kubectl` defaults to `default` namespace — always specify `-n` or use context
- Resource Quotas require requests/limits on all containers; without them, Pods get rejected
