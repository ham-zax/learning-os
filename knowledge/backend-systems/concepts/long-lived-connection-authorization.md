---
id: long-lived-connection-authorization
title: "Long-lived connection authorization"
difficulty: 3
prerequisites: ["authorization-and-tenant-isolation"]
tags: [coding-course, revision-first]
---

# Long-lived connection authorization

## Summary
A successful WebSocket or SSE handshake only proves the caller was authorized at connection open time. Permissions, memberships, and sessions change while a socket remains open, so subscriptions, inbound mutations, and revocation require explicit server-side enforcement beyond the handshake.

## Key Points
- **Handshake ≠ permanent grant:** authenticating the HTTP upgrade request establishes identity once, not permanent authorization for every channel or message sent hours later.
- **Per-message & per-subscription checks:** validate authorization when subscribing to a room/topic and before executing any privileged inbound command over the socket.
- **Revocation ownership:** define how permission removal or logout propagates to live connections — via short-lived token revalidation, server-side revocation pub/sub that tears down or unsubscribes active sockets, or per-event authorization lookup.
- **Bounded stale-permission window:** state explicitly whether a revoked user is cut off immediately (push-driven disconnect/unsubscribe) or within a bounded re-check interval, and match that window to the data sensitivity.

## Frontend-to-Backend Transfer
- **Transfers cleanly:** Reconnecting WebSocket lifecycles and subscribing/unsubscribing channels in client state.
- **Breaks when assumed:** On the frontend, `logout()` closes the socket from the user's own browser; when an *admin* revokes a malicious or departed user's access, the remote client has no incentive to disconnect — the server must terminate or reject further events.

## Deep Dive
Consider a multi-tenant live dashboard streaming order updates over WebSockets. A user joins with a valid JWT valid for 1 hour, and 5 minutes later their org admin removes them from the project. If the server only checked the JWT at handshake, the removed user keeps receiving live events for 55 minutes (or indefinitely if the socket never drops). Publishing a revocation event to a shared pub/sub channel (or checking session/membership state on sensitive actions) lets every API replica evict the subscription or close the socket deterministically.

## Common Misconceptions
- Assuming an authenticated WebSocket upgrade guarantees authorization for the lifetime of the socket.
- Relying on stateless JWT expiry alone when immediate revocation of live subscriptions is required.

## Practice Questions
- A user loses project access while subscribed to a WebSocket stream across 6 API replicas. Design the revocation path and define what happens to both outbound stream events and inbound mutation messages.
- Why is per-message authorization costlier than handshake-only auth, and how can you balance latency with timely revocation?

## Sources
- [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP WebSocket security](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html)

## Course route
[Authorization and long-lived connections](../units/b05.md)
