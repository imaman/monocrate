# Monorepo Tool Classification

**Purpose:** Direct classification of tools by what they actually do.
**Rule:** Tools that do the same thing get the same description.

---

## Build Orchestration

**What they do:** Execute tasks (build, test, lint) across monorepo packages with dependency-aware ordering and caching.

- **[Turborepo](https://turborepo.dev/docs/crafting-your-repository/running-tasks)** - Build orchestrator with remote caching
- **[Nx](https://nx.dev/docs/concepts/how-caching-works)** - Build orchestrator with remote caching and code generation

---

## Version Management & Publishing Coordination

**What they do:** Coordinate version numbers across multiple packages, generate changelogs, and execute npm publish for each package separately.

- **[Lerna](https://lerna.js.org/docs/features/version-and-publish)** - Version manager and publish coordinator for monorepos
- **[Changesets](https://changesets-docs.vercel.app/)** - Version manager and publish coordinator for monorepos
- **[Rush](https://rushjs.io/pages/maintainer/publishing/)** - Version manager and publish coordinator for monorepos

**Note:** These tools assume each package is independently publishable. They publish N packages to npm. They do not bundle dependencies or make packages work standalone.

---

## Workspace Management

**What they do:** Link packages within a monorepo so they can reference each other during development without publishing.

- **[npm workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces/)** - Workspace manager (built into npm)
- **[yarn workspaces](https://yarnpkg.com/features/workspaces)** - Workspace manager (built into yarn)
- **[pnpm workspaces](https://pnpm.io/workspaces)** - Workspace manager (built into pnpm)

**Note:** pnpm has a `workspace:` protocol for package.json that gets converted to version numbers during publish, but this only affects package.json dependencies, not source code imports.

---

## Deployment Packaging (For Platforms Like Firebase)

**What they do:** Extract a package and its internal dependencies into a deployment directory that can be uploaded to platforms with specific deployment constraints.

- **[isolate-package](https://github.com/0x80/isolate-package)** - Extracts packages and internal dependencies to deployment directory with pruned lockfiles

**Use case:** Designed specifically for Firebase Cloud Functions deployment, where the platform needs a flattened directory structure but doesn't run npm install. Copies build output (dist/) from workspace packages into a single directory.

**Critical limitation:** Only copies built files. Does NOT make the package work as a standalone npm package. The output is meant for deployment platforms (Firebase, AWS Lambda) that execute the code directly, NOT for publishing to npm where others will install it.

**Why it doesn't work for npm publishing:**
- Packages still reference each other by workspace names (e.g., `@myorg/utils`)
- Those references work on deployment platforms because all files are present in the deployment bundle
- Those references FAIL when installed from npm because `@myorg/utils` isn't published separately
- When someone does `npm install your-package`, the imports to `@myorg/utils` cannot resolve

---

## Application Bundlers

**What they do:** Transform source code into optimized bundles for deployment. Flatten module structure, inline dependencies, optimize for runtime.

- **[esbuild](https://esbuild.github.io/api/)** - Fast JavaScript/TypeScript bundler
- **[Rollup](https://rollupjs.org/)** - JavaScript module bundler with tree-shaking
- **[Webpack](https://webpack.js.org/concepts/)** - Module bundler with extensive plugin ecosystem
- **[Parcel](https://parceljs.org/docs/)** - Zero-config bundler

**Note:** Bundlers are designed for applications (single entry point, all code together) or simple libraries (single-file output). They flatten module boundaries by default. Rollup's `preserveModules` option maintains file structure but still requires separate tooling for TypeScript declarations.

---

## Standalone Package Publishing (With Import Resolution)

**What they do:** Extract a package and its internal dependencies, then modify all import statements in the code so the package works as a standalone npm package that others can install and use.

- **[monocrate](https://www.npmjs.com/package/monocrate)** - Extracts packages and makes imports work standalone

**Use case:** Publishing to npm so others can `npm install` your package. The package works independently without requiring your internal packages to be published separately.

**What "makes imports work standalone" means:**
- Your code says `import { foo } from '@myorg/utils'`
- After monocrate: code says `import { foo } from './deps/utils/index.js'`
- Result: Package installs and runs without needing `@myorg/utils` published to npm
- Both .js and .d.ts files are updated so JavaScript AND TypeScript types work

**Key difference from isolate-package:**
- **isolate-package:** Copies files for deployment platforms → imports still reference workspace names → works on Firebase/Lambda (entire bundle deployed), fails on npm (package installed alone)
- **monocrate:** Modifies imports to be relative paths → package is self-contained → works when published to npm and installed by others

**Why this matters:** Preserves module structure (unlike bundlers), so consumers can import specific parts and get good tree-shaking. TypeScript types work correctly. Source maps point to the right files.

---

## Cross-Category Comparison

| Tool | Version Mgmt | Build Orchestration | Workspace Mgmt | Extracts Deps | Makes Standalone for npm | Output Format |
|------|--------------|---------------------|----------------|---------------|--------------------------|---------------|
| **[Lerna](https://lerna.js.org/)** | ✓ | - | - | - | - | N packages |
| **[Changesets](https://changesets-docs.vercel.app/)** | ✓ | - | - | - | - | N packages |
| **[Rush](https://rushjs.io/)** | ✓ | - | - | - | - | N packages |
| **[Turborepo](https://turborepo.dev/)** | - | ✓ | - | - | - | N/A (orchestration only) |
| **[Nx](https://nx.dev/)** | ✓ | ✓ | - | - | - | N packages |
| **[npm/yarn/pnpm](https://pnpm.io/workspaces)** | - | - | ✓ | - | - | N/A (dev linking) |
| **[isolate-package](https://github.com/0x80/isolate-package)** | - | - | - | ✓ | ✗ (deployment only) | 1 directory (for platforms) |
| **[esbuild](https://esbuild.github.io/)** | - | - | - | ✓ | ✓ | 1 bundle (flattened) |
| **[Rollup](https://rollupjs.org/)** | - | - | - | ✓ | ✓ | 1 bundle or modules |
| **[monocrate](https://www.npmjs.com/package/monocrate)** | - | - | - | ✓ | ✓ | 1 package (preserved modules) |

---

## Key Distinctions

### Version Management Tools vs. monocrate
- **They do:** Publish N packages separately, each to its own npm entry
- **monocrate does:** Publish 1 package that internally contains N packages

### Bundlers vs. monocrate
- **They do:** Flatten code into single file or chunks, optimize for runtime
- **monocrate does:** Preserve module boundaries, optimize for consumer-side tree-shaking

### isolate-package vs. monocrate
- **isolate-package does:** Copy packages to deployment directory (for Firebase, Lambda)
- **monocrate does:** Copy packages AND modify imports so it works as standalone npm package
- **Key difference:** isolate-package output is meant for platforms that deploy entire directories; monocrate output is meant for npm where users install just your package

### Build Orchestrators vs. monocrate
- **They do:** Execute tasks in dependency order
- **monocrate does:** Create publishable output from task results

---

## What monocrate Is NOT

- **Not a version manager** - Use Changesets or Lerna for that
- **Not a build orchestrator** - Use Turborepo or Nx for that
- **Not a workspace manager** - Use npm/yarn/pnpm workspaces for that
- **Not a bundler** - Use esbuild/Rollup for applications
- **Not a deployment packager** - Use isolate-package if deploying to Firebase/Lambda

---

## What monocrate IS

**A publishing tool** that extracts a subtree from a monorepo and makes it work as a standalone npm package by converting workspace references to relative paths.

**Complements, not replaces:**
- Version management: Use Changesets for version bumps, monocrate for publishing
- Build orchestration: Use Turborepo for builds, monocrate for packaging output
- Workspaces: Develop with pnpm workspaces, publish with monocrate

---

## The Gap monocrate Fills

**Problem:** "I have Package A that depends on internal Packages B and C. I want to publish one self-contained package to npm that others can install."

**Why existing tools don't solve it:**

1. **Version managers (Lerna/Changesets):** Would publish A, B, C as three separate packages
2. **Bundlers (esbuild/Rollup):** Would flatten everything into one file, breaking tree-shaking
3. **isolate-package:** Would copy A, B, C but the output only works for deployment platforms (Firebase, Lambda), not for npm publishing where users install your package alone
4. **Build orchestrators (Turborepo/Nx):** Would build everything but not package for publishing

**monocrate solves it:**
- Extracts A+B+C into one package
- Changes `import {x} from '@myorg/b'` to `import {x} from './deps/b/index.js'`
- Preserves file structure so tree-shaking works
- Updates both .js and .d.ts files so types work
- Output can be published to npm and installed by anyone

---

## Sources

All tool classifications based on official documentation:
- [Lerna - Version and Publish](https://lerna.js.org/docs/features/version-and-publish)
- [Changesets Documentation](https://changesets-docs.vercel.app/)
- [Turborepo - Running Tasks](https://turborepo.dev/docs/crafting-your-repository/running-tasks)
- [Turborepo - Caching](https://turborepo.dev/docs/crafting-your-repository/caching)
- [Nx - How Caching Works](https://nx.dev/docs/concepts/how-caching-works)
- [Nx - Tasks & Caching](https://nx.dev/docs/guides/tasks--caching)
- [Rush - Publishing](https://rushjs.io/pages/maintainer/publishing/)
- [npm Workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces/)
- [Yarn Workspaces](https://yarnpkg.com/features/workspaces)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [isolate-package GitHub](https://github.com/0x80/isolate-package)
- [isolate-package npm](https://www.npmjs.com/package/isolate-package)
- [esbuild - Bundling](https://esbuild.github.io/api/)
- [Rollup Official](https://rollupjs.org/)
- [Webpack Concepts](https://webpack.js.org/concepts/)
- [Parcel Documentation](https://parceljs.org/docs/)
- [monocrate npm](https://www.npmjs.com/package/monocrate)

---

## Technical Evidence: isolate-package Deep Dive

Based on source code analysis and official documentation:

**What isolate-package actually does:**
1. Uses `npm pack` to extract build output (dist/) from each package
2. Copies those files to a deployment directory
3. Generates pruned lockfiles (pnpm) or excludes them (npm/yarn)
4. Does NOT modify any source code or imports
5. Output contains package.json files that still reference workspace packages by name

**Why it works for Firebase/Lambda:**
- These platforms upload your entire directory and run it directly
- All packages are present in the deployment bundle
- Import statements like `import { foo } from '@myorg/utils'` work because `@myorg/utils` is in the bundle

**Why it doesn't work for npm publishing:**
- When someone does `npm install your-package`, they get just your package
- Import statements to `@myorg/utils` fail because that package isn't published
- The package is NOT self-contained

**Source:** [isolate-package GitHub repository](https://github.com/0x80/isolate-package) - specifically designed for Firebase Cloud Functions deployment, not npm publishing.
