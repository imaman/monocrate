# Monocrate

> From monorepo to npm in one command

Monocrate bundles monorepo packages for npm publishing by automatically resolving in-repo dependencies, copying compiled code, and generating a unified package.json with all third-party dependencies merged.

## The Problem

Publishing a package from a monorepo to npm is surprisingly painful. Your package might depend on other internal packages (like `@myorg/utils` or `@myorg/core`), but npm doesn't understand workspace dependencies. You end up with one of these bad options:

1. **Publish everything** - Every internal dependency must be published separately, even if they're implementation details
2. **Manual bundling** - Copy files, manually merge package.json dependencies, hope you didn't miss anything
3. **Complex build pipelines** - Esbuild/Rollup/Webpack configurations that bundle everything into a single file, losing the module structure

## The Solution

Monocrate takes a different approach: it bundles your package and all its in-repo dependencies into a single publishable directory, preserving the original module structure. Third-party dependencies are collected from all packages and merged into a single package.json.

```
monorepo/
  packages/
    app/          <-- You want to publish this
    utils/        <-- app depends on this
    core/         <-- utils depends on this

$ monocrate bundle @myorg/app --output ./publish

publish/
  index.js        <-- app's compiled code
  _deps/
    _myorg_utils/ <-- utils' compiled code
    _myorg_core/  <-- core's compiled code
  package.json    <-- Merged dependencies from all packages
```

## Installation

```bash
npm install -g monocrate
```

Or use without installing:

```bash
npx monocrate bundle my-package --output ./publish
```

## Quick Start

**1. Build your packages**

```bash
# Ensure all packages have been compiled to their dist/ directories
npm run build --workspaces
```

**2. Bundle for publishing**

```bash
monocrate bundle @myorg/app --output ./publish
```

**3. Publish to npm**

```bash
cd publish && npm publish
```

## Programmatic API

Monocrate can be used as a library in your build scripts:

```typescript
import { bundle } from 'monocrate';

const result = await bundle({
  packagePath: '/path/to/monorepo/packages/my-app',
  monorepoRoot: '/path/to/monorepo',
  outputDir: '/tmp/my-app-bundle',
});

if (result.success) {
  console.log('Bundle created at:', result.outputPath);
  console.log('Included packages:', result.includedPackages);
  console.log('Dependencies:', result.mergedDependencies);
} else {
  console.error('Bundle failed:', result.error);
  console.error('Details:', result.details);
}
```

### Convenience Function

For simpler use cases when running from the monorepo root:

```typescript
import { bundlePackage } from 'monocrate';

// Automatically discovers packages from workspace configuration
const result = await bundlePackage('@myorg/app', '/tmp/bundle');
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `packagePath` | `string` | required | Absolute path to the package to bundle |
| `monorepoRoot` | `string` | required | Absolute path to the monorepo root |
| `outputDir` | `string` | required | Absolute path to the output directory |
| `includeSourceMaps` | `boolean` | `true` | Include `.map` files in the bundle |
| `includeDeclarations` | `boolean` | `true` | Include `.d.ts` files in the bundle |
| `versionConflictStrategy` | `'highest' \| 'error' \| 'warn'` | `'warn'` | How to handle version conflicts |
| `cleanOutputDir` | `boolean` | `true` | Remove existing output directory before bundling |
| `distDirName` | `string` | `'dist'` | Name of the compiled output directory |

### Version Conflict Strategies

When multiple packages depend on the same third-party package with different versions:

- **`'highest'`** - Silently use the highest semver-compatible version
- **`'warn'`** - Use highest version, but log a warning
- **`'error'`** - Fail the bundle operation

```typescript
const result = await bundle({
  // ...
  versionConflictStrategy: 'error', // Strict mode
});
```

## How It Works

1. **Discover packages** - Reads workspace configuration (npm, yarn, or pnpm) to find all packages in the monorepo

2. **Build dependency graph** - Starting from your target package, recursively finds all in-repo dependencies and builds a topologically-sorted graph

3. **Validate builds** - Ensures all packages have been compiled (have a `dist/` directory)

4. **Assemble bundle** - Copies compiled code:
   - Root package's `dist/` goes to output root
   - Dependencies' `dist/` go to `_deps/<package-name>/`

5. **Transform package.json** - Generates a publish-ready package.json:
   - Removes workspace-specific fields (`workspaces`, `private`, `devDependencies`)
   - Removes in-repo dependencies
   - Merges third-party dependencies from all included packages

## Bundle Result

The `bundle()` function returns a discriminated union:

```typescript
// Success
{
  success: true,
  outputPath: string,           // Path to the bundle
  packageJson: PackageJson,     // Generated package.json
  mergedDependencies: object,   // All third-party deps
  includedPackages: string[],   // List of bundled packages
  versionConflicts: VersionConflict[], // Any conflicts found
}

// Failure
{
  success: false,
  error: string,        // Error message
  details?: string,     // Additional context
  cause?: Error,        // Underlying error
}
```

## Requirements

- **Node.js 20+**
- **Built packages** - All packages must have a `dist/` directory with compiled code
- **Workspace configuration** - npm workspaces, yarn workspaces, or pnpm-workspace.yaml

## Supported Package Managers

Monocrate automatically detects your package manager from:

- `pnpm-workspace.yaml`
- `workspaces` field in root `package.json`
- Lock files (`pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`)

## Documentation

- [API Reference](./docs/api.md) - Complete programmatic API documentation
- [How It Works](./docs/how-it-works.md) - Deep dive into the bundling process
- [Troubleshooting](./docs/troubleshooting.md) - Common errors and solutions

## License

MIT
