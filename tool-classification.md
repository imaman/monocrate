# Monorepo Tool Classification

**Purpose:** Direct classification of tools by what they actually do.
**Rule:** Tools that do the same thing get the same description.

---

## Build Orchestration

**What they do:** Execute tasks (build, test, lint) across monorepo packages with dependency-aware ordering and caching.

- **Turborepo** - Build orchestrator with remote caching
- **Nx** - Build orchestrator with remote caching and code generation

---

## Version Management & Publishing Coordination

**What they do:** Coordinate version numbers across multiple packages, generate changelogs, and execute npm publish for each package separately.

- **Lerna** - Version manager and publish coordinator for monorepos
- **Changesets** - Version manager and publish coordinator for monorepos
- **Rush** - Version manager and publish coordinator for monorepos

**Note:** These tools assume each package is independently publishable. They publish N packages to npm. They do not bundle dependencies or rewrite imports.

---

## Workspace Management

**What they do:** Link packages within a monorepo so they can reference each other during development without publishing.

- **npm workspaces** - Workspace manager (built into npm)
- **yarn workspaces** - Workspace manager (built into yarn)
- **pnpm workspaces** - Workspace manager (built into pnpm)

**Note:** pnpm has a `workspace:` protocol for package.json that gets converted to version numbers during publish, but this only affects package.json dependencies, not source code imports.

---

## Dependency Extraction (Without Import Rewriting)

**What they do:** Extract a package and its internal dependencies into a deployment directory with pruned lockfiles.

- **isolate-package** - Extracts packages and internal dependencies to deployment directory

**Limitation:** Does NOT rewrite imports in source code. Output contains `import { foo } from '@myorg/utils'` which remains unresolved outside the monorepo.

---

## Application Bundlers

**What they do:** Transform source code into optimized bundles for deployment. Flatten module structure, inline dependencies, optimize for runtime.

- **esbuild** - Fast JavaScript/TypeScript bundler
- **Rollup** - JavaScript module bundler with tree-shaking
- **Webpack** - Module bundler with extensive plugin ecosystem
- **Parcel** - Zero-config bundler

**Note:** Bundlers are designed for applications (single entry point, all code together) or simple libraries (single-file output). They flatten module boundaries by default. Rollup's `preserveModules` option maintains file structure but still requires separate tooling for TypeScript declarations.

---

## Dependency Extraction + Import Rewriting

**What they do:** Extract a package and its internal dependencies, then rewrite all import statements (in both .js and .d.ts files) from package names to relative paths, producing a self-contained package.

- **monocrate** - Extracts packages with AST-based import rewriting

**Unique capability:** Uses ts-morph (TypeScript Compiler API) to parse and rewrite imports. Handles .js, .ts, and .d.ts files. Preserves module structure for tree-shaking.

---

## Cross-Category Comparison

| Tool | Version Mgmt | Build Orchestration | Workspace Mgmt | Extracts Deps | Rewrites Imports | Output Format |
|------|--------------|---------------------|----------------|---------------|------------------|---------------|
| **Lerna** | ✓ | - | - | - | - | N packages |
| **Changesets** | ✓ | - | - | - | - | N packages |
| **Rush** | ✓ | - | - | - | - | N packages |
| **Turborepo** | - | ✓ | - | - | - | N/A (orchestration only) |
| **Nx** | ✓ | ✓ | - | - | - | N packages |
| **npm/yarn/pnpm** | - | - | ✓ | - | - | N/A (dev linking) |
| **isolate-package** | - | - | - | ✓ | - | 1 package (unresolved imports) |
| **esbuild** | - | - | - | ✓ | ✓ | 1 bundle (flattened) |
| **Rollup** | - | - | - | ✓ | ✓ | 1 bundle or modules |
| **monocrate** | - | - | - | ✓ | ✓ | 1 package (preserved modules) |

---

## Key Distinctions

### Version Management Tools vs. monocrate
- **They do:** Publish N packages separately, each to its own npm entry
- **monocrate does:** Publish 1 package that internally contains N packages

### Bundlers vs. monocrate
- **They do:** Flatten code into single file or chunks, optimize for runtime
- **monocrate does:** Preserve module boundaries, optimize for consumer-side tree-shaking

### isolate-package vs. monocrate
- **isolate-package does:** Copy packages to deployment folder
- **monocrate does:** Copy packages AND rewrite imports so they resolve

### Build Orchestrators vs. monocrate
- **They do:** Execute tasks in dependency order
- **monocrate does:** Create publishable output from task results

---

## What monocrate Is NOT

- **Not a version manager** - Use Changesets or Lerna for that
- **Not a build orchestrator** - Use Turborepo or Nx for that
- **Not a workspace manager** - Use npm/yarn/pnpm workspaces for that
- **Not a bundler** - Use esbuild/Rollup for applications

---

## What monocrate IS

**A packaging tool** that extracts a subtree from a monorepo and rewrites imports to create a self-contained, publishable package with preserved module structure.

**Complements, not replaces:**
- Version management: Use Changesets for version bumps, monocrate for publishing
- Build orchestration: Use Turborepo for builds, monocrate for packaging output
- Workspaces: Develop with pnpm workspaces, publish with monocrate

---

## The Gap monocrate Fills

**Problem:** "I have Package A that depends on internal Packages B and C. I want to publish one self-contained package to npm."

**Why existing tools don't solve it:**

1. **Version managers (Lerna/Changesets):** Would publish A, B, C as three separate packages
2. **Bundlers (esbuild/Rollup):** Would flatten everything into one file, breaking tree-shaking
3. **isolate-package:** Would copy A, B, C but leave imports unresolved
4. **Build orchestrators (Turborepo/Nx):** Would build everything but not package for publishing

**monocrate solves it:** Extracts A+B+C, rewrites `import {x} from '@myorg/b'` to `import {x} from './deps/b/index.js'`, preserves file structure, handles .d.ts files.

---

## Sources

All tool classifications based on official documentation:
- [Lerna Docs](https://lerna.js.org/)
- [Changesets Docs](https://changesets-docs.vercel.app/)
- [Turborepo Docs](https://turborepo.dev/)
- [Nx Docs](https://nx.dev/)
- [Rush Docs](https://rushjs.io/)
- [npm Workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [isolate-package](https://github.com/0x80/isolate-package)
- [esbuild](https://esbuild.github.io/)
- [Rollup](https://rollupjs.org/)
