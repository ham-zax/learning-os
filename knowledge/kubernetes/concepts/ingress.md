# Ingress

## Summary
Ingress exposes HTTP and HTTPS routes from outside the cluster to Services within the cluster. Traffic routing is controlled by rules defined on the Ingress resource, typically via an Ingress Controller.

## Key Points

### Architecture
- **Ingress Resource** — a set of rules for routing external traffic
- **Ingress Controller** — the actual component that fulfills the Ingress (nginx, traefik, HAProxy, etc.)
- Kubernetes doesn't include an Ingress Controller — you must deploy one
- The controller watches Ingress resources and configures its reverse proxy accordingly

### Ingress Rules
```yaml
spec:
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 80
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80
```

### Path Types
- `Prefix` — match URL prefix (e.g., `/api` matches `/api/v1`, `/api/users`)
- `Exact` — exact URL match only (e.g., `/api` matches only `/api`)
- `ImplementationSpecific` — depends on the Ingress Controller

### TLS Termination
```yaml
spec:
  tls:
  - hosts:
    - app.example.com
    secretName: app-tls-secret
```
- Ingress Controller terminates TLS using certificate from the referenced Secret
- Pass `--default-ssl-certificate` to the controller for a wildcard default

### IngressClass
- Multiple Ingress Controllers can coexist
- `ingressClassName` field on Ingress selects which controller handles it
- Default IngressClass: set via annotation `ingressclass.kubernetes.io/is-default-class`

### Annotations
- Ingress Controllers are configured via annotations on the Ingress resource
- These are controller-specific (nginx uses different annotations than traefik)
- Examples: rate limiting, rewrite rules, CORS, authentication

### Common Ingress Controllers
- **NGINX Ingress** — most popular, two variants (community and NGINX Inc)
- **Traefik** — auto-discovery, Let's Encrypt integration
- **HAProxy** — high performance, enterprise features
- **AWS ALB Ingress** — provisions AWS ALB, L7 routing
- **Gateway API** — the successor to Ingress (more expressive)

### Default Backend
- Handles requests that don't match any rule
- Often configured to return 404 or serve a default page
- Specified as `defaultBackend` in the Ingress spec

## Gotchas
- Ingress is L7 (HTTP/HTTPS only) — for TCP/UDP, use LoadBalancer Service or Gateway API
- Annotations are not portable between Ingress Controllers
- Ingress doesn't handle cross-namespace routing natively (each rule targets a Service in its own namespace)
- Path matching behavior varies between controllers (trailing slashes, case sensitivity)
- TLS secret must exist in the same namespace as the Ingress resource
- Gateway API is replacing Ingress for new features — consider it for new projects
