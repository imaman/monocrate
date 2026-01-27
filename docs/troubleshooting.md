# Troubleshooting Guide

Monocrate handles the complexity of publishing from monorepos, but sometimes things don't go as planned. This guide covers the most common issues and how to fix them.

**Navigation:**
- [Installation Issues](#installation-issues)
- [Configuration Issues](#configuration-issues)
- [Import and Dependency Issues](#import-and-dependency-issues)
- [File and Output Issues](#file-and-output-issues)
- [Workspace Issues](#workspace-issues)

---

## Installation Issues

### Error: "Command not found: monocrate"

**Why this happens:**
Monocrate isn't installed globally, or npm's global bin directory isn't in your PATH.

**Solution:**

Install Monocrate globally:
```bash
npm install -g monocrate
```

If you still get "command not found", check that npm's global bin directory is in your PATH:
```bash
npm config get prefix
# Expected output: /usr/local/bin (or similar)
```

If the output is a different directory, add it to your PATH in your shell config file (`~/.bashrc`, `~/.zshrc`, etc.):
```bash
export PATH="/path/from/npm/config:$PATH"
```

**Alternative:**
If you prefer not to install globally, run Monocrate via `npx`:
```bash
npx monocrate publish packages/my-app --bump patch
```

---

### Error: "Node.js version too old"

**Why this happens:**
Monocrate requires Node.js 20 or later. You're running an older version.

**Solution:**

Check your current version:
```bash
node --version
```

Upgrade Node.js. Use a version manager like `nvm` or `fnm`:
```bash
nvm install 20
nvm use 20
```

Or download from [nodejs.org](https://nodejs.org/).

---

## Configuration Issues

### Error: "Cannot find workspace root"

**Why this happens:**
Monocrate couldn't auto-detect your monorepo root. This usually means:
- Your project isn't a valid npm/yarn/pnpm workspace
- You're running Monocrate from the wrong directory
- The workspace configuration is missing or malformed

**Solution:**

First, verify your monorepo has a valid workspace configuration. Check your root `package.json`:

```bash
cat package.json | grep -A 5 "workspaces"
```

For npm/yarn workspaces, you should see:
```json
{
  "workspaces": ["packages/*", "libs/*"]
}
```

For pnpm, check `pnpm-workspace.yaml`:
```bash
cat pnpm-workspace.yaml
```

If the configuration exists and is correct, explicitly specify the monorepo root:
```bash
monocrate publish packages/my-app --root /path/to/monorepo/root
```

---

### Error: "Package not found in workspace"

**Why this happens:**
The package path you specified doesn't exist, or Monocrate can't find it in the workspace discovery.

**Solution:**

Verify the package exists:
```bash
ls -la packages/my-app/package.json
```

If the package exists but Monocrate doesn't find it, check that it's listed in your workspace configuration:
```bash
cat package.json | grep workspaces
# Should include a pattern that matches your package path
```

If your package is in a directory not covered by the workspace pattern, update your workspace configuration:

```json
{
  "workspaces": ["packages/*", "libs/*", "custom/path/*"]
}
```

Then run Monocrate again.

---

## Import and Dependency Issues

### Error: "Cannot find module '@myorg/utils' after publish"

**Why this happens:**
Your published package imports `@myorg/utils`, which is a workspace reference. After publishing to npm, `@myorg/utils` doesn't exist as a dependency.

This happens when you publish directly with `npm publish` instead of using Monocrate. Monocrate copies internal dependencies and rewrites imports to relative paths.

**Solution:**

Use Monocrate to publish instead of `npm publish`:

```bash
cd packages/app
monocrate publish . --bump patch
```

Monocrate will:
1. Copy `@myorg/utils` into the output as `deps/packages/utils/`
2. Rewrite imports from `@myorg/utils` to relative paths like `../deps/packages/utils/dist/index.js`

**Verify the fix:**

Inspect the output directory:
```bash
monocrate prepare packages/app --output-dir ./output-inspect
cat output-inspect/dist/index.js
```

You should see imports rewritten to relative paths:
```javascript
// Before (original source):
import { helper } from '@myorg/utils';

// After (in output):
import { helper } from '../deps/packages/utils/dist/index.js';
```

---

### Error: "Cannot find module '@myorg/utils/helpers'"

**Why this happens:**
You're using a subpath import (e.g., `@myorg/utils/helpers`) in your source. Monocrate didn't rewrite the subpath correctly.

**Solution:**

First, check that the subpath exists in the dependency's dist:
```bash
ls -la packages/utils/dist/helpers.js
```

If it doesn't exist, you need to export that subpath from the package's `package.json`:

```json
{
  "name": "@myorg/utils",
  "main": "dist/index.js",
  "exports": {
    ".": "./dist/index.js",
    "./helpers": "./dist/helpers.js"
  }
}
```

Then rebuild your packages and run Monocrate again:
```bash
npm run build
monocrate publish packages/app --bump patch
```

**Verify the fix:**

Check the rewritten import in the output:
```bash
monocrate prepare packages/app --output-dir ./output-inspect
grep "from.*helpers" output-inspect/dist/index.js
```

Should output something like:
```javascript
import { foo } from '../deps/packages/utils/dist/helpers.js';
```

---

### Error: "Circular dependency detected"

**Why this happens:**
Your packages have circular dependencies: A depends on B, and B depends on A (directly or indirectly). This breaks import rewriting and module resolution.

**Solution:**

Identify the circular dependency:
```bash
monocrate publish packages/app --bump patch 2>&1 | grep -i circular
```

Refactor to break the cycle. Common patterns:
- Move shared code to a third package that both depend on
- Use dependency injection instead of direct imports
- Split the larger package into smaller, focused packages

Example refactor:
```
Before (circular):
  app → utils
  utils → app

After (fixed):
  app → utils
  app → shared
  utils → shared
```

Update your imports to use the new shared package and rebuild:
```bash
npm run build
monocrate publish packages/app --bump patch
```

---

### Error: "Dynamic imports were not rewritten"

**Why this happens:**
You're using `import()` or `require()` calls with string literals. Monocrate uses AST analysis to find and rewrite static imports, but dynamic imports with expressions are harder to detect.

**Solution:**

Convert dynamic imports to static when possible:

```javascript
// Before (not rewritten):
const utils = await import('@myorg/utils');

// After (will be rewritten):
import * as utils from '@myorg/utils';
```

If you must use dynamic imports, manually rewrite them in your source before publishing:

```javascript
// Before:
const utils = await import('@myorg/utils');

// After:
const utils = await import('../deps/packages/utils/dist/index.js');
```

Or use a different approach:
```javascript
// Before:
const name = '@myorg/utils';
const utils = await import(name);

// After (static):
import * as utils from '@myorg/utils';
```

---

## File and Output Issues

### Error: "npm pack failed: Could not find module"

**Why this happens:**
One of your packages' `main` or `types` field points to a file that doesn't exist after build. For example, `main: "dist/index.js"` but `dist/index.js` wasn't generated.

**Solution:**

First, rebuild all packages:
```bash
npm run build
```

Verify that the entry point exists:
```bash
ls -la packages/my-app/dist/index.js
ls -la packages/my-app/dist/index.d.ts
```

If the files don't exist, check your build configuration. For TypeScript projects, verify:

```bash
cat packages/my-app/tsconfig.json | grep -E "(outDir|declaration)"
```

Expected output:
```json
{
  "compilerOptions": {
    "outDir": "./dist",
    "declaration": true
  }
}
```

Run the build script:
```bash
cd packages/my-app
npm run build
```

Then try Monocrate again:
```bash
monocrate publish packages/my-app --bump patch
```

---

### Error: "Wrong files included in output"

**Why this happens:**
Monocrate uses `npm pack` to determine which files to include. It copies only files that `npm pack` would include. If your `.npmignore` or `files` field in `package.json` excludes necessary files, they won't be copied.

**Solution:**

Check what `npm pack` would include:
```bash
cd packages/my-app
npm pack --dry-run
```

Look for your `dist/` directory and type definitions in the output. If they're missing, update your `package.json`:

Option 1: Use a `files` field to whitelist:
```json
{
  "files": ["dist/", "README.md"]
}
```

Option 2: Use `.npmignore` to blacklist:
```bash
# In packages/my-app/.npmignore
src/
*.test.ts
tsconfig.json
```

After updating, rebuild and try again:
```bash
npm run build
monocrate prepare packages/my-app --output-dir ./output-inspect
ls -la output-inspect/dist/
```

---

### Error: "dist/ directory not found in output"

**Why this happens:**
Your package doesn't have a `dist/` directory, or the build failed silently.

**Solution:**

Check if the build succeeded:
```bash
cd packages/my-app
ls -la dist/
```

If `dist/` doesn't exist, run the build:
```bash
npm run build
```

If the build succeeds but `dist/` is still missing, check your `package.json` entry point:

```bash
cat packages/my-app/package.json | grep -E "(main|types|exports)"
```

If the `main` field points to a different directory (e.g., `lib` instead of `dist`), either:
1. Update your build to output to `dist/`, or
2. Let Monocrate know about the custom directory

For option 2, you'd need to update your `package.json`:
```json
{
  "main": "lib/index.js",
  "types": "lib/index.d.ts"
}
```

Then ensure `npm pack` includes the `lib/` directory:
```bash
npm pack --dry-run | grep lib/
```

---

## Workspace Issues

### Error: "Workspace not detected"

**Why this happens:**
Monocrate can't find a workspace configuration (`package.json` with `workspaces` field or `pnpm-workspace.yaml`).

**Solution:**

Check your root `package.json`:
```bash
cat package.json
```

For npm or yarn workspaces, add the `workspaces` field:
```json
{
  "name": "my-monorepo",
  "private": true,
  "workspaces": ["packages/*", "libs/*"]
}
```

For pnpm, create `pnpm-workspace.yaml` in the root:
```yaml
packages:
  - 'packages/*'
  - 'libs/*'
```

Then try Monocrate again:
```bash
monocrate publish packages/my-app --bump patch
```

---

### Error: "Too many packages are being included"

**Why this happens:**
Monocrate includes all transitive dependencies of your target package. If your package has many dependencies, the output becomes large.

**Solution:**

First, check which packages are being included:
```bash
monocrate prepare packages/my-app --output-dir ./output-inspect
ls -la output-inspect/deps/
```

Verify that all included packages are actually dependencies:
```bash
cat packages/my-app/package.json | jq '.dependencies'
```

If you see unexpected packages, check their transitive dependencies:
```bash
# For each dependency listed
cat packages/other-package/package.json | jq '.dependencies'
```

If you have optional or dev dependencies that shouldn't be published, ensure they're in `devDependencies`:

```json
{
  "dependencies": {
    "@myorg/core": "*"
  },
  "devDependencies": {
    "jest": "^29.0.0"
  }
}
```

Rebuild and try again:
```bash
npm run build
monocrate publish packages/my-app --bump patch
```

---

### Error: "Package version conflicts in dependencies"

**Why this happens:**
Multiple packages in your monorepo depend on different versions of the same external package (e.g., lodash 4.17.0 vs 4.18.0). Monocrate merges these into a single set of dependencies, which can cause conflicts.

**Solution:**

Use the same version across all packages. Check which packages have the conflict:
```bash
npm ls lodash
```

Look for entries marked "deduped" or with different version numbers. Update your packages to use the same version:

Option 1: Update all `package.json` files to the same version:
```bash
cd packages/app
npm install lodash@^4.17.0
cd ../utils
npm install lodash@^4.17.0
```

Option 2: Use the highest compatible version that satisfies all ranges. Update each package's `package.json`:
```json
{
  "dependencies": {
    "lodash": "^4.18.0"
  }
}
```

Then install and rebuild:
```bash
npm install
npm run build
monocrate publish packages/my-app --bump patch
```

---

## TypeScript Issues

### Error: "Types not working in output"

**Why this happens:**
Your published package has no `.d.ts` files, or the type definitions reference paths that don't exist in the output.

**Solution:**

First, ensure type declarations are generated during build:

```bash
cat packages/my-app/tsconfig.json | grep -E "(declaration|emitDeclarationOnly)"
```

Expected output:
```json
{
  "compilerOptions": {
    "declaration": true
  }
}
```

If `declaration` is `false` or missing, update your `tsconfig.json`:
```json
{
  "compilerOptions": {
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true
  }
}
```

Rebuild and check the output:
```bash
npm run build
ls -la packages/my-app/dist/*.d.ts
```

If `.d.ts` files exist in your source but not in the output, verify they're included in `npm pack`:
```bash
npm pack --dry-run | grep "\.d\.ts"
```

If they're missing, update your `package.json`:
```json
{
  "files": ["dist/"]
}
```

Rebuild and try Monocrate again:
```bash
npm run build
monocrate publish packages/my-app --bump patch
```

---

### Error: "Cannot resolve types for imported packages"

**Why this happens:**
The output includes type definitions, but they import from other workspace packages without valid paths.

**Solution:**

Check a `.d.ts` file in the output:
```bash
monocrate prepare packages/my-app --output-dir ./output-inspect
cat output-inspect/dist/index.d.ts
```

Look for imports. If you see something like:
```typescript
import { Foo } from '@myorg/utils';
```

But in the output `@myorg/utils` doesn't exist as a package, the import rewriting didn't work.

Run Monocrate with verbose logging to see if there were errors:
```bash
monocrate prepare packages/my-app --output-dir ./output-inspect 2>&1
```

If the rewriting failed, ensure your package entry points are correct:
```bash
cat packages/utils/package.json | grep -E "(main|types|exports)"
```

Entry points should point to the built files:
```json
{
  "main": "dist/index.js",
  "types": "dist/index.d.ts"
}
```

Rebuild everything and try again:
```bash
npm run build
monocrate publish packages/my-app --bump patch
```

---

## Missing package.json Fields

### Error: "Exports field missing or incorrect"

**Why this happens:**
Your package's `exports` field (if present) doesn't match the actual file structure, causing imports to fail.

**Solution:**

Check your `exports` field:
```bash
cat packages/my-app/package.json | jq '.exports'
```

For a package with structure:
```
dist/
  index.js
  utils.js
```

A valid `exports` field would be:
```json
{
  "exports": {
    ".": "./dist/index.js",
    "./utils": "./dist/utils.js"
  }
}
```

If you don't use `exports`, use `main` and `types`:
```json
{
  "main": "dist/index.js",
  "types": "dist/index.d.ts"
}
```

Both approaches work with Monocrate. After updating, rebuild and test:
```bash
npm run build
monocrate publish packages/my-app --bump patch
```

---

## Publishing Issues

### Error: "Permission denied when publishing to npm"

**Why this happens:**
You don't have npm publish permission for this package name, or you're not logged in to npm.

**Solution:**

Check if you're logged in:
```bash
npm whoami
```

If you get "not logged in", authenticate:
```bash
npm login
```

If you're logged in but don't have permission, check the package:
```bash
npm owner ls @myorg/my-app
```

If you're not listed as an owner, ask someone with permissions to add you:
```bash
npm owner add your-username @myorg/my-app
```

Then try publishing again:
```bash
monocrate publish packages/my-app --bump patch
```

---

### Error: "Version already published"

**Why this happens:**
The version Monocrate computed is already published to npm.

**Solution:**

Check the latest published version:
```bash
npm view @myorg/my-app version
```

Monocrate defaults to `minor` version bumps. Explicitly specify the bump type:
```bash
monocrate publish packages/my-app --bump major
# or
monocrate publish packages/my-app --bump patch
```

Or specify an exact version:
```bash
monocrate publish packages/my-app --bump 2.0.0
```

---

### Error: "tarball produced by npm pack is too large"

**Why this happens:**
Your package includes too many files, resulting in a large npm tarball. This can happen if `npm pack` is including files you meant to exclude.

**Solution:**

Check what `npm pack` includes:
```bash
cd packages/my-app
npm pack --dry-run | wc -l
# Shows number of files
```

See what's in there:
```bash
npm pack --dry-run | head -20
```

Remove unnecessary files using `.npmignore`:
```bash
# In packages/my-app/.npmignore
node_modules/
src/
*.test.ts
coverage/
.git/
.turbo/
tsconfig.json
```

Or use a `files` whitelist:
```json
{
  "files": ["dist/", "README.md", "LICENSE"]
}
```

Check the size again:
```bash
npm pack --dry-run | wc -l
```

---

## Getting Help

If you encounter an issue not covered here:

1. Check the [main README](../README.md) for command reference
2. Review the [copy-based assembly spec](./copy-based-assembly-spec.md) for technical details
3. Run with verbose output to see more detail
4. Open an issue on [GitHub](https://github.com/imaman/monocrate) with:
   - Your monorepo structure (output of `find packages -name package.json | head -10`)
   - The exact error message
   - The command you ran
   - Output of `monocrate publish ... 2>&1`
