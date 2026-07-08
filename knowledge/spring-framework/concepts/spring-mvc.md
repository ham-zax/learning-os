---
id: spring-mvc
title: Spring MVC
difficulty: 3
prerequisites: [autowiring, configuration]
tags: [web]
---

## Summary
Spring MVC is Spring's web framework implementing the Model-View-Controller pattern. It handles HTTP requests, maps them to handler methods, processes input, and returns responses. It's the foundation of Spring Boot's web applications.

## Key Points
- **DispatcherServlet** — front controller; receives all requests, delegates to handlers
- **@Controller** / **@RestController** — classes containing request-handling methods
- **@RequestMapping** (and `@GetMapping`, `@PostMapping`, etc.) — maps URLs to methods
- **@PathVariable**, **@RequestParam**, **@RequestBody** — extract data from requests
- **@ResponseBody** — serialize return value directly (no view resolution)
- **@RestController** = `@Controller` + `@ResponseBody` on every method

## Deep Dive
Request flow:
1. HTTP request hits `DispatcherServlet`
2. `HandlerMapping` finds the matching `@Controller` method
3. `HandlerAdapter` invokes the method with resolved parameters
4. Method returns a value (ModelAndView, String view name, or direct response body)
5. `ViewResolver` resolves view name to template (if not `@ResponseBody`)
6. Response sent to client

```java
@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/{id}")
    public User getUser(@PathVariable Long id) {
        return userService.findById(id);
    }

    @PostMapping
    public User createUser(@Valid @RequestBody CreateUserRequest request) {
        return userService.create(request);
    }
}
```

**Exception handling:**
```java
@ControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(UserNotFoundException ex) {
        return ResponseEntity.status(404).body(new ErrorResponse(ex.getMessage()));
    }
}
```

## Practice Questions
1. What is the DispatcherServlet's role in request processing?
2. What's the difference between `@Controller` and `@RestController`?
3. How does `@ControllerAdvice` work and when would you use it?

## Common Misconceptions
- "Spring MVC requires JSP" → Works with any view tech (Thymeleaf, FreeMarker) or no view at all (REST)
- "@PathVariable and @RequestParam are the same" → PathVariable is from URL path (`/users/{id}`), RequestParam is from query string (`?page=1`)
- "You need web.xml for Spring MVC" → Servlet 3.0+ uses `WebApplicationInitializer` (no XML needed)

## References
- Spring Framework Docs: Web MVC Framework
