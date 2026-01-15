# ADR 0002: Vitest for Testing

## Status

Accepted

## Context

We need a testing framework for unit tests, integration tests, and coverage reporting. Options considered:
- Jest
- Vitest
- Node.js built-in test runner
- Mocha + Chai

## Decision

Use Vitest as our testing framework.

## Rationale

1. **Native TypeScript support**: No additional configuration needed
2. **Speed**: Significantly faster than Jest for TypeScript projects
3. **Jest-compatible API**: Familiar for most JavaScript developers
4. **Built-in coverage**: V8 coverage provider works out of the box
5. **Watch mode**: Excellent DX during development
6. **ESM support**: Native ESM without workarounds

## Consequences

**Positive:**
- Fast test execution
- Simple TypeScript setup
- Compatible coverage tools
- Active development and community

**Negative:**
- Slightly less mature than Jest
- Some Jest plugins may not work directly
- Team members need to learn Vitest-specific features

## Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90
      }
    }
  }
})
```
