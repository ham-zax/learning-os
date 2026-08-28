---
id: spring-boot
title: Spring Boot
difficulty: 2
prerequisites: [configuration, autowiring]
tags: [boot]
---

## Summary
Spring Boot is an opinionated layer on top of Spring Framework that eliminates boilerplate configuration. It auto-configures beans based on classpath dependencies, provides embedded servers, and offers production-ready features out of the box. It's the standard way to build Spring applications today.

## Key Points
- **Auto-configuration** — `@EnableAutoConfiguration` configures beans based on classpath (e.g., H2 on classpath → auto-configures DataSource)
- **Starter dependencies** — curated dependency sets (`spring-boot-starter-web`, `spring-boot-starter-data-jpa`)
- **Embedded server** — Tomcat/Jetty/Undertow embedded (no WAR deployment needed)
- **application.properties/yaml** — centralized external configuration
- **Actuator** — production-ready endpoints (health, metrics, info)

## Deep Dive
How auto-configuration works:
1. `@SpringBootApplication` includes `@EnableAutoConfiguration`
2. Spring Boot reads `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
3. Each auto-configuration class uses `@Conditional*` annotations
4. Conditions check: classpath, existing beans, properties, etc.
5. Only matching configurations are applied

```java
@SpringBootApplication // = @Configuration + @EnableAutoConfiguration + @ComponentScan
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

**Overriding auto-config:**
```java
// Define your own DataSource → auto-config backs off
@Configuration
public class DataSourceConfig {
    @Bean
    public DataSource dataSource() {
        return new HikariDataSource(/* custom config */);
    }
}
```

**Profile-specific config:**
```yaml
# application.yml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/dev

---
spring:
  config:
    activate:
      on-profile: prod
  datasource:
    url: jdbc:mysql://prod-server:3306/app
```

## Practice Questions
1. What does `@SpringBootApplication` actually do? (It's a composed annotation)
2. How does Spring Boot decide which auto-configurations to apply?
3. How do you override an auto-configured bean?

## Common Misconceptions
- "Spring Boot is a different framework" → It's Spring + auto-configuration + starters; you can use all Spring features
- "Auto-configuration is magic" → It's conditional; you can see what's applied with `--debug` flag
- "You can't use XML with Spring Boot" → You can; Boot just prefers annotations and Java config

## References
- Spring Boot Docs: Core Features — Developing with Spring Boot
