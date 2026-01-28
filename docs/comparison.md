# Monocrate vs Alternatives: A Comparison Guide

**Choosing the right tool for publishing from a monorepo.**

Monocrate solves one specific problem: publishing a package from a monorepo when it depends on other internal packages. But it's not always the right choice. This guide compares Monocrate to alternatives and helps you decide which tool—or combination of tools—fits your workflow.

---

## Overview: Different Tools for Different Problems

Before comparing tools, understand what each one does:

- **Bundlers** (webpack, esbuild, Rollup) — optimize code for browsers by flattening modules
- **Monorepo orchestrators** (Lerna, Nx, Turborepo) — manage builds and publishing across multiple packages
- **Manual workflows** — copy files and rewrite imports yourself
- **Monocrate** — assembles your package with internal dependencies included, preserving module structure

Each solves a different problem. The question isn't "which is best?" but "which is right for what I'm trying to do?"

---

## Monocrate vs Bundlers

**Bundlers flatten your code into optimized output. Monocrate preserves your module structure.**

### Comparison Table

| Feature | Bundler (webpack/esbuild/Rollup) | Monocrate |
|---------|----------------------------------|-----------|
| **Output format** | Single file (bundle.js, ~500KB) | Original structure (50 separate files) |
| **What gets optimized** | Everything: minify, tree-shake, compress | Nothing: copy + rewrite imports only |
| **Tree-shaking ability** | Bundler does all tree-shaking | Consumer's bundler handles unused code |
| **Type declarations** | Requires plugin configuration | Automatic: .d.ts files preserved |
| **Debugging** | Stack traces in bundle.js:1523 (hard to locate) | Stack traces in utils.js:42 (exact file/line) |
| **Build time** | Slower (optimization takes time) | Faster (5 seconds vs 20+ seconds) |
| **File size (browser)** | Small (minified, gzip: ~50KB) | Large (raw, ~500KB) |
| **Module boundaries** | Erased (one namespace) | Preserved (import paths stay valid) |
| **Subpath imports** | Bundle flattening breaks them | Work unchanged |
| **Debugging TypeScript** | Source maps help but remapped | Direct file + line number |

### When to Use a Bundler

Choose bundler output when:
- Building for browsers (need small file size and optimization)
- Single-file distribution is required (e.g., `<script>` tag embed)
- You want to minify and optimize code for users

**Example:** You're shipping a browser SDK. Users load it with `<script src="sdk.js">`. You bundle everything into one 50KB file, minified. Bundler is correct here.

### When to Use Monocrate Instead

Choose Monocrate when:
- Publishing Node.js libraries (bundling adds no value)
- You want consumers' bundlers to do tree-shaking (they control what they load)
- Type declarations must work out-of-the-box
- Debugging must show actual file names (not bundle.js line numbers)
- You publish to npm and let consumers choose how to use you

**Example:** You're publishing a Node.js utility library with 20 modules. Consumers might use only 2-3 modules. With Monocrate, they import specific functions, and their bundler tree-shakes the rest. With a bundler, you've pre-flattened everything—consumers get all 20 modules even if they use one.

### Real Scenario: Publishing a Data Validation Library

**With bundler:**
```
Published: validation-lib.js (single file, 200KB)
Consumer imports: import { validate } from 'validation-lib'
Consumer gets: All validators, utilities, and type stubs (even unused ones)
```

**With Monocrate:**
```
Published: 15 separate files in organized directories
Consumer imports: import { validate } from 'validation-lib/validators/email'
Consumer gets: Only what they import (bundler tree-shakes the rest)
```

The Monocrate version is larger before bundling but smaller after the consumer's bundler processes it.

---

## Monocrate vs Publishing All Packages Separately

**Lerna and similar tools require publishing every internal dependency. Monocrate publishes one package with dependencies included.**

### Comparison

| Aspect | Publish Everything | Monocrate |
|--------|-------------------|-----------|
| **Packages published** | 10 internal packages + 1 target (11 total) | 1 package with internals included |
| **Version management** | 11 separate versions to track | 1 version to manage |
| **Breaking changes** | Need major bump across multiple packages | One version change |
| **npm namespace pollution** | 11 packages listed on npm | 1 package listed |
| **Installation size** | Smaller (consumers pick what to install) | Included in one download |
| **Dependency consistency** | Versions can diverge | Always in sync (code at publish time) |
| **Setup complexity** | Higher (release scripts, CI/CD for each) | Lower (one script) |
| **CI/CD time** | Longer (publish loop, dependency graph) | Fast (one publish) |

### When to Publish Everything Separately

Use this approach when:
- Multiple teams own different packages
- Packages are published and versioned independently
- Consumer choice matters (they pick versions of each)
- Packages are reusable by other projects

This is Lerna's traditional use case. It works well when packages are genuinely independent.

### When to Use Monocrate Instead

Use Monocrate when:
- One main package depends on private utility packages
- Internal dependencies are an implementation detail
- You want to publish once, not orchestrate multiple releases
- Consumers care about the top-level package, not the internals

**Example:** Your main product is `@acme/sdk`. It uses internal packages `@acme/utils` (not meant for external use) and `@acme/parsers` (also internal). With Monocrate, publish `@acme/sdk` once. It includes utils and parsers internally. Consumers never see or manage three separate packages.

---

## Monocrate vs Manual Workflow

**Manual: copy files, edit imports. Monocrate: one command.**

### Typical Manual Workflow (for 20 modules)

1. Create output directory
2. Copy internal package A's compiled files
3. Copy internal package B's compiled files
4. Copy package C (depends on A and B) compiled files
5. Rewrite imports in package C (find "import from @myorg/utils" → replace with "import from ../utils")
6. Rewrite imports in package B (12 files to edit)
7. Rewrite imports in package A (8 files to edit)
8. Merge package.json from all three (combine dependencies, remove devDeps)
9. Remove workspace references from package.json
10. Double-check all imports look right
11. Test package locally
12. Publish to npm

Time: 15-20 minutes for a developer
Error rate: High (missed imports, typos, inconsistency)

### Monocrate Workflow

```bash
monocrate publish packages/sdk --bump patch
```

Time: 5 seconds
Error rate: Zero (no manual steps)

### Breakdown: Where Time Goes

**Manual approach:**
- Copying files: 3 minutes
- Finding all import statements: 4 minutes
- Rewriting imports: 8 minutes
- Editing package.json: 2 minutes
- Testing: 3-5 minutes

**Monocrate approach:**
- Running command: 5 seconds
- Reading output: 0 seconds (you trust it)

**Savings:** 15-20 minutes per publish × 4 publishes per month = 60-80 minutes saved per month.

### Real Cost of Manual Errors

A missed import rewrite causes runtime errors for consumers. Debug time: 1+ hours. Monocrate eliminates this class of bug entirely.

---

## Monocrate + Monorepo Tools: Complementary, Not Competitive

**Nx decides WHEN to publish. Monocrate makes it publishable.**

Monocrate isn't a replacement for Lerna, Nx, or Turborepo. It's a companion tool that solves a different problem.

### How They Work Together

**Nx/Turborepo/Lerna:**
- Build the packages
- Determine which changed
- Decide when/what to publish
- Orchestrate the release process

**Monocrate:**
- Takes a package and its dependencies
- Assembles them into a publishable tarball
- Rewrites imports
- Publishes to npm

### Example Workflow with Nx

1. **Nx detects changes** in `packages/sdk` and `packages/utils`
2. **Nx runs build** for both packages
3. **CI decides** which package(s) to publish (e.g., only `packages/sdk`)
4. **Monocrate executes** `publish packages/sdk --bump patch`
5. **npm gets** a self-contained package with utils included

The tools don't compete—they specialize:
- Nx = what to build and when
- Monocrate = how to package and publish

---

## Decision Tree: Which Tool Should You Use?

```
START
|
+-- Are you publishing for browsers (need optimization)?
|   YES → Use a bundler (webpack, esbuild, Rollup)
|   NO  → Continue
|
+-- Do all internal packages need independent versions?
|   YES → Publish each separately (use Lerna/Nx)
|   NO  → Continue
|
+-- Is your main package's only dependency private internal packages?
|   YES → Use Monocrate
|   NO  → Continue
|
+-- Are dependencies reusable by other projects outside monorepo?
|   YES → Publish packages separately
|   NO  → Use Monocrate
|
+-- Does your CI/CD already orchestrate publishing?
|   YES → Integrate Monocrate as the publish step
|   NO  → Monocrate is easier (one command)
|
END: Use Monocrate
```

### Decision Examples

**Scenario 1: Publishing a React component library**
- "Are browsers involved?" → Yes
- "Do consumers import specific components?" → Yes
- Decision: Use Monocrate (tree-shaking matters for browser bundle size)

**Scenario 2: Publishing a monorepo of utility packages**
- "Do all packages need independent versions?" → Yes
- "Will external teams use them separately?" → Yes
- Decision: Use Lerna/Nx (publish each package independently)

**Scenario 3: Publishing a CLI tool with internal helper packages**
- "Are internal packages reusable elsewhere?" → No
- "Is the CLI the main product?" → Yes
- Decision: Use Monocrate (publish one package with internals included)

**Scenario 4: Publishing a Node.js SDK for an API**
- "Are internal packages an implementation detail?" → Yes
- "Will users ever import internal packages?" → No
- Decision: Use Monocrate (simple, fast, one version to manage)

---

## When NOT to Use Monocrate

Monocrate isn't universal. Avoid it when:

### 1. **Internal Dependencies Are Public**

If consumers should be able to import from internal packages:
```javascript
// Bad with Monocrate: this becomes an undocumented detail
import { format } from '@myorg/sdk/deps/packages/utils/dist/format.js'

// Good: use separate published packages
import { format } from '@myorg/utils'
```

**Fix:** Publish internal packages separately and use a monorepo orchestrator.

### 2. **You Need Code Optimization**

If you need minification, code-splitting, or size optimization:
```
Monocrate output: 500KB (raw)
After consumer's webpack: 45KB (minified + gzip)

vs.

Bundler output: 50KB (pre-optimized)
```

For performance-critical libraries, pre-optimization might be worth it. Monocrate leaves optimization to the consumer.

**Fix:** Use a bundler if size is critical and you don't trust consumers to optimize.

### 3. **Packages Evolve Independently**

If teams maintain packages with different release cadences:
```
Core library:     1.0.0 (stable, rarely changes)
Internal utils:   2.5.0 (experimental, breaks often)
CLI tool:         1.3.0 (steady releases)
```

With Monocrate, you're locked to one version. With separate publishing, each evolves independently.

**Fix:** Use Lerna or Nx to manage independent versioning.

### 4. **You Need Subpath Imports**

If consumers need fine-grained control:
```javascript
// This breaks in bundled code (paths are flattened)
import { format } from '@myorg/utils/esm/format.js'
import { validate } from '@myorg/validators/types/email.js'

// Monocrate preserves these paths, bundlers erase them
```

Monocrate keeps them intact. Bundlers flatten them.

**Fix:** If subpath imports are critical, use Monocrate (not a bundler).

### 5. **You're Publishing for Multiple Runtimes**

If you need browser, Node.js, and Deno versions with different optimizations:
```
dist/browser.js   ← bundled, minified for <script> tag
dist/node.js      ← require() compatible
dist/esm.js       ← ES modules
```

Monocrate preserves structure but doesn't create multiple builds. You'd need a bundler to generate variants.

**Fix:** Use a bundler that supports multiple outputs.

---

## Comparison Summary Table

Quick reference for all tools:

| Criterion | Bundler | Monocrate | Lerna | Manual |
|-----------|---------|-----------|-------|--------|
| **Speed** | Slow (optimization takes time) | Fast (copy + rewrite) | Medium | Very slow |
| **Correctness** | Reliable | Reliable | Reliable | Error-prone |
| **File size** | Small (optimized) | Large (raw) | Small (separate downloads) | Varies |
| **Types work out-of-box** | No (requires plugins) | Yes | Yes | Manual |
| **Module structure preserved** | No (flattened) | Yes | Yes | Yes |
| **Debugging** | Hard (bundle.js:1) | Easy (actual file:line) | Easy | Easy |
| **Setup complexity** | High (webpack.config.js) | Low (one command) | Medium | None (but manual) |
| **Right for Node.js libraries** | No | Yes | Maybe | No |
| **Right for browser libraries** | Yes | Maybe | No | No |
| **Right for monorepo orchestration** | No | No | Yes | No |

---

## Recommendations by Use Case

### Use Case: Publishing a React UI Library

**Context:** Monorepo with `@myorg/core` (hooks), `@myorg/components` (button, card, etc.), published as `@myorg/ui`

**Recommendation:** Monocrate

**Why:** Consumers bundle their own way. They'll tree-shake unused components. Preserving module structure lets them `import { Button } from '@myorg/ui/button'` in TypeScript with full type support.

**Alternative:** Consider a bundler if you want to pre-optimize for browser size, but consumers' bundlers usually handle this better.

### Use Case: Publishing a CLI Tool

**Context:** Tool in monorepo, depends on internal `utils`, `parsers`, `logger` packages

**Recommendation:** Monocrate

**Why:** Node.js environments don't need optimization. Internal packages are implementation details. One package, one version, simple.

### Use Case: Publishing a Backend SDK

**Context:** Multiple internal packages for different API endpoints, authentication, utilities

**Recommendation:** Monocrate with consider Lerna if:
- Different teams own different endpoints
- Versioning should be independent
- Consumers might want different versions

**Default:** Monocrate (simpler, one command)

### Use Case: Publishing a Utility Library Suite

**Context:** `@myorg/validators`, `@myorg/formatters`, `@myorg/parsers` are all independent

**Recommendation:** Lerna

**Why:** Each package has independent users. Separate versions and release cycles make sense.

### Use Case: Publishing a Browser JavaScript Library

**Context:** Works in browsers and Node.js, needs small download size

**Recommendation:** Bundler

**Why:** Browser users care about size. Pre-optimization (minify, tree-shake) is worth it. Node.js users benefit too (smaller node_modules).

---

## Combining Tools: Real-World Workflow

**The best approach often uses multiple tools together.**

### Example: Complex Monorepo

```
my-monorepo/
  packages/
    cli/            ← Published product
    sdk/            ← Published separately
    utils/          ← Internal, used by cli and sdk
    parsers/        ← Internal, used by sdk
```

**Strategy:**

1. **Build with Nx or Turborepo** — Orchestrate builds, detect changes
2. **Publish CLI with Monocrate** — `monocrate publish packages/cli --bump patch`
3. **Publish SDK with Lerna** — It has multiple sub-packages customers use independently
4. **For browser SDK variant** — Use a bundler to create an optimized single-file version

**CI/CD workflow:**
```yaml
on: [tag]
jobs:
  publish:
    - Run nx build
    - If cli changed: monocrate publish packages/cli --bump $TAG
    - If sdk changed: lerna publish from-git
```

Each tool does what it's best at.

---

## Migration Path: Moving from Manual to Monocrate

If you're currently doing manual assembly:

### Step 1: Test Monocrate
```bash
monocrate prepare packages/cli --output-dir ./test-output
# Compare test-output to what you manually build
```

### Step 2: Verify Imports
```bash
# Check that rewritten imports look correct
grep -r "from '\.\.\/" ./test-output
```

### Step 3: Test Installation
```bash
# Install from prepared output and run tests
npm install ./test-output
npm test
```

### Step 4: Switch Commands
Replace your manual build script with:
```bash
monocrate publish packages/cli --bump patch
```

**Time saved:** 15-20 minutes per release × monthly publishes = hours per year.

---

## Summary: Choosing Your Tool

| If you want to | Use | Why |
|---|---|---|
| Publish a Node.js library from monorepo | Monocrate | Simple, fast, preserves types |
| Optimize for browser (size matters) | Bundler | Pre-optimization, smaller download |
| Independently version internal packages | Lerna/Nx | Each package evolves separately |
| Automate what-to-publish decisions | Nx/Turborepo | Detects changes, orchestrates releases |
| Everything manually (not recommended) | Manual | No setup, but error-prone and slow |
| Combine benefits of orchestration + publishing | Nx/Turborepo + Monocrate | Best of both worlds |

---

## Next Steps

- **Ready to use Monocrate?** See the [Quickstart](./quickstart.md)
- **Need to orchestrate builds?** Check out [Nx](https://nx.dev) or [Turborepo](https://turbo.build)
- **Multiple independently-versioned packages?** Explore [Lerna](https://lerna.js.org)
- **Need bundle optimization?** Review [esbuild](https://esbuild.github.io) or [Rollup](https://rollupjs.org)

---

## License

MIT
