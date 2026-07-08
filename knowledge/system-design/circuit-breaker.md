# Circuit Breaker

## Definition
A resilience pattern that prevents cascading failures in distributed systems. When a downstream service fails repeatedly, the circuit breaker "opens" and immediately fails subsequent requests without calling the failing service. After a timeout, it enters a "half-open" state, allowing a few test requests through to check if the service has recovered.

## Key Terms
- **Closed state**: Normal operation — requests pass through to the downstream service.
- **Open state**: Circuit tripped — requests fail immediately without calling downstream.
- **Half-open state**: Testing recovery — limited requests allowed through to probe health.
- **Failure threshold**: Number of failures before the circuit opens (e.g., 5 failures in 60 seconds).
- **Timeout**: Duration the circuit stays open before transitioning to half-open.
- **Fallback**: Alternative response when circuit is open (cached data, default value, error message).
- **Bulkhead pattern**: Isolating failures to prevent one failing service from consuming all resources.
- **Hystrix (legacy), Resilience4j, Polly**: Popular circuit breaker implementations.

## Why It Matters
In microservice architectures, one failing service can cascade and bring down the entire system. Circuit breakers isolate failures and enable graceful degradation. Interviewers test this to see if you design for failure.

## Interview Questions
1. "Service B is slow and causing Service A to hang. How do you fix this?"
2. "How would you prevent cascading failures in this architecture?"
3. "What's the difference between a circuit breaker and a timeout?"

## Gotchas
- Setting the failure threshold too low causes unnecessary circuit opens.
- Not having a fallback means the user just gets an error — consider degraded responses.
- Circuit breakers don't fix the underlying problem — they buy time. You still need monitoring and alerting.
- Half-open state needs careful tuning — too many test requests overwhelm a recovering service.
- Combine with retries (with exponential backoff) for transient failures, but don't retry on circuit open.
