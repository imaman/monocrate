# How Monocrate Works

This document provides a deep dive into Monocrate's bundling process, including the dependency resolution algorithm, bundle assembly strategy, and version conflict resolution.

## Overview

Monocrate's bundling process consists of four main phases:

1. **Discovery** - Find all packages in the monorepo
2. **Graph Construction** - Build a dependency graph with topological ordering
3. **Assembly** - Copy compiled code to the output directory
4. **Transformation** - Generate a publish-ready package.json

## Phase 1: Package Discovery

### Workspace Detection

Monocrate automatically detects your workspace configuration by checking (in order):

1. **pnpm-workspace.yaml** - For pnpm workspaces

   ```yaml
   packages:
     - 'packages/*'
     - 'libs/*'
   ```

2. **package.json workspaces field** - For npm/yarn workspaces

   ```json
   {
     "workspaces": ["packages/*", "libs/*"]
   }
   ```

3. **Fallback patterns** - If no configuration is found, common patterns are used:
   - `packages/*`
   - `libs/*`
   - `apps/*`
   - `modules/*`
   - `services/*`

### Package Manager Detection

The package manager is detected from lock files:

| Lock File | Package Manager |
|-----------|-----------------|
| `pnpm-lock.yaml` | pnpm |
| `yarn.lock` | yarn |
| `package-lock.json` | npm |

### Package Enumeration

For each workspace pattern, Monocrate:

1. Expands the glob pattern to find all `package.json` files
2. Parses and validates each package.json
3. Records whether the package has a `dist/` directory
4. Builds a map of package names to their metadata

```typescript
interface MonorepoPackage {
  path: string;           // /path/to/monorepo/packages/utils
  packageJson: PackageJson;
  distPath: string;       // /path/to/monorepo/packages/utils/dist
  hasDistDirectory: boolean;
}
```

## Phase 2: Dependency Graph Construction

### Separating Dependencies

For each package, dependencies are categorized:

- **In-repo dependencies** - Dependencies that match a package name in the monorepo
- **Third-party dependencies** - Everything else (npm packages)

```typescript
// Example package.json
{
  "dependencies": {
    "@myorg/utils": "workspace:*",  // In-repo
    "lodash": "^4.17.0"             // Third-party
  }
}
```

### Topological Sorting

Dependencies are processed in topological order, ensuring that:

1. A package's dependencies are processed before the package itself
2. The build order respects the dependency hierarchy

```
Given: app -> utils -> core

Topological order: [core, utils, app]
```

### Cycle Detection

Monocrate detects circular dependencies during graph construction using a depth-first search with a "visiting" set:

```
If package A is being visited and we encounter it again in the traversal,
a cycle exists.
```

When a cycle is detected, Monocrate reports the complete cycle chain:

```
Circular dependency detected
Dependency chain: pkg-a -> pkg-b -> pkg-c -> pkg-a

To resolve:
  1. Remove one direction of the dependency
  2. Extract shared code into a third package
```

### Graph Structure

The resulting dependency graph contains:

```typescript
interface DependencyGraph {
  root: DependencyNode;                    // The package being bundled
  nodes: Map<string, DependencyNode>;      // All packages in the graph
  topologicalOrder: string[];              // Build order
}

interface DependencyNode {
  package: MonorepoPackage;
  inRepoDependencies: string[];            // e.g., ["@myorg/utils"]
  thirdPartyDependencies: Dependencies;    // e.g., { lodash: "^4.17.0" }
}
```

## Phase 3: Bundle Assembly

### Validation

Before copying files, Monocrate validates that all packages have been built:

```typescript
const missing = validateDistDirectories(graph);
if (missing.length > 0) {
  // Fail with list of unbuilt packages
}
```

### Directory Structure

The output directory is structured as follows:

```
output/
  index.js              # Root package's compiled code
  index.d.ts            # Type declarations
  index.js.map          # Source maps (optional)
  _deps/
    _myorg_utils/       # @myorg/utils compiled code
      index.js
      index.d.ts
    _myorg_core/        # @myorg/core compiled code
      index.js
      index.d.ts
  package.json          # Generated package.json
```

### Package Name Mapping

Scoped package names are transformed for the `_deps` directory:

| Package Name | Directory |
|--------------|-----------|
| `@myorg/utils` | `_myorg_utils` |
| `@myorg/core` | `_myorg_core` |
| `simple-pkg` | `simple-pkg` |

### File Filtering

Files are filtered based on bundle options:

| File Type | Option | Default |
|-----------|--------|---------|
| `.js`, `.json`, etc. | Always included | - |
| `.map`, `.js.map` | `includeSourceMaps` | `true` |
| `.d.ts`, `.d.ts.map` | `includeDeclarations` | `true` |

### Security Considerations

During assembly, Monocrate:

- **Skips symlinks** - Prevents escaping the package directory
- **Validates paths** - Ensures no path traversal attacks
- **Ignores node_modules** - Never copies installed dependencies

## Phase 4: Package Transformation

### Dependency Merging

Third-party dependencies from all included packages are merged into a single dependencies object:

```typescript
// @myorg/app
{ "lodash": "^4.17.0", "axios": "^1.0.0" }

// @myorg/utils
{ "lodash": "^4.17.21" }

// Merged result
{ "lodash": "^4.17.21", "axios": "^1.0.0" }
```

### Version Conflict Resolution

When multiple packages depend on the same third-party package with different versions, Monocrate applies the configured strategy:

#### Strategy: `'highest'`

Silently selects the highest semver-compatible version.

```typescript
// Input: lodash "^4.17.0" and "^4.17.21"
// Output: lodash "^4.17.21"
```

#### Strategy: `'warn'`

Selects the highest version and logs a warning:

```
Warning: Version conflict for 'lodash':
  - @myorg/app: ^4.17.0
  - @myorg/utils: ^4.17.21
  Resolved to: ^4.17.21
```

#### Strategy: `'error'`

Fails the bundle operation:

```
Version conflict for dependency 'lodash'
Multiple packages require different versions:
  - @myorg/app: ^4.17.0
  - @myorg/utils: ^4.17.21

To resolve:
  1. Align all packages to use the same version
  2. Use 'warn' or 'highest' conflict strategy
```

### Semver Resolution Algorithm

1. Parse each version string using `semver.coerce()`
2. Compare parsed versions using `semver.gt()`
3. Return the original version string of the highest version

This preserves range specifiers (`^`, `~`, etc.) while selecting the highest minimum version.

### Package.json Transformation

The generated package.json:

**Preserves:**
- `name`, `version`, `description`
- `main`, `module`, `types`, `type`
- `exports`, `files`, `bin`
- `peerDependencies`, `optionalDependencies`
- `engines`, `repository`, `keywords`
- `author`, `license`, `bugs`, `homepage`
- `publishConfig`

**Removes:**
- `workspaces` - Not needed for published package
- `private` - Allows publishing
- `devDependencies` - Not needed at runtime
- `scripts` - Build scripts not needed
- All in-repo dependencies - They're bundled

**Replaces:**
- `dependencies` - With merged third-party dependencies

## Complete Flow Example

```
Input:
  monorepo/
    packages/
      app/
        package.json: { dependencies: { "@myorg/utils": "...", "axios": "^1.0.0" } }
        dist/
          index.js
      utils/
        package.json: { dependencies: { "@myorg/core": "...", "lodash": "^4.17.0" } }
        dist/
          index.js
      core/
        package.json: { dependencies: { "lodash": "^4.17.21" } }
        dist/
          index.js

Phase 1 - Discovery:
  Found packages: [@myorg/app, @myorg/utils, @myorg/core]

Phase 2 - Graph Construction:
  @myorg/app
    in-repo: [@myorg/utils]
    third-party: { axios: "^1.0.0" }
  @myorg/utils
    in-repo: [@myorg/core]
    third-party: { lodash: "^4.17.0" }
  @myorg/core
    in-repo: []
    third-party: { lodash: "^4.17.21" }

  Topological order: [@myorg/core, @myorg/utils, @myorg/app]

Phase 3 - Assembly:
  output/
    index.js          <- app/dist/index.js
    _deps/
      _myorg_utils/
        index.js      <- utils/dist/index.js
      _myorg_core/
        index.js      <- core/dist/index.js

Phase 4 - Transformation:
  Version conflict: lodash (^4.17.0 vs ^4.17.21) -> ^4.17.21

  package.json:
    name: "@myorg/app"
    dependencies:
      axios: "^1.0.0"
      lodash: "^4.17.21"
```

## Performance Considerations

- **Parallel file operations** - Where possible, file operations are batched
- **Early validation** - Missing dist directories are detected before any copying
- **Incremental copying** - Uses `recursive: true` for efficient directory operations
- **Memory efficient** - Streams files rather than loading into memory

## Limitations

1. **Requires pre-built packages** - Monocrate does not compile source code
2. **Single dist directory** - All packages must use the same output directory name
3. **No code bundling** - Files are copied as-is, not merged into a single bundle
4. **Flat dependencies** - All third-party dependencies are hoisted to the root

## Architecture Diagram

```
+------------------+
|  bundle()        |
+--------+---------+
         |
         v
+--------+---------+
| buildDependency  |
| Graph()          |
+--------+---------+
         |
         v
+--------+---------+
| validateDist     |
| Directories()    |
+--------+---------+
         |
         v
+--------+---------+
| assembleBundle() |
| - createOutputDir|
| - copyDist...    |
+--------+---------+
         |
         v
+--------+---------+
| transformPackage |
| Json()           |
| - extractDeps    |
| - mergeVersions  |
| - generatePkg    |
+--------+---------+
         |
         v
+--------+---------+
| writePackage     |
| Json()           |
+------------------+
```
