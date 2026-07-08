---
id: autowiring
title: Autowiring
difficulty: 2
prerequisites: [dependency-injection, component-scanning]
tags: [core]
---

## Summary
Autowiring is Spring's automatic dependency resolution. Instead of explicitly wiring beans together, Spring matches dependencies by type, name, or qualifier. It's the mechanism that makes DI feel effortless — annotate a field or constructor, and Spring fills it in.

## Key Points
- **By type** (default) — Spring finds a bean matching the declared type
- **By name** — `@Qualifier("beanName")` specifies exact bean
- **By primary** — `@Primary` marks a default when multiple candidates exist
- **Constructor autowiring** — implicit for single-constructor classes (Spring 4.3+)
- `@Autowired(required = false)` — null if no matching bean (default: throws exception)

## Deep Dive
Resolution order when multiple candidates exist:
1. `@Qualifier` match (exact name)
2. `@Primary` bean (default candidate)
3. Match by parameter name (undocumented but works)
4. `NoUniqueBeanDefinitionException` if none of above resolves

```java
// Problem: two PaymentGateway beans
@Component
public class StripeGateway implements PaymentGateway { }

@Component
public class PayPalGateway implements PaymentGateway { }

// Solution 1: @Qualifier
@Service
public class OrderService {
    public OrderService(@Qualifier("stripeGateway") PaymentGateway gateway) { }
}

// Solution 2: @Primary
@Component
@Primary
public class StripeGateway implements PaymentGateway { }

// Solution 3: Custom qualifier annotation
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Qualifier
public @interface Stripe { }
```

## Practice Questions
1. What's the resolution order when multiple beans of the same type exist?
2. When would you use `@Qualifier` vs `@Primary`?
3. What happens if you use `@Autowired(required = false)` and no bean matches?

## Common Misconceptions
- "@Autowired is by name" → It's by type first; name is only a tiebreaker
- "You always need @Autowired" → Not for single-constructor classes (implicit since 4.3)
- "Field injection uses @Autowired, constructor uses @Inject" → Both work for both; @Autowired is Spring-specific

## References
- Spring Framework Docs: Autowiring Collaborators
