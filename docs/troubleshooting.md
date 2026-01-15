# Troubleshooting

This guide covers common errors and issues you may encounter when using Monocrate, along with their solutions.

## Table of Contents

- [Build Errors](#build-errors)
- [Dependency Errors](#dependency-errors)
- [File System Errors](#file-system-errors)
- [Configuration Issues](#configuration-issues)
- [FAQ](#faq)

---

## Build Errors

### "Some packages have not been built"

**Error Message:**
```
Some packages have not been built
The following packages are missing dist directories:
  - @myorg/utils
  - @myorg/core

To resolve: Run the build command for these packages first.
```

**Cause:** Monocrate bundles compiled code from `dist/` directories. If a package hasn't been built, there's nothing to bundle.

**Solutions:**

1. Build all packages in your monorepo:
   ```bash
   npm run build --workspaces
   # or
   pnpm -r build
   # or
   yarn workspaces run build
   ```

2. Build specific packages:
   ```bash
   npm run build --workspace=@myorg/utils --workspace=@myorg/core
   ```

3. If you use a different output directory (e.g., `lib/` or `build/`), configure it:
   ```typescript
   await bundle({
     // ...
     distDirName: 'lib', // or 'build'
   });
   ```

---

### "Package not found in monorepo"

**Error Message:**
```
Package '@myorg/missing' not found in monorepo
Referenced by: @myorg/app
Ensure the package exists and is included in workspace patterns.
```

**Cause:** A package declares a dependency on another package that Monocrate cannot find.

**Solutions:**

1. **Check the package name spelling** - Verify the dependency name in `package.json` matches the actual package name exactly.

2. **Verify workspace patterns** - Ensure the missing package's directory matches your workspace patterns.

   ```json
   // package.json
   {
     "workspaces": ["packages/*", "libs/*"]
   }
   ```

   If your package is in `tools/`, add it to the patterns:
   ```json
   {
     "workspaces": ["packages/*", "libs/*", "tools/*"]
   }
   ```

3. **Check for typos in the dependency** - Verify the dependency version format:
   ```json
   // Correct
   "@myorg/utils": "workspace:*"
   "@myorg/utils": "*"

   // These will also work, but are less common
   "@myorg/utils": "workspace:^1.0.0"
   ```

---

## Dependency Errors

### "Circular dependency detected"

**Error Message:**
```
Circular dependency detected
Dependency chain: pkg-a -> pkg-b -> pkg-c -> pkg-a

To resolve: Remove one direction of the dependency,
or extract shared code into a third package.
```

**Cause:** Your packages have a circular dependency where A depends on B, B depends on C, and C depends on A (or any similar cycle).

**Solutions:**

1. **Identify the cycle** - The error message shows the exact dependency chain.

2. **Remove one direction** - If A and B both need each other's code, decide which direction is primary:
   ```
   Before: A <-> B
   After:  A -> B  (and refactor A's code that B needs)
   ```

3. **Extract shared code** - Create a new package for the shared functionality:
   ```
   Before: A <-> B (both use shared functionality)
   After:  A -> shared <- B
   ```

4. **Use dependency injection** - Instead of direct imports, pass dependencies at runtime.

---

### "Version conflict for dependency"

**Error Message (with `error` strategy):**
```
Version conflict for dependency 'lodash'
Multiple packages require different versions:
  - @myorg/app: ^4.17.0
  - @myorg/utils: ^4.17.21

To resolve:
  1. Align all packages to use the same version
  2. Use 'warn' or 'highest' conflict strategy
```

**Cause:** Multiple packages in your bundle require different versions of the same third-party dependency.

**Solutions:**

1. **Align versions** (recommended) - Update all packages to use the same version:
   ```bash
   # Find all lodash versions
   grep -r '"lodash"' packages/*/package.json

   # Update to a consistent version
   npm pkg set dependencies.lodash="^4.17.21" --workspace=@myorg/app
   ```

2. **Use a different conflict strategy**:
   ```typescript
   await bundle({
     // ...
     versionConflictStrategy: 'highest', // or 'warn'
   });
   ```

3. **Accept the warning** - With `'warn'` strategy, Monocrate will use the highest version and continue.

---

## File System Errors

### "Output path must be absolute"

**Error Message:**
```
Output path must be absolute
Received relative path: ./publish
Use path.resolve() to convert to absolute path.
```

**Cause:** The `outputDir` option must be an absolute path.

**Solution:**
```typescript
import * as path from 'path';

await bundle({
  // ...
  outputDir: path.resolve('./publish'), // Convert to absolute
  // or
  outputDir: '/absolute/path/to/output',
});
```

---

### "Failed to create output directory"

**Error Message:**
```
Failed to create output directory
Error: EACCES: permission denied, mkdir '/root/publish'

Ensure you have write permissions to the parent directory.
```

**Cause:** Monocrate cannot create the output directory due to permissions.

**Solutions:**

1. **Use a different output directory**:
   ```bash
   monocrate bundle my-pkg --output ~/publish
   ```

2. **Fix permissions**:
   ```bash
   sudo chown -R $USER /path/to/parent
   ```

3. **Use a temp directory**:
   ```typescript
   import * as os from 'os';
   import * as path from 'path';

   await bundle({
     // ...
     outputDir: path.join(os.tmpdir(), 'my-bundle'),
   });
   ```

---

### "Path contains null bytes"

**Error Message:**
```
Path contains null bytes which may indicate an injection attempt
```

**Cause:** A file path contains null bytes (`\0`), which is a security concern and invalid for file paths.

**Solution:** This is typically caused by malformed input or a security attack attempt. Check your input sources and ensure paths are properly validated.

---

## Configuration Issues

### Workspace not detected

**Symptoms:**
- Only the root package is found
- In-repo dependencies are treated as third-party
- Missing package warnings

**Solutions:**

1. **Check workspace configuration**:
   ```json
   // package.json
   {
     "workspaces": ["packages/*"]
   }
   ```

   Or for pnpm:
   ```yaml
   # pnpm-workspace.yaml
   packages:
     - 'packages/*'
   ```

2. **Verify package locations match patterns**:
   ```
   monorepo/
     packages/       <- matches "packages/*"
       app/
       utils/
     tools/          <- NOT matched unless pattern includes it
       cli/
   ```

3. **Check for typos in patterns** - Patterns are case-sensitive and exact.

---

### Wrong package manager detected

**Symptoms:**
- Workspace patterns not being read correctly
- Unexpected behavior with workspace dependencies

**Solution:** Monocrate detects the package manager from lock files. Ensure you have the correct lock file:

| Package Manager | Lock File |
|-----------------|-----------|
| npm | `package-lock.json` |
| yarn | `yarn.lock` |
| pnpm | `pnpm-lock.yaml` |

If you have multiple lock files, remove the ones you don't use.

---

## FAQ

### Can I bundle multiple packages at once?

No, Monocrate bundles one package at a time. To bundle multiple packages, run the bundle command multiple times:

```typescript
for (const pkg of ['@myorg/app', '@myorg/cli']) {
  await bundle({
    packagePath: `/path/to/${pkg}`,
    monorepoRoot: '/path/to/monorepo',
    outputDir: `/output/${pkg.replace('/', '-')}`,
  });
}
```

---

### How do I exclude specific files from the bundle?

Currently, Monocrate copies all files from `dist/` except:
- `.map` files (when `includeSourceMaps: false`)
- `.d.ts` files (when `includeDeclarations: false`)

For custom exclusions, you can:
1. Configure your build tool to not emit those files
2. Clean up the dist directory before bundling

---

### Why are my devDependencies not included?

By design, `devDependencies` are not included in the bundle because they're not needed at runtime. If you need a dev dependency at runtime, move it to `dependencies`.

---

### Can I publish directly from the bundle?

Yes! The output directory is ready for `npm publish`:

```bash
monocrate bundle @myorg/app --output ./publish
cd publish
npm publish
```

---

### How do I handle peer dependencies?

Peer dependencies are preserved in the output package.json. They are not bundled because they're expected to be provided by the consuming package.

---

### The bundle is too large. How can I reduce its size?

1. **Exclude source maps**:
   ```typescript
   await bundle({ includeSourceMaps: false });
   ```

2. **Exclude declaration files**:
   ```typescript
   await bundle({ includeDeclarations: false });
   ```

3. **Review what's in your dist directories** - You may be including test files or other non-essential code.

4. **Check for duplicate code** - If multiple packages have similar code, consider extracting it to a shared package.

---

### How do I debug Monocrate issues?

1. **Check the result object**:
   ```typescript
   const result = await bundle(options);
   if (!result.success) {
     console.error('Error:', result.error);
     console.error('Details:', result.details);
   }
   ```

2. **Inspect the dependency graph**:
   ```typescript
   import { buildDependencyGraph } from 'monocrate';

   const graph = await buildDependencyGraph(packagePath, monorepoRoot);
   console.log('Packages:', [...graph.nodes.keys()]);
   console.log('Order:', graph.topologicalOrder);
   ```

3. **Validate dist directories manually**:
   ```typescript
   import { validateDistDirectories, buildDependencyGraph } from 'monocrate';

   const graph = await buildDependencyGraph(packagePath, monorepoRoot);
   const missing = validateDistDirectories(graph);
   console.log('Missing dist:', missing);
   ```

---

### Where can I get help?

- Check the [API Reference](./api.md) for detailed function documentation
- Read [How It Works](./how-it-works.md) to understand the bundling process
- Open an issue on GitHub with:
  - Your monorepo structure
  - The command or code you're running
  - The full error message
  - Your Node.js version
