# Volumes and Storage

## Summary
Volumes solve the problem of data persistence in containers. Kubernetes offers several volume types and a storage abstraction layer (PV/PVC) to decouple storage provisioning from consumption.

## Key Points

### Volume Types (Pod-level)

**emptyDir**
- Created when Pod is assigned to a node, deleted when Pod is removed
- Shared between containers in the Pod
- Use cases: scratch space, checkpointing, sharing data between containers
- NOT persistent — data is lost when Pod is deleted

**hostPath**
- Mounts a file or directory from the host node's filesystem
- Security risk: Pod can access host files
- Use cases: accessing Docker socket, node-level logs, single-node testing
- `type: DirectoryOrCreate` ensures the directory exists

**configMap / secret**
- Mounts ConfigMap or Secret data as files
- Managed by Kubernetes, updated automatically

**nfs, cephfs, etc.**
- Direct mount of external storage systems
- Being replaced by CSI (Container Storage Interface) drivers

### Persistent Volumes (PV) and Persistent Volume Claims (PVC)

**PV — Cluster Resource (admin creates)**
- Represents a piece of storage in the cluster
- Has a lifecycle independent of any Pod
- Provisioned statically (admin creates) or dynamically (StorageClass)
- Access modes: ReadWriteOnce (RWO), ReadOnlyMany (ROX), ReadWriteMany (RWX)
- Reclaim policy: Retain (keep data), Delete (delete storage), Recycle (deprecated)

**PVC — Namespace Resource (user creates)**
- A request for storage by a user
- Specifies size, access mode, and optionally StorageClass
- Binds to a matching PV (smallest that satisfies the request)
- If no PV matches and StorageClass exists, dynamic provisioning creates one

**Binding**
- Control plane watches for new PVCs and finds matching PVs
- One-to-one binding — once a PVC binds to a PV, it's exclusive
- If no match, PVC stays in Pending state

### StorageClass
- Defines the "class" of storage (SSD, HDD, network storage type)
- Contains provisioner, parameters, and reclaim policy
- Dynamic provisioning: when PVC references a StorageClass, a PV is created automatically
- Default StorageClass: set via annotation `storageclass.kubernetes.io/is-default-class`

### StatefulSet Volume Management
- `volumeClaimTemplates` — creates a PVC per Pod in the StatefulSet
- Each Pod gets its own persistent volume that follows it on rescheduling
- Volume naming: `<template-name>-<statefulset-name>-<ordinal>`

### CSI (Container Storage Interface)
- Standard interface for storage drivers
- Third-party storage can plug in without modifying Kubernetes core
- Most cloud providers have CSI drivers (EBS, GCE PD, Azure Disk)

## Gotchas
- PV is cluster-wide, PVC is namespace-scoped — different RBAC
- RWO means ONE node can write, not one Pod — multiple Pods on same node can share
- Dynamic provisioning requires StorageClass — without it, you must create PVs manually
- Reclaim policy `Delete` destroys data when PVC is deleted — use `Retain` for important data
- hostPath volumes are a security risk in multi-tenant clusters
