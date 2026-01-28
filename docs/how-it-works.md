# How Monocrate Works

**Breadcrumb Navigation:** [Home](../README.md) > How It Works

Monocrate is not a bundler. It doesn't minify, tree-shake, or merge code into fewer files. Instead, it performs a series of precise file operations and AST transformations to solve one problem: taking a package from a monorepo and its internal dependencies, and packaging them so npm can publish and resolve them without understanding workspaces.

This guide explains exactly what happens under the hood when you run `monocrate prepare` or `monocrate publish`.

---

## Overview: Smart File Copy, Not a Bundler

At its core, Monocrate does this:

1. **Discovers** all packages in your monorepo
2. **Identifies** which internal packages your target depends on (directly and transitively)
3. **Copies** each package's publishable files (determined by `npm pack`)
4. **Rewrites imports** from workspace references (`@myorg/utils`) to relative paths (`../deps/packages/utils/dist/index.js`)
5. **Merges** the `package.json` to include only third-party dependencies

The result is a self-contained directory tree where all imports can be resolved without npm workspaces. Each internal package keeps its original file structure—nothing is flattened or combined. Module boundaries are preserved, so tree-shaking and code splitting still work downstream.

---

## Step 1: Discovery — Finding All Workspace Packages

When Monocrate starts, it needs to map your entire monorepo.

**What happens:**
- Monocrate scans the monorepo root (auto-detected from your target package or specified via `--root`)
- It reads the root `package.json` to find the workspace configuration (`workspaces` field for npm, `packages` for pnpm, etc.)
- Each workspace package is indexed by name and location

**Why this matters:**
- Monocrate must know which names are "internal" (workspace packages) vs. external (npm packages)
- Without this map, it can't distinguish `import { x } from '@myorg/utils'` (internal) from `import { x } from 'lodash'` (external)

**Example:**
```json
// monorepo root package.json
{
  "workspaces": ["packages/*"]
}
```

Monocrate discovers:
- `@myorg/cli` at `packages/cli/package.json`
- `@myorg/utils` at `packages/utils/package.json`
- `@myorg/core` at `packages/core/package.json`

---

## Step 2: Dependency Graph — Building the Closure

Once all packages are mapped, Monocrate builds a dependency graph to answer: "If I want to publish `@myorg/cli`, which packages must I include?"

**What happens:**
- Start with your target package (e.g., `@myorg/cli`)
- Walk its `dependencies` (not `devDependencies` for runtime), looking up each name in the workspace map
- For each internal dependency found, recursively walk that package's dependencies
- Stop when a dependency is external or already visited

This produces two sets:
- **Runtime members**: packages needed to run your target package
- **Compile-time members**: packages needed for development (includes `devDependencies`)

**Why this matters:**
- Only runtime members are copied to the output (compile-time-only packages like test utilities are excluded)
- Monocrate detects version conflicts—if two different packages require different versions of the same third-party dependency, it fails loudly

**Example dependency graph:**
```
@myorg/cli (target)
  ├─ @myorg/utils
  │   ├─ @myorg/core
  │   └─ lodash (external)
  └─ chalk (external)

Runtime members: [@myorg/cli, @myorg/utils, @myorg/core]
Third-party deps: { lodash: "^4.0.0", chalk: "^5.0.0" }
```

---

## Step 3: npm Pack — What Files Get Included?

Monocrate doesn't hardcode which files to copy. Instead, it defers to `npm pack` logic—the same logic npm uses when publishing.

**What happens:**
- For each package in the dependency graph, Monocrate runs `npm pack --dry-run` on the package directory
- This returns the exact file list that `npm publish` would upload
- The list respects:
  - The `files` field in `package.json` (if present, only these files are included)
  - The `.gitignore` and `.npmignore` files
  - Standard ignores (node_modules, .git, .npm, etc.)

**Why this matters:**
- You don't need to reconfigure what Monocrate copies—it already respects your existing `files` configuration
- If you've carefully tuned your package to exclude test files or temporary outputs, Monocrate honors that

**Example:**
```json
// packages/utils/package.json
{
  "name": "@myorg/utils",
  "files": ["dist", "types"]
}
```

`npm pack` returns:
- `dist/index.js`
- `dist/index.d.ts`
- `types/utils.d.ts`
- `package.json`

(test files, source TypeScript, and node_modules are excluded)

---

## Step 4: Import Rewriting — Change Package Names to Relative Paths

This is where the AST transformation happens. Monocrate must rewrite every import statement so the output directory is self-contained.

### The Problem

In your monorepo:
```typescript
// packages/cli/src/index.ts
import { helper } from '@myorg/utils'
```

After compilation and copying, this file becomes `output/dist/index.js`. But `@myorg/utils` no longer exists in the output—it's at `output/deps/packages/utils/`. npm doesn't understand `@myorg/utils` in the output; it's just a directory tree now.

### The Solution

Monocrate uses **ts-morph** (a TypeScript AST library) to parse every `.js` and `.d.ts` file, find every import statement, and rewrite it to a relative path.

**What happens:**

1. Parse the file as an Abstract Syntax Tree (AST)
2. Find all import declarations:
   - `import { foo } from '@myorg/utils'`
   - `import * as utils from '@myorg/utils'`
   - `export { bar } from '@myorg/utils'`
   - `const mod = await import('@myorg/utils')`
3. For each import specifier (`@myorg/utils`):
   - Extract the package name: `@myorg/utils`
   - Extract the subpath (if any): `utils/helper` (from `@myorg/utils/utils/helper`)
   - Look up the package in the dependency graph
   - Resolve the actual file path using the package's `exports` field (or `main` field as fallback)
   - Calculate the relative path from the current file to that target file
   - Rewrite the import statement

4. Save the modified file

**Before:**
```typescript
// output/dist/index.js
import { helper } from '@myorg/utils'
import { log } from '@myorg/utils/logging'
export { bar } from '@myorg/utils'
const mod = await import('@myorg/utils')
```

**After:**
```typescript
// output/dist/index.js
import { helper } from '../deps/packages/utils/dist/index.js'
import { log } from '../deps/packages/utils/dist/logging.js'
export { bar } from '../deps/packages/utils/dist/index.js'
const mod = await import('../deps/packages/utils/dist/index.js')
```

### Resolving Exports

When rewriting `@myorg/utils/logging`, Monocrate must find the actual file. It uses the `exports` field from `packages/utils/package.json`:

```json
{
  "name": "@myorg/utils",
  "exports": {
    ".": "./dist/index.js",
    "./logging": "./dist/logging.js"
  }
}
```

The `exports` field is Node.js's standard way to declare what subpaths are public. Monocrate uses the **resolve.exports** library to match the import specifier against this field:

- `import { x } from '@myorg/utils'` → resolves to `./dist/index.js` (the `.` export)
- `import { x } from '@myorg/utils/logging'` → resolves to `./dist/logging.js` (the `./logging` export)

If there's no `exports` field, Monocrate falls back to the `main` field:

```json
{
  "main": "dist/index.js"
}
```

### Code Example: The Rewriting Process

Here's a conceptual flow of how ts-morph handles this:

```typescript
// Simplified version of import-rewriter.ts logic

const project = new Project()
const sourceFile = project.addSourceFileAtPath('output/dist/index.js')

for (const decl of sourceFile.getImportDeclarations()) {
  const specifier = decl.getModuleSpecifierValue()
  // specifier = '@myorg/utils'

  const { packageName, subPath } = this.extractPackageName(specifier)
  // packageName = '@myorg/utils', subPath = ''

  const importeeLocation = this.packageMap.get(packageName)
  // Found: { toDir: 'output/deps/packages/utils', packageJson: {...} }

  const pathAtImportee = resolveImport(importeeLocation.packageJson, subPath)
  // Resolved to: 'dist/index.js' (from exports field)

  const absolutePath = join('output/deps/packages/utils', 'dist/index.js')
  // Absolute: '/full/path/to/output/deps/packages/utils/dist/index.js'

  const relativePath = computeRelativePath(
    'output/dist/index.js',
    absolutePath
  )
  // Relative: '../deps/packages/utils/dist/index.js'

  decl.setModuleSpecifier(relativePath)
  // Import rewritten!
}

await sourceFile.save()
```

### Why Relative Paths?

The output is a single npm package. There's no npm registry to resolve `@myorg/utils`. Relative paths work everywhere—local installs, monorepo installs, after `npm pack`, anywhere.

---

## Step 5: Package.json Merging — Combine Dependencies

Finally, Monocrate creates a new `package.json` for the output directory.

**What happens:**
1. Take the subject package's `package.json` (e.g., `@myorg/cli`)
2. Remove all `dependencies` and `devDependencies`
3. Add only the third-party dependencies discovered in the closure (all internal deps are now included as files)
4. Update the version (if `--bump` is specified)
5. Write the new `package.json` to the output root

**Example:**

Original `packages/cli/package.json`:
```json
{
  "name": "@myorg/cli",
  "version": "1.0.0",
  "dependencies": {
    "@myorg/utils": "workspace:*",
    "chalk": "^5.0.0"
  },
  "devDependencies": {
    "jest": "^29.0.0"
  }
}
```

Monocrate discovers:
- Runtime members: `[@myorg/cli, @myorg/utils, @myorg/core]`
- Third-party runtime deps: `{ chalk: "^5.0.0" }`

Output `package.json`:
```json
{
  "name": "@myorg/cli",
  "version": "1.0.1",
  "dependencies": {
    "chalk": "^5.0.0"
  }
}
```

**Why this matters:**
- The output is a valid npm package with declared dependencies
- Installation can proceed normally—npm doesn't need to understand workspaces
- If a user installs the output, they get exactly the same runtime environment as your monorepo

---

## Edge Cases Handled

### Circular Dependencies

If `@myorg/a` depends on `@myorg/b` and `@myorg/b` depends on `@myorg/a`:

- Monocrate's graph traversal keeps track of visited packages
- Both packages are included in the output
- Imports are rewritten correctly (relative paths work in cycles)
- Result: the circular dependency is preserved in the output

### Version Conflicts

If `@myorg/a` requires `lodash@^4.0.0` and `@myorg/b` requires `lodash@^3.0.0`:

- Monocrate detects this during the closure build
- It reports an error with details: `lodash: 4.0.0 (by @myorg/a), 3.0.0 (by @myorg/b)`
- You must resolve the conflict in your monorepo before publishing

Monocrate doesn't try to resolve version conflicts—it makes them visible because hidden conflicts break at runtime.

### exports Field Complexity

The `exports` field can be complex:

```json
{
  "exports": {
    ".": { "import": "./dist/index.mjs", "require": "./dist/index.cjs" },
    "./logging": "./dist/logging.js"
  }
}
```

Monocrate uses resolve.exports, which understands this complexity and picks the appropriate file (it defaults to the first "processable" entry, matching Node.js behavior).

### Subpath Imports Beyond Exports

If an import doesn't match the `exports` field, Monocrate falls back to simple file resolution:

```typescript
// If there's no exports entry for './logging'
import { log } from '@myorg/utils/logging'
```

Monocrate assumes the file is at `utils/logging.js` (the subpath + `.js` extension).

---

## What Monocrate Doesn't Do

### No Bundling
Files aren't merged. Module structure is preserved. Each file stays separate. This means:
- You can use conditional imports (e.g., different entry points for Node vs. Browser)
- Tree-shaking works downstream
- Source maps remain accurate

### No Minification
Code isn't minified or obfuscated. File sizes are unchanged (except for path length differences in imports).

### No Tree-Shaking
Monocrate copies all files matched by `npm pack`. It doesn't analyze which exports are used. If you want to exclude unused code, configure the `files` field in your `package.json`.

### No Type Stripping
`.d.ts` files are preserved. TypeScript declarations remain intact and are rewritten alongside `.js` files.

### No Flattening
If your package has nested directories, they stay nested:

```
Before:
packages/utils/dist/
  ├─ index.js
  └─ logging/
      └─ index.js

After (in output):
deps/packages/utils/dist/
  ├─ index.js
  └─ logging/
      └─ index.js
```

### No monorepo Metadata
The output's `package.json` doesn't include workspace references. It's a normal npm package.

---

## Implementation Details

### Tools Used

**ts-morph:**
- Parses TypeScript and JavaScript as Abstract Syntax Trees
- Finds and rewrites import/export declarations
- Handles dynamic `import()` calls
- Preserves formatting (mostly)

**resolve.exports:**
- Matches import specifiers against the `exports` field
- Implements Node.js resolution semantics
- Handles conditional exports and fallback arrays

**glob:**
- Determines which files to copy based on `npm pack` output
- Respects `.npmignore` and `files` configuration

**esbuild:**
- (Not directly involved in the core workflow, but available for downstream users)

### Architecture: Five Classes

**RepoExplorer:**
- Maps all packages in the monorepo
- Locates packages by name

**ComputePackageClosure:**
- Builds the dependency graph
- Detects version conflicts
- Returns runtime and compile-time members

**CollectPackageLocations:**
- Calls `npm pack --dry-run` for each package
- Prepares copy instructions (source file → destination path)

**FileCopier:**
- Executes the copy operations
- Creates directories and copies files in two phases

**ImportRewriter:**
- Parses `.js` and `.d.ts` files with ts-morph
- Rewrites import/export/dynamic-import statements
- Saves modified files

**RewritePackageJson:**
- Removes workspace dependencies
- Includes third-party dependencies
- Updates version

These five steps run in sequence inside `PackageAssembler.assemble()`.

---

## Complete Flow Example

Here's a complete example showing the transformation from monorepo to output.

### Starting State

**Monorepo structure:**
```
monorepo/
  package.json (root)
  packages/
    app/
      package.json
      dist/
        index.js
    utils/
      package.json
      dist/
        index.js
    core/
      package.json
      dist/
        index.js
```

**packages/app/package.json:**
```json
{
  "name": "@myorg/app",
  "version": "1.0.0",
  "dependencies": {
    "@myorg/utils": "workspace:*",
    "chalk": "^5.0.0"
  }
}
```

**packages/app/dist/index.js:**
```javascript
import { helper } from '@myorg/utils'
import chalk from 'chalk'
console.log(chalk.blue(helper()))
```

**packages/utils/package.json:**
```json
{
  "name": "@myorg/utils",
  "main": "dist/index.js",
  "dependencies": {
    "@myorg/core": "workspace:*"
  }
}
```

**packages/utils/dist/index.js:**
```javascript
import { log } from '@myorg/core'
export function helper() {
  log('helping')
  return 'helped'
}
```

**packages/core/package.json:**
```json
{
  "name": "@myorg/core",
  "main": "dist/index.js"
}
```

**packages/core/dist/index.js:**
```javascript
export function log(msg) {
  console.log(msg)
}
```

### Running `monocrate prepare packages/app`

**Step 1: Discovery**
- Scans monorepo root
- Indexes: `@myorg/app`, `@myorg/utils`, `@myorg/core`

**Step 2: Build Closure**
- Start with `@myorg/app`
- Dependencies: `@myorg/utils` (internal), `chalk` (external)
- Recurse on `@myorg/utils`
  - Dependencies: `@myorg/core` (internal)
- Recurse on `@myorg/core`
  - No dependencies
- Result:
  - Runtime members: [`@myorg/app`, `@myorg/utils`, `@myorg/core`]
  - Third-party: `{ chalk: "^5.0.0" }`

**Step 3: npm Pack**
- Run `npm pack --dry-run` on each package
- Results (simplified):
  - `@myorg/app`: [`package.json`, `dist/index.js`]
  - `@myorg/utils`: [`package.json`, `dist/index.js`]
  - `@myorg/core`: [`package.json`, `dist/index.js`]

**Step 4: Copy Files**
```
output/
  package.json
  dist/
    index.js         (from @myorg/app, to be rewritten)
  deps/
    packages/
      utils/
        package.json
        dist/
          index.js   (to be rewritten)
      core/
        package.json
        dist/
          index.js
```

**Step 5: Rewrite Imports**

`output/dist/index.js` before:
```javascript
import { helper } from '@myorg/utils'
import chalk from 'chalk'
console.log(chalk.blue(helper()))
```

`output/dist/index.js` after:
```javascript
import { helper } from '../deps/packages/utils/dist/index.js'
import chalk from 'chalk'
console.log(chalk.blue(helper()))
```

(chalk is not rewritten—it's external)

`output/deps/packages/utils/dist/index.js` before:
```javascript
import { log } from '@myorg/core'
export function helper() {
  log('helping')
  return 'helped'
}
```

`output/deps/packages/utils/dist/index.js` after:
```javascript
import { log } from '../core/dist/index.js'
export function helper() {
  log('helping')
  return 'helped'
}
```

**Step 6: Rewrite package.json**

`output/package.json`:
```json
{
  "name": "@myorg/app",
  "version": "1.0.0",
  "dependencies": {
    "chalk": "^5.0.0"
  }
}
```

### Result

The output directory is now a complete, self-contained npm package:
- All internal imports are relative paths
- All external imports point to npm packages
- `package.json` has only external dependencies
- No references to workspaces

You can run `npm publish` on this directory, or inspect it first with `npm pack`.

---

## Related Documentation

- [CLI Reference](./cli-reference.md) — Command-line options and examples
- [Programmatic API](./api.md) — Using Monocrate from JavaScript
- [Troubleshooting](./troubleshooting.md) — Common issues and solutions

---

**Last updated:** January 2026 | [Edit on GitHub](https://github.com/imaman/monocrate/edit/main/docs/how-it-works.md)
