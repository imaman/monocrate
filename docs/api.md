# API Reference

This document provides complete API documentation for Monocrate's programmatic interface.

## Table of Contents

- [Main Functions](#main-functions)
  - [bundle](#bundle)
  - [bundlePackage](#bundlepackage)
- [Dependency Resolution](#dependency-resolution)
  - [buildDependencyGraph](#builddependencygraph)
  - [discoverMonorepoPackages](#discovermonorepopackages)
  - [findPackageJson](#findpackagejson)
  - [detectWorkspaceConfig](#detectworkspaceconfig)
- [Bundle Assembly](#bundle-assembly)
  - [assembleBundle](#assemblebundle)
  - [createOutputDir](#createoutputdir)
  - [copyDistDirectory](#copydistdirectory)
  - [validateDistDirectories](#validatedistdirectories)
- [Package Transformation](#package-transformation)
  - [transformPackageJson](#transformpackagejson)
  - [extractThirdPartyDeps](#extractthirdpartydeps)
  - [generatePackageJson](#generatepackagejson)
  - [writePackageJson](#writepackagejson)
- [Types](#types)
- [Errors](#errors)

---

## Main Functions

### bundle

The primary entry point for bundling a monorepo package for npm publishing.

```typescript
function bundle(options: BundleOptionsInput): Promise<BundleResult>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `options` | `BundleOptionsInput` | Configuration options for the bundle operation |

**Options:**

```typescript
interface BundleOptionsInput {
  /** Absolute path to the package to bundle */
  packagePath: string;

  /** Absolute path to the monorepo root directory */
  monorepoRoot: string;

  /** Absolute path to the output directory */
  outputDir: string;

  /** Include source map files (.map). Default: true */
  includeSourceMaps?: boolean;

  /** Include declaration files (.d.ts). Default: true */
  includeDeclarations?: boolean;

  /** Strategy for handling version conflicts. Default: 'warn' */
  versionConflictStrategy?: 'highest' | 'error' | 'warn';

  /** Clean output directory before bundling. Default: true */
  cleanOutputDir?: boolean;

  /** Custom dist directory name. Default: 'dist' */
  distDirName?: string;
}
```

**Returns:** `Promise<BundleResult>`

```typescript
// Success case
interface BundleSuccess {
  success: true;
  outputPath: string;
  packageJson: PackageJson;
  mergedDependencies: Record<string, string>;
  includedPackages: readonly string[];
  versionConflicts: readonly VersionConflict[];
}

// Failure case
interface BundleFailure {
  success: false;
  error: string;
  details?: string;
  cause?: Error;
}

type BundleResult = BundleSuccess | BundleFailure;
```

**Example:**

```typescript
import { bundle } from 'monocrate';

const result = await bundle({
  packagePath: '/path/to/monorepo/packages/my-app',
  monorepoRoot: '/path/to/monorepo',
  outputDir: '/tmp/my-app-bundle',
  includeSourceMaps: true,
  includeDeclarations: true,
  versionConflictStrategy: 'warn',
});

if (result.success) {
  console.log('Bundle created at:', result.outputPath);
  console.log('Included packages:', result.includedPackages);

  if (result.versionConflicts.length > 0) {
    console.warn('Version conflicts detected:');
    for (const conflict of result.versionConflicts) {
      console.warn(`  ${conflict.dependencyName}: resolved to ${conflict.resolvedVersion}`);
    }
  }
} else {
  console.error('Bundle failed:', result.error);
  if (result.details) {
    console.error(result.details);
  }
}
```

---

### bundlePackage

Convenience function to bundle a package using the current working directory as the monorepo root.

```typescript
function bundlePackage(
  packageName: string,
  outputDir: string
): Promise<BundleResult>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `packageName` | `string` | Name of the package to bundle (as specified in package.json) |
| `outputDir` | `string` | Absolute path to the output directory |

**Example:**

```typescript
import { bundlePackage } from 'monocrate';

// Run from monorepo root
const result = await bundlePackage('@myorg/app', '/tmp/bundle');
```

---

## Dependency Resolution

### buildDependencyGraph

Builds a complete dependency graph for a package, including all transitive in-repo dependencies.

```typescript
function buildDependencyGraph(
  packagePath: string,
  monorepoRoot: string
): Promise<DependencyGraph>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `packagePath` | `string` | Absolute path to the package to analyze |
| `monorepoRoot` | `string` | Absolute path to the monorepo root |

**Returns:**

```typescript
interface DependencyGraph {
  /** The root package being bundled */
  readonly root: DependencyNode;

  /** Map of package names to their dependency nodes */
  readonly nodes: ReadonlyMap<string, DependencyNode>;

  /** Topologically sorted list of package names (dependencies before dependents) */
  readonly topologicalOrder: readonly string[];
}

interface DependencyNode {
  /** The monorepo package this node represents */
  readonly package: MonorepoPackage;

  /** Names of in-repo dependencies */
  readonly inRepoDependencies: readonly string[];

  /** Third-party dependencies with versions */
  readonly thirdPartyDependencies: Readonly<Record<string, string>>;
}
```

**Throws:**

- `CircularDependencyError` - If a circular dependency is detected
- `PackageJsonError` - If package.json cannot be read or is invalid

**Example:**

```typescript
import { buildDependencyGraph } from 'monocrate';

const graph = await buildDependencyGraph(
  '/path/to/monorepo/packages/my-app',
  '/path/to/monorepo'
);

console.log('Root package:', graph.root.package.packageJson.name);
console.log('Build order:', graph.topologicalOrder);

for (const [name, node] of graph.nodes) {
  console.log(`${name}:`);
  console.log('  In-repo deps:', node.inRepoDependencies);
  console.log('  Third-party deps:', Object.keys(node.thirdPartyDependencies));
}
```

---

### discoverMonorepoPackages

Discovers all packages in the monorepo based on workspace configuration.

```typescript
function discoverMonorepoPackages(
  monorepoRoot: string
): Promise<Map<string, MonorepoPackage>>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `monorepoRoot` | `string` | Absolute path to the monorepo root |

**Returns:**

```typescript
interface MonorepoPackage {
  /** Absolute path to the package directory */
  readonly path: string;

  /** Parsed package.json contents */
  readonly packageJson: PackageJson;

  /** Absolute path to the dist directory */
  readonly distPath: string;

  /** Whether the dist directory exists */
  readonly hasDistDirectory: boolean;
}
```

**Example:**

```typescript
import { discoverMonorepoPackages } from 'monocrate';

const packages = await discoverMonorepoPackages('/path/to/monorepo');

for (const [name, pkg] of packages) {
  console.log(`${name}:`);
  console.log(`  Path: ${pkg.path}`);
  console.log(`  Version: ${pkg.packageJson.version}`);
  console.log(`  Built: ${pkg.hasDistDirectory}`);
}
```

---

### findPackageJson

Reads and parses a package.json file from a directory.

```typescript
function findPackageJson(dir: string): Promise<PackageJson>
```

**Throws:** `PackageJsonError` if the file cannot be found, read, or parsed.

**Example:**

```typescript
import { findPackageJson } from 'monocrate';

const pkg = await findPackageJson('/path/to/package');
console.log(pkg.name, pkg.version);
```

---

### detectWorkspaceConfig

Detects workspace configuration from the monorepo root.

```typescript
function detectWorkspaceConfig(
  monorepoRoot: string
): Promise<WorkspaceConfig>
```

**Returns:**

```typescript
interface WorkspaceConfig {
  /** Detected package manager */
  readonly packageManager: 'npm' | 'yarn' | 'pnpm' | 'unknown';

  /** Glob patterns for workspace package locations */
  readonly patterns: readonly string[];

  /** Absolute path to the monorepo root */
  readonly rootPath: string;
}
```

**Example:**

```typescript
import { detectWorkspaceConfig } from 'monocrate';

const config = await detectWorkspaceConfig('/path/to/monorepo');
console.log('Package manager:', config.packageManager);
console.log('Workspace patterns:', config.patterns);
```

---

## Bundle Assembly

### assembleBundle

Assembles the complete bundle by copying all required dist directories.

```typescript
function assembleBundle(
  graph: DependencyGraph,
  options: BundleOptions
): Promise<AssemblyResult>
```

**Returns:**

```typescript
interface AssemblyResult {
  outputPath: string;
  assembledPackages: string[];
  totalFilesCopied: number;
  totalSize: number;
}
```

**Example:**

```typescript
import { buildDependencyGraph, assembleBundle } from 'monocrate';

const graph = await buildDependencyGraph(packagePath, monorepoRoot);
const result = await assembleBundle(graph, {
  packagePath,
  monorepoRoot,
  outputDir: '/tmp/bundle',
  includeSourceMaps: true,
  includeDeclarations: true,
  cleanOutputDir: true,
  versionConflictStrategy: 'warn',
  distDirName: 'dist',
});

console.log('Assembled packages:', result.assembledPackages);
console.log('Total files:', result.totalFilesCopied);
```

---

### createOutputDir

Creates and prepares the output directory for the bundle.

```typescript
function createOutputDir(
  outputPath: string,
  clean?: boolean
): Promise<string>
```

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `outputPath` | `string` | - | Absolute path to create |
| `clean` | `boolean` | `true` | Remove existing directory first |

**Throws:** `FileSystemError` if the directory cannot be created.

---

### copyDistDirectory

Copies a package's dist directory to the output.

```typescript
function copyDistDirectory(
  srcPkg: MonorepoPackage,
  outputDir: string,
  options: CopyOptions
): Promise<CopyResult>
```

**Options:**

```typescript
interface CopyOptions {
  includeSourceMaps: boolean;
  includeDeclarations: boolean;
  excludePatterns?: string[];
}
```

**Returns:**

```typescript
interface CopyResult {
  filesCopied: number;
  totalSize: number;
  files: string[];
}
```

---

### validateDistDirectories

Validates that all packages in the graph have dist directories.

```typescript
function validateDistDirectories(
  graph: DependencyGraph
): string[]
```

**Returns:** Array of package names missing dist directories.

**Example:**

```typescript
import { buildDependencyGraph, validateDistDirectories } from 'monocrate';

const graph = await buildDependencyGraph(packagePath, monorepoRoot);
const missing = validateDistDirectories(graph);

if (missing.length > 0) {
  console.error('These packages need to be built first:');
  for (const name of missing) {
    console.error(`  - ${name}`);
  }
}
```

---

## Package Transformation

### transformPackageJson

Transforms the package.json for the complete dependency graph.

```typescript
function transformPackageJson(
  graph: DependencyGraph,
  options: BundleOptions
): { packageJson: PackageJson; conflicts: VersionConflict[] }
```

**Example:**

```typescript
import { buildDependencyGraph, transformPackageJson } from 'monocrate';

const graph = await buildDependencyGraph(packagePath, monorepoRoot);
const { packageJson, conflicts } = transformPackageJson(graph, options);

console.log('Generated package.json:', packageJson);
if (conflicts.length > 0) {
  console.warn('Version conflicts:', conflicts);
}
```

---

### extractThirdPartyDeps

Extracts all third-party dependencies from a collection of packages.

```typescript
function extractThirdPartyDeps(
  packages: Iterable<DependencyNode>,
  options: TransformOptions
): ExtractedDependencies
```

**Options:**

```typescript
interface TransformOptions {
  versionConflictStrategy: 'highest' | 'error' | 'warn';
  preserveDevDependencies?: boolean;
  preservePeerDependencies?: boolean;
  removeFields?: string[];
  preserveFields?: string[];
}
```

**Returns:**

```typescript
interface ExtractedDependencies {
  dependencies: Record<string, string>;
  conflicts: VersionConflict[];
}

interface VersionConflict {
  dependencyName: string;
  versions: ReadonlyMap<string, string>;
  resolvedVersion: string;
}
```

---

### generatePackageJson

Generates a publish-ready package.json.

```typescript
function generatePackageJson(
  originalPkg: PackageJson,
  mergedDeps: Record<string, string>,
  options: TransformOptions
): PackageJson
```

---

### writePackageJson

Writes a package.json to disk.

```typescript
function writePackageJson(
  packageJson: PackageJson,
  outputPath: string
): Promise<void>
```

---

## Types

### PackageJson

```typescript
interface PackageJson {
  name: string;
  version: string;
  description?: string;
  main?: string;
  module?: string;
  types?: string;
  type?: 'module' | 'commonjs';
  exports?: Record<string, unknown>;
  files?: string[];
  bin?: string | Record<string, string>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  repository?: string | { type: string; url: string; directory?: string };
  keywords?: string[];
  author?: string | { name: string; email?: string; url?: string };
  license?: string;
  bugs?: string | { url?: string; email?: string };
  homepage?: string;
  private?: boolean;
  workspaces?: string[] | { packages: string[] };
  publishConfig?: Record<string, unknown>;
}
```

### Dependencies

```typescript
type Dependencies = Record<string, string>;
```

---

## Errors

Monocrate provides specialized error classes for different failure modes:

### MonocrateError

Base class for all Monocrate errors.

```typescript
class MonocrateError extends Error {
  readonly details?: string;
  readonly cause?: Error;
}
```

### PackageJsonError

Thrown when a package.json cannot be found or parsed.

```typescript
class PackageJsonError extends MonocrateError {
  readonly packagePath: string;
}
```

### CircularDependencyError

Thrown when a circular dependency is detected.

```typescript
class CircularDependencyError extends MonocrateError {
  readonly cycle: readonly string[];
}
```

### VersionConflictError

Thrown when version conflicts cannot be resolved (with `error` strategy).

```typescript
class VersionConflictError extends MonocrateError {
  readonly conflicts: readonly VersionConflict[];
}
```

### FileSystemError

Thrown when file system operations fail.

```typescript
class FileSystemError extends MonocrateError {
  readonly path: string;
}
```

**Example - Error Handling:**

```typescript
import {
  bundle,
  MonocrateError,
  CircularDependencyError,
  PackageJsonError,
} from 'monocrate';

try {
  const result = await bundle(options);
  // ...
} catch (error) {
  if (error instanceof CircularDependencyError) {
    console.error('Circular dependency detected:');
    console.error('  Cycle:', error.cycle.join(' -> '));
  } else if (error instanceof PackageJsonError) {
    console.error('Package.json error at:', error.packagePath);
    console.error('  ', error.message);
  } else if (error instanceof MonocrateError) {
    console.error('Monocrate error:', error.message);
    if (error.details) {
      console.error('  Details:', error.details);
    }
  } else {
    throw error;
  }
}
```

---

## Constants

### VERSION

Current version of monocrate.

```typescript
import { VERSION } from 'monocrate';
console.log(VERSION); // "1.0.0"
```

### COMMON_WORKSPACE_PATTERNS

Default workspace patterns used when no configuration is found.

```typescript
const COMMON_WORKSPACE_PATTERNS = [
  'packages/*',
  'libs/*',
  'apps/*',
  'modules/*',
  'services/*',
];
```
