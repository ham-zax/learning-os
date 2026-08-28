# Helm

## Summary
Helm is the package manager for Kubernetes. It packages applications as Charts — collections of YAML templates that are rendered with configurable values. Think of it as apt/yum for Kubernetes.

## Key Points

### Core Concepts

**Chart**
- A package of pre-configured Kubernetes resources
- Contains templates, default values, and metadata
- Versioned and distributable (like a .deb or .rpm)

**Repository**
- A collection of Charts available for download
- Public repos: ArtifactHub, Bitnami
- Private repos: internal Helm chart repos

**Release**
- A specific deployment of a Chart with a set of values
- Same Chart can be installed multiple times with different release names
- Each release has its own revision history

**Values**
- Configuration that overrides Chart defaults
- Provided via `values.yaml`, `--set`, or `--values` flag

### Chart Structure
```
mychart/
  Chart.yaml          # Metadata (name, version, description)
  values.yaml         # Default values
  templates/          # Kubernetes manifest templates
    deployment.yaml
    service.yaml
    ingress.yaml
    _helpers.tpl      # Template helpers
    NOTES.txt         # Post-install notes
  charts/             # Dependencies (subcharts)
  .helmignore         # Files to exclude when packaging
```

### Template Syntax
- Uses Go templates with Sprig functions
- `{{ .Values.key }}` — reference values
- `{{ .Release.Name }}` — release name
- `{{ include "chart.fullname" . }}` — call template helpers
- `{{ if }}...{{ else }}...{{ end }}` — conditionals
- `{{ range }}...{{ end }}` — loops

### Lifecycle Commands
- `helm install <release> <chart>` — install a chart
- `helm upgrade <release> <chart>` — upgrade a release
- `helm upgrade --install <release> <chart>` — install or upgrade (idempotent)
- `helm uninstall <release>` — remove a release
- `helm rollback <release> <revision>` — rollback to a previous revision
- `helm list` — list all releases
- `helm history <release>` — view revision history
- `helm template <chart>` — render templates locally (dry-run)
- `helm lint <chart>` — validate chart

### Values Precedence (highest to lowest)
1. `--set` flags
2. `--values` files
3. `values.yaml` in the chart
4. Subchart `values.yaml` (dependency defaults)
5. Chart's `values.yaml`

### Dependencies
- Defined in `Chart.yaml` under `dependencies`
- `helm dependency update` — download dependencies to `charts/`
- Can be a local path, OCI registry, or HTTP repo
- Subchart values are namespaced: `subchartName.key`

### Helm Hooks
- Annotate resources to run at specific lifecycle points
- `pre-install`, `post-install`, `pre-upgrade`, `post-upgrade`, `pre-delete`, `post-delete`
- Use cases: database migrations, backups, notifications
- Hook weight controls execution order

### Chart Repositories
- HTTP-based (traditional) — `helm repo add <name> <url>`
- OCI-based (modern) — `helm install <release> oci://registry/repo/chart`
- OCI is the future — supports any OCI-compliant registry (Harbor, ECR, GCR)

## Gotchas
- `helm upgrade` without `--install` fails if release doesn't exist
- Values from `--set` are strings — `--set count=3` becomes `count: "3"` (use `--set-json` for types)
- Deleting a release doesn't delete CRDs — they persist across installs/uninstalls
- `helm template` doesn't contact the cluster — can't detect server-side issues
- Subchart values must be prefixed with the subchart name
- Helm 2 vs 3: Helm 3 removed Tiller (server-side component) — Helm 2 is EOL
- Chart versions and app versions are independent (`version` vs `appVersion` in Chart.yaml)
