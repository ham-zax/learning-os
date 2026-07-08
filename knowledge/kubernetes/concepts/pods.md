# Pods

## Summary
A Pod is the smallest deployable unit in Kubernetes. It represents one or more containers that share storage, network, and a specification for how to run.

## Key Points

### What is a Pod?
- Atomic scheduling unit — Kubernetes always schedules a whole Pod, never a container alone
- Containers in a Pod share the same network namespace (same IP, same port space)
- They can share volumes (shared filesystem)
- Typically one container per Pod; sidecar pattern uses multiple

### Pod Lifecycle
- Pods are **ephemeral** — they are never rescheduled, only replaced
- When a Pod dies, it's gone. A new Pod with a different IP may replace it
- This is why you never address Pods directly — use a Service instead

### Pod Phases
- `Pending` — accepted but containers not yet running (pulling images, waiting for scheduling)
- `Running` — at least one container is running
- `Succeeded` — all containers terminated with exit code 0 (won't restart)
- `Failed` — at least one container terminated with non-zero exit code
- `Unknown` — state can't be obtained (node communication failure)

### Pod Conditions
- `PodScheduled` — Pod has been scheduled to a node
- `ContainersReady` — all containers in the Pod are ready
- `Initialized` — all init containers completed successfully
- `Ready` — Pod can serve requests (containers passed readiness probes)

### Init Containers
- Run **before** app containers start
- Must complete successfully before the next container starts
- Use cases: wait for a service, set up config, clone a git repo
- Each init container runs to completion; if one fails, Kubernetes restarts it

### Probes
- **Liveness probe** — is the container alive? If it fails, kubelet kills and restarts the container
- **Readiness probe** — is the container ready to accept traffic? If it fails, Pod is removed from Service endpoints
- **Startup probe** — has the container started? Disables liveness/readiness until it succeeds (for slow-starting apps)

### Resource Requests and Limits
- `requests` — minimum resources guaranteed (used for scheduling decisions)
- `limits` — maximum resources allowed (exceeding triggers throttling for CPU or OOMKill for memory)
- A Pod that exceeds its memory limit is killed. A Pod that exceeds its CPU limit is throttled

### Pod Termination
1. API server receives delete request, marks Pod as "Terminating"
2. kubelet begins graceful shutdown (sends SIGTERM to containers)
3. After `terminationGracePeriodSeconds` (default 30s), sends SIGKILL
4. Pod is removed from API server

## Common Patterns
- **Sidecar** — helper container in same Pod (logging, proxy, config watcher)
- **Ambassador** — proxy container that simplifies network access
- **Adapter** — transforms output of main container to a standard format

## Gotchas
- Don't create Pods directly — use Deployments, StatefulSets, or Jobs
- Pod IP is temporary — never hardcode it
- Containers in a Pod are always on the same node (can't span nodes)
- `imagePullPolicy: Always` causes issues in air-gapped environments
