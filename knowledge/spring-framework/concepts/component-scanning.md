---
id: component-scanning
title: Component Scanning
difficulty: 2
prerequisites: [configuration, beans]
tags: [core]
---

## Summary
Component scanning automatically discovers and registers beans by scanning the classpath for annotated classes. Instead of declaring every bean explicitly, you annotate your classes and Spring finds them. This is the foundation of Spring Boot's zero-configuration approach.

## Key Points
- `@ComponentScan` tells Spring where to look for `@Component`-annotated classes
- Default scan: the package of the `@Configuration` class and all sub-packages
- `@SpringBootApplication` includes `@ComponentScan` from its base package
- `basePackages` and `basePackageClasses` control scan scope
- Exclude filters: `@ComponentScan(excludeFilters = ...)` skip specific classes

## Deep Dive
```java
// Scans com.example and all sub-packages
@Configuration
@ComponentScan("com.example")
public class AppConfig { }

// Fine-grained control
@ComponentScan(
    basePackages = "com.example",
    includeFilters = @Filter(type = FilterType.ANNOTATION, classes = CustomAnnotation.class),
    excludeFilters = @Filter(type = FilterType.REGEX, pattern = ".*Test.*")
)
```

**Common issue: bean not found**
Symptoms: `NoSuchBeanDefinitionException`
Causes:
1. Class not annotated with `@Component` (or stereotype)
2. Class in wrong package (not under scan base)
3. `@ComponentScan` base package doesn't cover the class
4. Exclusion filter accidentally removes it

**Scanning performance:**
- Wider scan = slower startup (Spring has to check more classes)
- Narrow `basePackages` to your application code
- Spring Boot's auto-configuration scans `META-INF/spring.factories`, not classpath

## Practice Questions
1. What happens if you don't specify `basePackages` in `@ComponentScan`?
2. Why might a `@Service` class not be found even though it's annotated correctly?
3. How does Spring Boot's `@SpringBootApplication` relate to component scanning?

## Common Misconceptions
- "Component scanning is free" → It has startup cost; narrowing packages helps
- "All @Component classes are always found" → Only if they're under the scan base package
- "@SpringBootApplication scans everything" → Only the package it's in and sub-packages

## References
- Spring Framework Docs: Using @ComponentScan
