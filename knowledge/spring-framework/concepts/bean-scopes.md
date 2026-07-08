---
id: bean-scopes
title: Bean Scopes
difficulty: 2
prerequisites: [beans]
tags: [core]
---

## Summary
Bean scope defines how many instances of a bean the container creates and how long they live. The default is `singleton` (one per container). Spring provides several scopes for different use cases — from request-scoped web beans to prototype beans that are new every time.

## Key Points
- **singleton** (default) — one instance per Spring container, shared across the application
- **prototype** — new instance every time the bean is requested
- **request** — one instance per HTTP request (web only)
- **session** — one instance per HTTP session (web only)
- **application** — one instance per ServletContext (web only)
- Scopes are set with `@Scope("prototype")` or `@Scope("request")`

## Deep Dive
The tricky part: injecting a shorter-lived bean into a longer-lived one.

```java
@Service // singleton
public class OrderService {
    @Autowired
    private ShoppingCart cart; // request-scoped — PROBLEM!
}
```

This fails because the singleton is created at startup, but the request-scoped bean doesn't exist yet. Solutions:
1. **Proxy mode** — `@Scope(value = "request", proxyMode = ScopedProxyMode.TARGET_CLASS)` creates a proxy that delegates to the current request's instance
2. **ObjectFactory/Provider** — inject `ObjectFactory<ShoppingCart>` and call `getObject()` when needed
3. **Method injection** — `@Lookup` annotation on an abstract method

## Practice Questions
1. What happens if you inject a prototype-scoped bean into a singleton?
2. How does `ScopedProxyMode.TARGET_CLASS` solve the scope mismatch problem?
3. Name three web-specific bean scopes.

## Common Misconceptions
- "Prototype means thread-safe" → Each thread gets its own instance, but the instance itself isn't inherently thread-safe
- "Singleton means there's only one in the JVM" → One per Spring container; multiple containers = multiple instances
- "Request scope works outside web context" → It throws `ScopeNotActiveException` without an active request

## References
- Spring Framework Docs: Bean Scopes
