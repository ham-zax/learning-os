---
id: dependency-injection
title: Dependency Injection
difficulty: 2
prerequisites: [ioc-container]
tags: [core, foundation]
---

## Summary
Dependency Injection (DI) is a technique where an object's dependencies are provided ("injected") by an external entity rather than created by the object itself. In Spring, the IoC Container is that entity. DI promotes loose coupling and testability.

## Key Points
- **Constructor injection** — dependencies provided via constructor (recommended, immutable)
- **Setter injection** — dependencies provided via setter methods (optional dependencies)
- **Field injection** — dependencies injected directly into fields via `@Autowired` (convenient but hard to test)
- Spring resolves dependencies by type, then by qualifier if ambiguous
- `@Primary` and `@Qualifier` resolve conflicts when multiple beans of same type exist

## Deep Dive
Constructor injection is preferred because:
1. Dependencies are explicit (visible in constructor signature)
2. Object is fully initialized after construction (no partial state)
3. Fields can be `final` (immutable)
4. Easier to test (just pass mocks to constructor)

```java
// Constructor injection (recommended)
@Service
public class OrderService {
    private final PaymentGateway gateway;
    private final OrderRepository repo;

    public OrderService(PaymentGateway gateway, OrderRepository repo) {
        this.gateway = gateway;
        this.repo = repo;
    }
}

// Field injection (convenient but testability tradeoff)
@Service
public class OrderService {
    @Autowired private PaymentGateway gateway;
    @Autowired private OrderRepository repo;
}
```

## Practice Questions
1. What are the three types of DI in Spring? Which is recommended and why?
2. How does Spring resolve ambiguity when multiple beans of the same type exist?
3. Why does field injection make testing harder?

## Common Misconceptions
- "Field injection is fine for internal services" → Even internal services need testing; constructor injection is always better
- "DI requires a framework" → DI is a pattern; you can do it manually (manual wiring). Spring automates it
- "@Autowired on constructor is optional since Spring 4.3" → Only for single-constructor classes; explicit is clearer

## References
- Martin Fowler: Inversion of Control Containers and the Dependency Injection Pattern
- Spring Framework Docs: Dependency Injection
