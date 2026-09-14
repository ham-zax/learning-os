---
id: long-lived-connection-authorization
title: "Long-lived connection authorization"
difficulty: 3
prerequisites: ["authorization-and-tenant-isolation"]
tags: [coding-course, revision-first]
---

# Long-lived connection authorization

## Summary
A successful connection handshake establishes a past decision. Later messages and permission changes can require new authorization checks appropriate to the action and risk.

## Common Misconceptions
- Assuming an open socket grants permanent rights to every subscription or mutation.

## Practice Questions
- A user loses access while subscribed. Define the next-message behavior and the ownership of revocation.

## Teacher use
Select the capability through Learning OS before turning the prompt into an attempt. Freeze the consequential criterion and allowed tools; use one question at a time. A correct explanation does not certify implementation. A provided model is exposure; a repair remains guided until a later qualifying independent attempt. Stop when the selected criterion is sufficiently demonstrated, not after a quota of examples.

## Sources
[OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) covers resource/action enforcement; [OWASP WebSocket security](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html) covers long-lived sessions and message-level authorization. The case is original; consult the relevant section rather than reading both documents end-to-end.

## Course route
[Authorization and long-lived connections](../units/b05.md)
