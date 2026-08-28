# DaemonSets, Jobs, and CronJobs

## Summary
DaemonSets ensure a copy of a Pod runs on every (or selected) node. Jobs run Pods to completion. CronJobs schedule Jobs on a recurring basis. These are the workload types beyond Deployments and StatefulSets.

## DaemonSets

### What They Do
- Ensures exactly one Pod replica runs on each node (or a subset of nodes)
- When a new node joins, a Pod is automatically added
- When a node is removed, the Pod is garbage collected

### Common Use Cases
- Log collectors (Fluentd, Filebeat)
- Node monitoring agents (Prometheus Node Exporter, Datadog)
- Network plugins (Calico, Cilium node agents)
- Storage daemons (Ceph, GlusterFS)

### Node Selection
- `nodeSelector` — run only on nodes with specific labels
- `affinity` — more expressive node selection
- `tolerations` — run on tainted nodes (e.g., master nodes)

### Update Strategy
- `RollingUpdate` — gradually replace Pods (default)
- `maxUnavailable` — how many can be down during update (default: 1)
- `OnDelete` — only update when Pod is manually deleted

## Jobs

### What They Do
- Run one or more Pods to **completion**
- Job succeeds when a specified number of Pods complete successfully
- Failed Pods are automatically restarted (backoff limit)

### Job Types
- **Non-parallel Job** — single Pod, runs once
- **Parallel Job with fixed completion count** — `completions: 5`, runs 5 Pods
- **Parallel Job with work queue** — multiple Pods, first to complete marks job done

### Key Fields
- `completions` — how many successful Pod completions needed (default: 1)
- `parallelism` — how many Pods to run concurrently (default: 1)
- `backoffLimit` — number of retries before marking Job as failed (default: 6)
- `activeDeadlineSeconds` — timeout for the Job
- `ttlSecondsAfterFinished` — auto-cleanup after completion (TTL mechanism)

### Pod Failure Handling
- Pod failure increments the backoff counter
- Job controller creates new Pods to replace failed ones
- After `backoffLimit` is reached, Job is marked as Failed
- `restartPolicy` must be `Never` or `OnFailure` (not `Always`)

## CronJobs

### What They Do
- Schedule Jobs on a recurring basis (like crontab)
- Each scheduled execution creates a Job object
- Cron expression format: `<minute> <hour> <day-of-month> <month> <day-of-week>`

### Key Fields
- `schedule` — cron expression
- `concurrencyPolicy` — `Allow` (default), `Forbid`, or `Replace`
  - `Allow` — allow concurrent Jobs
  - `Forbid` — skip if previous Job still running
  - `Replace` — cancel running Job, start new one
- `startingDeadlineSeconds` — how late a Job can start (missed schedule)
- `successfulJobsHistoryLimit` — how many completed Jobs to keep (default: 3)
- `failedJobsHistoryLimit` — how many failed Jobs to keep (default: 1)

### Concurrency Edge Cases
- If `startingDeadlineSeconds` is set and a Job misses its window, it's skipped
- CronJob controller checks every 10 seconds; very short intervals (< 1 minute) may miss runs
- `Forbid` prevents overlapping but doesn't queue — the missed run is skipped

## Gotchas
- DaemonSet Pod has `nodeAffinity` set automatically — don't override it
- DaemonSet update can be disruptive if `maxUnavailable` is too high
- Job `restartPolicy: Always` (default for Pods) is invalid for Jobs — must be `Never` or `OnFailure`
- CronJob timezone depends on controller-manager's timezone (Kubernetes 1.27+ supports `timeZone` field)
- TTL mechanism requires `TTLAfterFinished` feature gate (enabled by default in 1.23+)
- Jobs with `parallelism > 1` and `completions > 1` need external coordination for work distribution
