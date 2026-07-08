# API Gateway

## Definition
An API Gateway is a single entry point for all client requests in a microservice architecture. It handles cross-cutting concerns like authentication, rate limiting, request routing, and response transformation before forwarding requests to the appropriate backend services.

## Key Terms
- **Request routing**: Directing requests to the correct backend service based on path, headers, etc.
- **Authentication/Authorization**: Verifying identity and permissions at the gateway level.
- **Rate limiting**: Enforcing request quotas per client/API key.
- **Request/response transformation**: Modifying headers, body format, or protocol.
- **API versioning**: Routing to different backend versions (v1, v2) based on path or header.
- **Backend for Frontend (BFF)**: Separate gateway per client type (mobile, web, IoT).
- **Service composition**: Aggregating responses from multiple services into one response.
- **Circuit breaking**: Preventing cascading failures by stopping requests to unhealthy services.
- **Kong, AWS API Gateway, Envoy**: Common gateway implementations.

## Why It Matters
API Gateways are the front door of microservice architectures. They centralize concerns that would otherwise be duplicated across services. Interviewers test whether you understand what belongs at the gateway vs in the service.

## Interview Questions
1. "How would you design the API layer for this microservice system?"
2. "What logic belongs in the gateway vs in the service?"
3. "How do you handle API versioning?"

## Gotchas
- The gateway can become a bottleneck or single point of failure — need redundancy and scaling.
- Don't put business logic in the gateway — it's for cross-cutting concerns only.
- BFF pattern adds complexity but improves client experience — worth it for mobile/web split.
- Gateway adds latency — keep it thin. Heavy transformation slows everything down.
- API versioning strategy matters: URL path (/v1/) vs header vs query param — each has trade-offs.
