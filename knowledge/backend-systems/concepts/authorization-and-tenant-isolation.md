---
id: authorization-and-tenant-isolation
title: "Authorization and tenant isolation"
difficulty: 2
prerequisites: ["server-request-lifecycle-and-network-boundaries"]
tags: [coding-course, revision-first]
---

# Authorization and tenant isolation

## Summary
Authenticate identity, then authorize the requested action on the actual target resource and tenant on the server. Derive tenant membership from server-trusted identity or durable state — never from URL parameters or request bodies — and reinforce isolation at the data-access boundary.

## Key Points
- **Authentication vs. authorization:** proving who the caller is (valid session/JWT) does not prove they may read or mutate `:organizationId` or `:invoiceId` (preventing broken object-level authorization / IDOR).
- **Trusted tenant binding:** derive allowed `tenant_id` from server-verified identity/membership state; treat client-supplied IDs as untrusted selectors that must match the caller's authorized tenant.
- **Defense in depth:** enforce tenant scoping in every data-access query (`WHERE id = $1 AND tenant_id = $2`) AND add an independent boundary (e.g., PostgreSQL Row-Level Security or a mandatory tenant-scoped repository layer) so one missed handler check cannot leak cross-tenant rows.
- **Audit observability:** log actor identity, authenticated tenant, target tenant/resource, action, and explicit authorization outcome (`allow`/`deny` + reason) so attempted or accidental cross-tenant access is detectable.

## Frontend-to-Backend Transfer
- **Transfers cleanly:** Role-based UI gating gives good UX and maps cleanly to conceptual permissions.
- **Breaks when assumed:** Hiding a button, guarding a React/Angular route, or passing `orgId` from client state provides **zero security**; any user can replay or edit the HTTP request directly via DevTools or `curl`.

## Deep Dive
In a shared-database multi-tenant SaaS (`Acme` and `Globex` in the same Postgres tables), every request must pass four layers: (1) verify session/token integrity and resolve the caller's active tenant membership, (2) authorize the requested verb on the target resource, (3) bind the tenant predicate at the query/repository and optionally PostgreSQL RLS layer so a raw `invoiceId` lookup cannot cross tenants, and (4) emit structured security audit events recording who asked for what resource under which tenant and whether the server allowed or denied it.

## Common Misconceptions
- Trusting `:organizationId` in the URL or request body because the user has a valid login session.
- Relying on a single handler `if` check with no data-layer enforcement, or logging only actor + timestamp without target tenant/resource and allow/deny outcome.

## Practice Questions
- A logged-in Acme user calls `GET /api/organizations/globex/invoices/inv_99`. Trace the exact server checks, database boundary, and audit fields required to reject and detect the attempt.
- Why should a forgotten tenant check in one API route not be able to dump another organization's rows?

## Sources
- [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

## Course route
[Authorization and long-lived connections](../units/b05.md)
