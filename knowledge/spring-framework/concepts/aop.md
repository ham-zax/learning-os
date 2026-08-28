---
id: aop
title: Aspect-Oriented Programming
difficulty: 3
prerequisites: [beans, bean-lifecycle]
tags: [core, advanced]
---

## Summary
AOP (Aspect-Oriented Programming) separates cross-cutting concerns (logging, security, transactions) from business logic. Instead of scattering these concerns across every service method, you define them once as "aspects" and Spring weaves them in automatically via proxies.

## Key Points
- **Aspect** — a module of cross-cutting concern (e.g., logging aspect)
- **Join Point** — a point in execution (in Spring: method execution only)
- **Advice** — action taken at a join point (`@Before`, `@After`, `@Around`, `@AfterReturning`, `@AfterThrowing`)
- **Pointcut** — expression that matches join points (`execution(* com.example.service.*.*(..))`)
- **Weaving** — linking aspects with target objects (Spring uses runtime proxying)

## Deep Dive
Spring AOP uses two proxy mechanisms:
1. **JDK Dynamic Proxy** — for interfaces (default)
2. **CGLIB Proxy** — for classes (creates subclass proxy)

```java
@Aspect
@Component
public class LoggingAspect {
    @Before("execution(* com.example.service.*.*(..))")
    public void logMethodCall(JoinPoint jp) {
        System.out.println("Calling: " + jp.getSignature().getName());
    }

    @Around("@annotation(retryable)")
    public Object retry(ProceedingJoinPoint pjp, Retryable retryable) throws Throwable {
        for (int i = 0; i < retryable.maxAttempts(); i++) {
            try { return pjp.proceed(); }
            catch (Exception e) { if (i == retryable.maxAttempts() - 1) throw e; }
        }
        return null;
    }
}
```

**Key gotcha:** Self-invocation bypasses the proxy.
```java
@Service
public class OrderService {
    public void placeOrder() {
        validate(); // calls THIS directly — no AOP!
    }

    @Transactional
    public void validate() { }
}
```
Fix: inject self, use `AopContext.currentProxy()`, or restructure.

## Practice Questions
1. What's the difference between `@Before` and `@Around` advice?
2. Why does self-invocation bypass AOP? How do you fix it?
3. When does Spring use JDK proxy vs CGLIB proxy?

## Common Misconceptions
- "Spring AOP and AspectJ are the same" → Spring AOP is proxy-based (runtime); AspectJ uses compile/load-time weaving (more powerful)
- "AOP is free" → Each proxy adds overhead; excessive aspects make debugging harder
- "Pointcut expressions are type-safe" → They're string-based; typos fail silently at runtime

## References
- Spring Framework Docs: Aspect-Oriented Programming with Spring
