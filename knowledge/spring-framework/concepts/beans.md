---
id: beans
title: Spring Beans
difficulty: 1
prerequisites: [ioc-container]
tags: [core]
---

## Summary
A Spring Bean is any object whose lifecycle is managed by the Spring IoC Container. Beans are the building blocks of a Spring application — services, repositories, controllers, data sources, and more. The container creates, configures, and destroys them.

## Key Points
- Beans are defined via: `@Component`/`@Service`/`@Repository` annotations, `@Bean` methods, or XML `<bean>`
- Each bean has a unique name (defaults to class name with lowercase first letter)
- Beans are singletons by default (one instance per container)
- `@Component` is the generic stereotype; `@Service`, `@Repository`, `@Controller` add semantic meaning and behavior

## Deep Dive
Bean naming:
```java
@Component // bean name = "userService"
public class UserService { }

@Component("myService") // explicit name
public class UserService { }
```

Stereotype annotations and their side effects:
- `@Component` — generic, no special behavior
- `@Service` — semantically a business service (no extra behavior currently)
- `@Repository` — persistence layer; adds automatic exception translation (JDBC/JPA exceptions → Spring's `DataAccessException` hierarchy)
- `@Controller` / `@RestController` — web layer; enables request mapping, `@ResponseBody`

## Practice Questions
1. What is a Spring Bean? How is it different from a regular Java object?
2. What's the default bean scope, and what does that mean?
3. What additional behavior does `@Repository` provide beyond `@Component`?

## Common Misconceptions
- "Beans are just annotated POJOs" → The annotation declares intent; the container's lifecycle management makes them beans
- "@Service adds transaction management" → It doesn't; `@Transactional` does. `@Service` is semantic only
- "Bean name must match class name" → Defaults to it, but can be overridden

## References
- Spring Framework Docs: The IoC Container — Bean Overview
