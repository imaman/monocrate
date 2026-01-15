# ADR 0003: Commander for CLI Framework

## Status

Accepted

## Context

We need a CLI framework for argument parsing, help generation, and command structure. Options considered:
- commander
- yargs
- meow
- oclif
- cac

## Decision

Use `commander` for the CLI framework.

## Rationale

1. **Simplicity**: Minimal API surface, easy to learn
2. **Maturity**: Widely used, battle-tested, well-maintained
3. **Minimal dependencies**: Few transitive dependencies
4. **TypeScript support**: Good type definitions
5. **Right-sized**: Not too minimal (meow), not too heavy (oclif)
6. **Familiarity**: Most Node.js developers have used it

## Alternatives Considered

| Framework | Pros | Cons | Verdict |
|-----------|------|------|---------|
| yargs | Powerful, great TypeScript | Heavy, complex API | Too much |
| meow | Minimal, simple | Too minimal, no subcommands | Too little |
| oclif | Enterprise-grade | Way overkill, heavy | Wrong tool |
| cac | Light, modern | Less mature, smaller community | Too risky |

## Consequences

**Positive:**
- Quick to implement
- Easy for contributors to understand
- Minimal dependency footprint
- Good documentation

**Negative:**
- Less "magic" than yargs (more manual setup)
- No built-in completion generation (need separate lib)

## Usage Example

```typescript
import { program } from 'commander'

program
  .name('monocrate')
  .description('Bundle monorepo packages for npm publishing')
  .version('1.0.0')

program
  .command('pack <package>')
  .description('Pack a package for publishing')
  .option('-o, --output <dir>', 'Output directory')
  .option('-d, --dry-run', 'Show what would be done')
  .action((packageName, options) => {
    // Implementation
  })

program.parse()
```
