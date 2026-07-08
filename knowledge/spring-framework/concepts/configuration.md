---
id: configuration
title: Configuration Approaches
difficulty: 2
prerequisites: [beans]
tags: [core]
---

## Summary
Spring supports three ways to define beans and wire dependencies: XML configuration, annotation-based configuration, and Java-based configuration. Modern Spring applications predominantly use annotations and Java config, but understanding all three helps with legacy code and choosing the right approach.

## Key Points
- **XML** — original approach; verbose but externalizes configuration
- **Annotations** — `@Component`, `@Autowired`, `@Value`; convenient but couples config to code
- **Java Config** — `@Configuration` + `@Bean` methods; type-safe, refactoring-friendly
- `@Configuration` classes use CGLIB proxy to ensure `@Bean` methods return same singleton instance
- `@Import` combines multiple configuration classes
- `@PropertySource` loads external properties

## Deep Dive
```java
// XML
<bean id="dataSource" class="com.zaxxer.hikari.HikariDataSource">
    <property name="jdbcUrl" value="${db.url}"/>
</bean>

// Java Config
@Configuration
@PropertySource("classpath:db.properties")
public class DataSourceConfig {
    @Value("${db.url}")
    private String url;

    @Bean
    public DataSource dataSource() {
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl(url);
        return ds;
    }
}

// Annotations
@Service
public class UserService {
    @Value("${app.max.retries}")
    private int maxRetries;
}
```

**When to use what:**
- **Java Config** — third-party libraries (you can't annotate their classes), complex wiring logic
- **Annotations** — your own application classes (services, repositories)
- **XML** — legacy codebases, some enterprise environments with ops-managed configs

## Practice Questions
1. Why does `@Configuration` use CGLIB proxying? What would break without it?
2. When would you use `@Bean` in a `@Configuration` class vs `@Component` on the class itself?
3. How do you combine multiple configuration classes?

## Common Misconceptions
- "Java config is always better than XML" → XML is better when ops needs to change config without recompilation
- "@Bean methods are just factory methods" → In a `@Configuration` class, they're intercepted to ensure singleton semantics
- "You must pick one approach" → Mix freely: annotations for your code, Java config for third-party beans

## References
- Spring Framework Docs: Java-based Container Configuration
