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

## Architecture Overview

Monocrate bundles monorepo packages for npm publishing. It resolves in-repo dependencies, bundles them with esbuild, and generates a unified package.json.

### Module Structure

```
src/
├── main.ts              # CLI entry point (#!/usr/bin/env node)
├── index.ts             # Library exports (public API)
├── monocrate.ts         # Main orchestrator function
├── monocrate-cli.ts     # CLI command definition (citty)
├── bundler.ts           # esbuild bundling with in-repo resolver plugin
├── dependency-graph.ts  # Dependency resolution & graph building
├── monorepo.ts          # Monorepo discovery & package.json reading
├── package-transformer.ts # Output package.json generation
├── types.ts             # Zod schemas and TypeScript types
└── monocrate.test.ts    # E2E tests
```

### Data Flow

1. **monocrate()** (monocrate.ts) - Orchestrator that coordinates:
   - `findMonorepoRoot()` → locate monorepo root by walking up directories
   - `buildDependencyGraph()` → recursively resolve in-repo and third-party deps
   - `bundle()` → esbuild with custom plugin for in-repo resolution
   - `transformPackageJson()` → create minimal output package.json
   - `writePackageJson()` → write to disk

2. **Dependency Resolution** (dependency-graph.ts):
   - Separates in-repo dependencies (bundled) from external dependencies (marked external)
   - Only traverses `dependencies`, not `devDependencies`
   - Uses visited set to handle circular dependencies

3. **Bundling** (bundler.ts):
   - esbuild plugin `createInRepoResolverPlugin()` maps in-repo package names to entry points
   - External deps are not bundled, just declared in output package.json
   - Output: single `index.js` with sourcemap

### Key Types (types.ts)

- `DependencyGraph`: `{root, inRepoDeps[], allThirdPartyDeps}`
- `BundleOptions`: `{sourceDir, outputDir, monorepoRoot?}`
- `BundleResult`: Discriminated union (success/failure)
- `MonorepoPackage`: `{name, path, packageJson}`

### Testing

Tests use helper utilities:
- `folderify(recipe)`: Creates temp directory structure from object DSL
- `unfolderify(dir)`: Reads directory back to recipe for assertions
- `runMonocrate()`: Bundles and executes output to verify behavior

Tests are co-located in `src/monocrate.test.ts`. Coverage thresholds: 90% lines/functions/statements, 85% branches.

## TypeScript Configuration

Strict mode enabled with additional checks:
- `noUncheckedIndexedAccess`: Array/object access returns `T | undefined`
- `exactOptionalPropertyTypes`: Distinguishes `undefined` from missing properties
- `noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters`
