---
id: ioc-container
title: IoC Container
difficulty: 2
prerequisites: []
tags: [core, foundation]
---

## Summary
The IoC (Inversion of Control) Container is the core of Spring Framework. It manages the complete lifecycle of application objects (beans) — creating them, wiring dependencies, and managing their destruction. Instead of your code controlling object creation, the container does it.

## Key Points
- IoC inverts traditional control: objects don't create their dependencies; the container provides them
- Two container types: `BeanFactory` (basic) and `ApplicationContext` (extends BeanFactory with enterprise features)
- `ApplicationContext` adds: event publishing, internationalization, AOP integration, resource loading
- Container reads configuration metadata (XML, annotations, Java config) and produces a fully configured system

## Deep Dive
The IoC Container works through three phases:
1. **Configuration Loading** — reads metadata (XML `<beans>`, `@Configuration` classes, component scan)
2. **Bean Instantiation** — creates objects using constructors, factory methods, or factory beans
3. **Dependency Injection** — populates dependencies via constructor args, setter injection, or field injection

Think of it as a smart factory. You describe what you need (configuration), and the container figures out the order of creation, resolves dependencies, and hands you ready-to-use objects.

```java
// Traditional (you control)
UserService service = new UserService(new UserRepository());

// IoC (container controls)
ApplicationContext ctx = new AnnotationConfigApplicationContext(AppConfig.class);
UserService service = ctx.getBean(UserService.class);
```

## Practice Questions
1. What problem does the IoC Container solve that `new` keyword doesn't?
2. What's the difference between `BeanFactory` and `ApplicationContext`?
3. What are the three phases of IoC Container operation?

## Common Misconceptions
- "IoC means I lose control" → You define WHAT to create; the container handles WHEN and HOW
- "BeanFactory is just a simpler ApplicationContext" → ApplicationContext adds event publishing, AOP, resource loading — not just convenience
- "IoC is the same as DI" → IoC is the principle (container controls objects); DI is one technique the container uses

## References
- Spring Framework Docs: IoC Container (docs.spring.io)
