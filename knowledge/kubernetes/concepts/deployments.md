# Deployments

## Summary
A Deployment provides declarative updates for Pods and ReplicaSets. You describe a desired state, and the Deployment controller changes the actual state to match at a controlled rate.

## Key Points

### What a Deployment Manages
- Creates and manages ReplicaSets
- ReplicaSets maintain a stable set of replica Pods
- You almost never create ReplicaSets directly

### Desired State
```yaml
spec:
  replicas: 3          # How many Pods
  selector:            # Which Pods this Deployment owns
    matchLabels:
      app: nginx
  template:            # Pod template
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.25
```

### Rollout Strategies
- **RollingUpdate** (default) — gradually replace old Pods with new ones
  - `maxUnavailable` — max Pods that can be unavailable during update (default: 25%)
  - `maxSurge` — max Pods above desired count during update (default: 25%)
- **Recreate** — kill all old Pods, then create new ones (causes downtime)

### Rollout Commands
- `kubectl rollout status deployment/<name>` — watch rollout progress
- `kubectl rollout history deployment/<name>` — view revision history
- `kubectl rollout undo deployment/<name>` — rollback to previous revision
- `kubectl rollout undo deployment/<name> --to-revision=N` — rollback to specific revision

### How Updates Work
1. You change the Pod template (e.g., new image tag)
2. Deployment detects the change
3. Creates a new ReplicaSet with the new template
4. Scales up new ReplicaSet, scales down old one (based on strategy)
5. Old ReplicaSet is kept (default: 10 revisions) for rollback

### Scaling
- `kubectl scale deployment/<name> --replicas=5`
- Or edit the `replicas` field in the manifest
- HPA (Horizontal Pod Autoscaler) can adjust replicas based on metrics

### Pausing and Resuming
- `kubectl rollout pause deployment/<name>` — pause rollout
- Make multiple changes while paused
- `kubectl rollout resume deployment/<name>` — trigger single rollout with all changes
- Useful for batching multiple config changes into one rollout

## Gotchas
- If you change `.spec.selector`, you break the Deployment — it loses track of existing Pods
- Rolling back reverts the Pod template, not the replica count
- A Deployment with `strategy: RollingUpdate` and `maxUnavailable: 100%` behaves like Recreate
- Deployment doesn't wait for Pods to be Ready before scaling down old ones (use `minReadySeconds`)
