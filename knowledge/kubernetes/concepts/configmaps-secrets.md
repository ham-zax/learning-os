# ConfigMaps and Secrets

## Summary
ConfigMaps store non-confidential configuration data as key-value pairs. Secrets store sensitive data (passwords, tokens, keys). Both decouple configuration from container images.

## Key Points

### ConfigMaps

**Creating ConfigMaps**
- From literal values: `kubectl create configmap my-config --from-literal=key1=value1`
- From files: `kubectl create configmap my-config --from-file=config.yaml`
- From a manifest: define `data` or `binaryData` fields

**Using in Pods**
- Environment variable: `envFrom` or `env.valueFrom.configMapKeyRef`
- Volume mount: each key becomes a file in the mounted directory
- Sub-path mount: mount a single key as a specific file (doesn't update on ConfigMap change)

**Updates**
- Mounted ConfigMaps update automatically (kubelet syncs, default every 60s)
- Environment variables do NOT update — Pod must be restarted
- Sub-path mounts do NOT update automatically

### Secrets

**Types**
- `Opaque` — generic key-value (default)
- `kubernetes.io/tls` — TLS certificate + key
- `kubernetes.io/dockerconfigjson` — Docker registry credentials
- `kubernetes.io/basic-auth` — username/password
- `kubernetes.io/ssh-auth` — SSH private key
- `kubernetes.io/service-account-token` — auto-generated SA token

**Creating Secrets**
- `kubectl create secret generic my-secret --from-literal=password=abc123`
- `kubectl create secret tls my-tls --cert=tls.crt --key=tls.key`
- Manifest with base64-encoded values in `data` or plain-text in `stringData`

**Security Reality**
- Secrets are base64-encoded, NOT encrypted by default
- Anyone with RBAC read access to Secrets can decode them
- Enable encryption at rest: `EncryptionConfiguration` in API server
- Use external secret managers (Vault, AWS Secrets Manager) for production
- etcd encryption is the minimum — application-level encryption is better

**Using in Pods**
- Environment variable: same pattern as ConfigMap
- Volume mount: each key becomes a file, permissions are 0444 by default
- Image pull secrets: `imagePullSecrets` field in Pod spec

### Immutable ConfigMaps and Secrets
- Set `immutable: true` — prevents accidental updates
- Must delete and recreate to change
- Performance benefit: reduces API server load (no watch needed)
- Use for config that truly never changes (feature flags, bootstrap config)

## Gotchas
- ConfigMap/Secret must exist before Pod that references it (or Pod won't start)
- Secret size limit: 1MB per Secret
- ConfigMap size limit: 1MB per ConfigMap
- `subPath` mounts don't auto-update — prefer volume mounts
- Environment variable names from Secrets can collide with existing env vars
- Base64 is not encryption — anyone with `kubectl get secret` access can read your secrets
