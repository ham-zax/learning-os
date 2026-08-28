---
name: testing-patterns
description: Testing conventions and patterns for agent sessions.
---

# Testing Patterns

## Test Structure

```typescript
describe('feature', () => {
  it('should do X when Y', () => {
    // Arrange
    // Act
    // Assert
  });
});
```

## Test Types

- **Unit tests** — Test individual functions/methods
- **Integration tests** — Test component interactions
- **E2E tests** — Test full user flows

## Vitest Configuration

- Use `pool: 'threads'` (never `pool: 'forks'`)
- Use `--max-old-space-size=4096` for large projects
- Use `--incremental` for faster re-runs

## Test Naming

- Use descriptive names: `should return 404 when user not found`
- Group by feature: `describe('UserService', () => { ... })`
- Use `it` for individual cases: `it('should validate email', () => { ... })`

## Mocking

- Mock external dependencies (APIs, databases)
- Don't mock internal modules (test through public interfaces)
- Use `vi.mock()` for module mocking
- Use `vi.fn()` for function mocking

## Coverage

- Aim for 80%+ coverage on critical paths
- Don't chase 100% coverage (diminishing returns)
- Focus on edge cases and error handling
