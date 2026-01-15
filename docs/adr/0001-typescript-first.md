# ADR 0001: TypeScript-First Implementation

## Status

Accepted

## Context

Monocrate is a tool for bundling monorepo packages. The primary audience is developers working with TypeScript monorepos. We need to decide the implementation language.

## Decision

Implement Monocrate in TypeScript with strict mode enabled.

## Rationale

1. **Target audience alignment**: Our users primarily work with TypeScript monorepos
2. **Type safety**: Catches bugs at compile time, especially important for file operations
3. **Better DX for contributors**: TypeScript support in IDEs provides autocomplete and inline docs
4. **Self-hosting**: We can use Monocrate on itself (dogfooding)
5. **API types**: Consumers of the programmatic API get type definitions automatically

## Consequences

**Positive:**
- Strong type safety
- Better IDE experience
- Automatic type exports for API consumers
- Attracts TypeScript-savvy contributors

**Negative:**
- Build step required before testing/running
- Slightly higher barrier for JavaScript-only contributors
- Need to maintain tsconfig.json

## Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```
