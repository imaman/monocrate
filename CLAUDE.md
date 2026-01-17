# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run build          # Compile TypeScript (tsc)
npm test               # Run tests once (vitest run)
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report
npm run lint           # Run ESLint on src/
npm run lint:fix       # Auto-fix lint issues
npm run typecheck      # Type-check without emitting (tsc --noEmit)
```

Run a single test file:
```bash
npx vitest run src/monocrate.test.ts
```

Run tests matching a pattern:
```bash
npx vitest run -t "pattern"
```

## What Monocrate Does

Publishing a package from a monorepo to npm is painful when your package depends on other internal packages (like `@myorg/utils`). npm doesn't understand workspace dependencies, forcing you to either publish every internal dependency separately, manually bundle and merge dependencies, or use complex build pipelines that lose module structure.

Monocrate solves this by bundling a package and all its in-repo dependencies into a single publishable unit. In-repo dependencies get inlined via esbuild; third-party dependencies are collected from all packages and merged into a single output package.json.

Only `dependencies` are traversed and included—`devDependencies` are ignored entirely. This is because devDependencies are only needed during development (build tools, test frameworks, linters); consumers of the published package don't need them at runtime.

## Architecture

### Main Responsibilities

- `main.ts` - CLI entry point (shebang)
- `monocrate-cli.ts` - CLI argument parsing (uses citty)
- `index.ts` - Library exports (public API re-exports)

### Core Flow

The `monocrate()` function orchestrates: discover monorepo root → build dependency graph → bundle with esbuild → transform package.json → write output.

Key architectural decisions:
- **esbuild plugin**: Custom resolver plugin maps in-repo package names to their entry points

### Testing

Tests use helper utilities:
- `folderify(recipe)`: Creates temp directory structure from object DSL
- `unfolderify(dir)`: Reads directory back to recipe for assertions

Coverage thresholds: 90% lines/functions/statements, 85% branches.

## TypeScript Configuration

Strict mode with additional checks: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters`.
