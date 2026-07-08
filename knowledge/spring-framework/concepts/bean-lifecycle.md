---
id: bean-lifecycle
title: Bean Lifecycle
difficulty: 3
prerequisites: [beans]
tags: [core, advanced]
---

## Summary
The Spring Bean Lifecycle is the sequence of events from bean instantiation to destruction. Understanding it is crucial for hooking into initialization, customizing behavior, and debugging issues. The container orchestrates this entire process.

## Key Points
- Lifecycle phases: Instantiation → Population → Initialization → Ready → Destruction
- **Instantiation** — container calls constructor or factory method
- **Population** — inject dependencies (DI happens here)
- **Initialization** — `@PostConstruct`, `InitializingBean.afterPropertiesSet()`, custom init method
- **Destruction** — `@PreDestroy`, `DisposableBean.destroy()`, custom destroy method

## Deep Dive
Order of callbacks:
1. Constructor
2. Setter/field injection
3. `BeanNameAware.setBeanName()` (if implemented)
4. `BeanFactoryAware.setBeanFactory()` (if implemented)
5. `BeanPostProcessor.postProcessBeforeInitialization()`
6. `@PostConstruct`
7. `InitializingBean.afterPropertiesSet()`
8. Custom init method
9. `BeanPostProcessor.postProcessAfterInitialization()`
10. Bean is ready to use
11. `@PreDestroy`
12. `DisposableBean.destroy()`
13. Custom destroy method

```java
@Component
public class DatabaseConnection implements InitializingBean, DisposableBean {
    private Connection conn;

    @Override
    public void afterPropertiesSet() {
        conn = DriverManager.getConnection(url); // init
    }

    @Override
    public void destroy() {
        conn.close(); // cleanup
    }
}
```

## Practice Questions
1. When does dependency injection happen relative to `@PostConstruct`?
2. What's the difference between `InitializingBean` and `@PostConstruct`? Which should you use?
3. What role do `BeanPostProcessor`s play in the lifecycle?

## Common Misconceptions
- "@PostConstruct runs after DI" → Correct, but it runs BEFORE `InitializingBean.afterPropertiesSet()`
- "Prototype beans get @PreDestroy called" → No! Container doesn't manage prototype destruction
- "You need to implement InitializingBean" → Prefer `@PostConstruct` — it's decoupled from Spring API

## References
- Spring Framework Docs: Customizing the Nature of a Bean — Lifecycle Callbacks
