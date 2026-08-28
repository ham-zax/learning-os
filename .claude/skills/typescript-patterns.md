---
name: typescript-patterns
description: TypeScript coding patterns and conventions for agent sessions.
---

# TypeScript Patterns

## Type Safety

- Use strict TypeScript configuration
- Prefer explicit types over `any`
- Use discriminated unions for state machines
- Use `unknown` instead of `any` for untyped data

## Error Handling

- Use Result types or throw with typed errors
- Always handle errors at boundaries
- Log errors with context for debugging

## Naming Conventions

- PascalCase for types, interfaces, classes
- camelCase for variables, functions, methods
- UPPER_SNAKE_CASE for constants
- Prefix interfaces with `I` only when needed for disambiguation

## File Organization

- One export per file for components
- Group related types in `types.ts` files
- Use barrel exports (`index.ts`) sparingly

## Testing

- Use vitest with `pool: 'threads'` (never `pool: 'forks'`)
- Test behavior, not implementation
- Use descriptive test names
- Mock external dependencies, not internal modules
