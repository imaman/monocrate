# Monocrate Programmatic API

Monocrate can be used as a library in your Node.js automation scripts, CI/CD pipelines, and build tools. This document covers the complete API for programmatic usage.

## Installation

### As a Project Dependency

Add Monocrate to your project for programmatic use:

```bash
npm install --save-dev monocrate
```

Then import in your code:

```typescript
import { monocrate, type MonocrateOptions, type MonocrateResult } from 'monocrate'
```

### As a Global Tool

For command-line usage across your system:

```bash
npm install -g monocrate
```

The global installation includes both the CLI and the programmatic API if you need it in scripts.

## Basic Usage

The simplest usage requires only the package path and a working directory:

```typescript
import { monocrate } from 'monocrate'

const result = await monocrate({
  pathToSubjectPackages: 'packages/my-app',
  cwd: process.cwd(),
  publish: false,
  bump: 'patch',
})

console.log(`Version: ${result.resolvedVersion}`)
console.log(`Output: ${result.outputDir}`)
```

All options flow through the `MonocrateOptions` interface, which includes required and optional fields.

## MonocrateOptions Interface

### `pathToSubjectPackages`

**Type:** `string | string[]`

**Required:** Yes

Path(s) to the package(s) you want to assemble and publish. Can be absolute or relative to `cwd`. When an array is provided, multiple packages are assembled with synchronized versions.

**When to use:** Specify one path for single-package publishing, or an array for monorepo scenarios where multiple packages share versioning.

**Examples:**

```typescript
// Single package
await monocrate({
  pathToSubjectPackages: 'packages/app',
  cwd: process.cwd(),
  publish: false,
  bump: 'patch',
})

// Multiple packages with synchronized versions
await monocrate({
  pathToSubjectPackages: ['packages/core', 'packages/cli', 'packages/ui'],
  cwd: process.cwd(),
  publish: true,
  bump: 'minor',
})

// Absolute path
await monocrate({
  pathToSubjectPackages: '/home/user/mono/packages/lib',
  cwd: '/home/user/mono',
  publish: false,
  bump: '1.5.0',
})
```

### `cwd`

**Type:** `string`

**Required:** Yes

The current working directory to use as a base for resolving relative paths. Must be a valid, existing directory. Typically `process.cwd()` in scripts.

**When to use:** Always provide this explicitly in scripts to ensure consistent path resolution regardless of the actual working directory when the script runs.

**Examples:**

```typescript
// Use current working directory
await monocrate({
  pathToSubjectPackages: 'packages/app',
  cwd: process.cwd(),
  publish: false,
  bump: 'patch',
})

// Use a specific base directory
const monorepoRoot = '/opt/projects/my-mono'
await monocrate({
  pathToSubjectPackages: 'packages/app',
  cwd: monorepoRoot,
  publish: false,
  bump: 'patch',
})
```

### `publish`

**Type:** `boolean`

**Required:** Yes

Controls whether the assembled package is published to npm after building.

- `true`: Assembly is published to npm immediately
- `false`: Assembly is prepared with the resolved version but not published (useful for inspection, testing, or manual publishing)

**When to use:** Set to `false` during dry runs, testing, and inspection workflows. Set to `true` for automated release pipelines.

**Examples:**

```typescript
// Dry run: inspect output without publishing
const result = await monocrate({
  pathToSubjectPackages: 'packages/app',
  cwd: process.cwd(),
  publish: false,
  bump: 'patch',
})
console.log(`Ready to inspect at: ${result.outputDir}`)

// Actual publish
await monocrate({
  pathToSubjectPackages: 'packages/app',
  cwd: process.cwd(),
  publish: true,
  bump: 'patch',
})
```

### `bump`

**Type:** `string` (optional, defaults to `'minor'`)

Version specifier that controls how the version is calculated. Accepts:

- Explicit semver versions: `'1.2.3'`, `'2.0.0'`
- Increment keywords: `'patch'`, `'minor'`, `'major'`

When using increment keywords, Monocrate finds the highest current version of all packages being published and applies the increment.

**When to use:** Use explicit versions for controlled releases. Use keywords for automatic version increments in CI/CD pipelines.

**Examples:**

```typescript
// Explicit version
await monocrate({
  pathToSubjectPackages: 'packages/app',
  cwd: process.cwd(),
  publish: false,
  bump: '3.4.5',
})

// Patch bump (default for bug fixes)
await monocrate({
  pathToSubjectPackages: 'packages/app',
  cwd: process.cwd(),
  publish: false,
  bump: 'patch',
})

// Minor bump (default when bump is not specified)
await monocrate({
  pathToSubjectPackages: 'packages/app',
  cwd: process.cwd(),
  publish: false,
  bump: 'minor',
})

// Major bump (breaking changes)
await monocrate({
  pathToSubjectPackages: 'packages/app',
  cwd: process.cwd(),
  publish: false,
  bump: 'major',
})
```

### `outputRoot`

**Type:** `string` (optional)

Directory where assembled packages are written. The actual output goes into a subdirectory named after the package. Can be absolute or relative to `cwd`.

If not specified, a temporary directory is created under the system temp directory (cleaned up by the OS).

**When to use:** Specify when you need the output in a predictable location for inspection, testing, or further processing.

**Examples:**

```typescript
// Use a temp directory (default)
const result = await monocrate({
  pathToSubjectPackages: 'packages/app',
  cwd: process.cwd(),
  publish: false,
  bump: 'patch',
})
// result.outputDir might be: /tmp/monocrate-xyz123/app

// Explicit output directory
const result = await monocrate({
  pathToSubjectPackages: 'packages/app',
  cwd: process.cwd(),
  outputRoot: './dist',
  publish: false,
  bump: 'patch',
})
// result.outputDir will be: ./dist/app

// Absolute path for CI/CD
const result = await monocrate({
  pathToSubjectPackages: 'packages/app',
  cwd: process.cwd(),
  outputRoot: '/build/artifacts',
  publish: false,
  bump: 'patch',
})
// result.outputDir will be: /build/artifacts/app
```

### `monorepoRoot`

**Type:** `string` (optional)

Path to the monorepo root directory. Can be absolute or relative to `cwd`.

If not specified, Monocrate auto-detects by searching for a `package.json` with workspaces configuration starting from the subject package and moving upward.

**When to use:** Specify only when auto-detection fails or to enforce a specific monorepo root in edge cases.

**Examples:**

```typescript
// Auto-detect monorepo root (default)
await monocrate({
  pathToSubjectPackages: 'packages/app',
  cwd: process.cwd(),
  publish: false,
  bump: 'patch',
})

// Explicit monorepo root
await monocrate({
  pathToSubjectPackages: 'packages/app',
  cwd: '/home/user/mono',
  monorepoRoot: '/home/user/mono',
  publish: false,
  bump: 'patch',
})

// Relative monorepo root
await monocrate({
  pathToSubjectPackages: 'packages/app',
  cwd: process.cwd(),
  monorepoRoot: '.',
  publish: false,
  bump: 'patch',
})
```

### `report`

**Type:** `string` (optional)

File path where the resolved version should be written. Can be absolute or relative to `cwd`.

If specified, the resolved version is written to this file instead of stdout. Useful for capturing the version in CI/CD for subsequent steps.

**When to use:** Use in CI/CD pipelines to capture the resolved version for reporting, artifact naming, or follow-up steps.

**Examples:**

```typescript
// Write version to file
await monocrate({
  pathToSubjectPackages: 'packages/app',
  cwd: process.cwd(),
  publish: true,
  bump: 'patch',
  report: './VERSION.txt',
})
// VERSION.txt contains: 1.2.3

// Use for downstream steps
const fs = require('fs')
await monocrate({
  pathToSubjectPackages: 'packages/app',
  cwd: process.cwd(),
  publish: true,
  bump: 'minor',
  report: './.monocrate-version',
})
const version = fs.readFileSync('./.monocrate-version', 'utf-8').trim()
console.log(`Published version: ${version}`)
```

### `mirrorTo`

**Type:** `string` (optional)

Path to a directory where source files are mirrored. Can be absolute or relative to `cwd`.

Primary use case: copying exact source code from a private monorepo to a public mirror repository alongside publishing. Only committed files (from HEAD) are copied with path structure preserved relative to the monorepo root. Each package's target directory is wiped before copying. Fails if any package has untracked files.

**When to use:** Use when publishing open-source packages from a private monorepo and wanting the sources publicly available in a mirror repo.

**Examples:**

```typescript
// Mirror to public repository
await monocrate({
  pathToSubjectPackages: 'packages/sdk',
  cwd: process.cwd(),
  publish: true,
  bump: 'minor',
  mirrorTo: '../public-sdk/packages',
})

// Mirror with absolute path
await monocrate({
  pathToSubjectPackages: 'packages/cli',
  cwd: '/home/user/private-mono',
  publish: true,
  bump: 'patch',
  mirrorTo: '/home/user/public-mirror/packages',
})
```

### `npmrcPath`

**Type:** `string` (optional)

Path to an `.npmrc` file to use for npm authentication and configuration. Can be absolute or relative to `cwd`.

Settings from this file are merged with any package-specific `.npmrc`, with package-specific settings winning on conflicts. Useful for providing credentials for private registries or authenticated publishing.

**When to use:** Use in CI/CD environments where you need to provide npm credentials or configure a custom registry.

**Examples:**

```typescript
// Use a custom .npmrc for authentication
await monocrate({
  pathToSubjectPackages: 'packages/app',
  cwd: process.cwd(),
  publish: true,
  bump: 'patch',
  npmrcPath: './.npmrc-ci',
})

// With environment-based token
const fs = require('fs')
const tmpNpmrc = '/tmp/.npmrc'
fs.writeFileSync(tmpNpmrc, `//registry.npmjs.org/:_authToken=${process.env.NPM_TOKEN}`)
await monocrate({
  pathToSubjectPackages: 'packages/app',
  cwd: process.cwd(),
  publish: true,
  bump: 'patch',
  npmrcPath: tmpNpmrc,
})
```

## MonocrateResult Interface

The return value from `monocrate()` contains information about the assembly and publishing operation.

### `resolvedVersion`

**Type:** `string`

The calculated version after applying the bump specifier. Examples: `'1.2.3'`, `'2.0.0'`.

**Usage:**

```typescript
const result = await monocrate({
  pathToSubjectPackages: 'packages/app',
  cwd: process.cwd(),
  publish: true,
  bump: 'minor',
})
console.log(`Published at version: ${result.resolvedVersion}`)
```

### `outputDir`

**Type:** `string`

The directory path where the assembly of the first package was created. Useful for inspection or further processing.

When `outputRoot` is not specified, this is a temporary directory.

**Usage:**

```typescript
const result = await monocrate({
  pathToSubjectPackages: 'packages/app',
  cwd: process.cwd(),
  outputRoot: './dist',
  publish: false,
  bump: 'patch',
})
console.log(`Assembly at: ${result.outputDir}`)
// Might print: Assembly at: ./dist/app
```

### `summaries`

**Type:** `{ packageName: string; outputDir: string }[]`

Array of details about each package that was assembled. When publishing a single package, this array has one element. When publishing multiple packages, this contains an entry for each.

**Usage:**

```typescript
const result = await monocrate({
  pathToSubjectPackages: ['packages/core', 'packages/cli'],
  cwd: process.cwd(),
  publish: true,
  bump: 'minor',
})
result.summaries.forEach(({ packageName, outputDir }) => {
  console.log(`${packageName} published from ${outputDir}`)
})
```

## Real-World Examples

### Example 1: Conditional Publishing Based on Environment

Publish only in specific environments, such as on main branch or when explicitly enabled.

```typescript
import { monocrate } from 'monocrate'

async function publishIfMain() {
  const isMMain = process.env.GIT_BRANCH === 'main'

  const result = await monocrate({
    pathToSubjectPackages: 'packages/app',
    cwd: process.cwd(),
    publish: isMMain,
    bump: 'patch',
  })

  if (isMMain) {
    console.log(`Published to npm at version: ${result.resolvedVersion}`)
  } else {
    console.log(`Dry run prepared at: ${result.outputDir}`)
  }
}
```

### Example 2: Custom Version Logic from Git Tags

Read the version from git tags and pass an explicit version to monocrate.

```typescript
import { monocrate } from 'monocrate'
import { execSync } from 'child_process'

async function publishWithGitVersion() {
  // Get version from git tag (e.g., v1.2.3)
  let version = 'patch' // fallback to patch bump
  try {
    const tag = execSync('git describe --tags --abbrev=0', {
      encoding: 'utf-8',
    }).trim()
    // Strip 'v' prefix if present
    version = tag.startsWith('v') ? tag.slice(1) : tag
  } catch {
    console.log('No git tag found, using patch bump')
  }

  const result = await monocrate({
    pathToSubjectPackages: 'packages/app',
    cwd: process.cwd(),
    publish: true,
    bump: version,
  })

  console.log(`Published version: ${result.resolvedVersion}`)
}
```

### Example 3: Integration with semantic-release

Use monocrate in a semantic-release plugin to handle monorepo packages.

```typescript
import { monocrate } from 'monocrate'

async function semanticReleaseMonocrate(pluginConfig) {
  // semantic-release provides the next version
  const nextVersion = pluginConfig.nextRelease?.version

  if (!nextVersion) {
    console.log('No version bump needed')
    return
  }

  const result = await monocrate({
    pathToSubjectPackages: 'packages/app',
    cwd: process.cwd(),
    publish: true,
    bump: nextVersion,
  })

  return {
    name: 'monocrate',
    url: `https://npmjs.org/package/my-app/${result.resolvedVersion}`,
  }
}
```

### Example 4: Multi-Package Coordination

Publish multiple packages with synchronized versions and verify each one.

```typescript
import { monocrate } from 'monocrate'
import * as fs from 'fs'

async function publishMultiPackage() {
  const packages = ['packages/core', 'packages/cli', 'packages/ui']

  const result = await monocrate({
    pathToSubjectPackages: packages,
    cwd: process.cwd(),
    publish: true,
    bump: 'minor',
  })

  console.log(`Published ${result.summaries.length} packages:`)
  result.summaries.forEach(({ packageName, outputDir }) => {
    const pkgJson = JSON.parse(
      fs.readFileSync(`${outputDir}/package.json`, 'utf-8')
    )
    console.log(`  ${packageName} v${pkgJson.version}`)
  })
}
```

### Example 5: Automated Mirroring Workflow

Publish to npm and simultaneously mirror sources to a public repository.

```typescript
import { monocrate } from 'monocrate'
import { execSync } from 'child_process'

async function publishAndMirror() {
  const publicMirrorPath = '../public-sdk'

  // Ensure the mirror repository exists and is clean
  execSync(`git -C ${publicMirrorPath} pull origin main`)

  const result = await monocrate({
    pathToSubjectPackages: 'packages/sdk',
    cwd: process.cwd(),
    publish: true,
    bump: 'minor',
    mirrorTo: `${publicMirrorPath}/packages`,
  })

  // Commit and push the mirrored sources
  execSync(
    `git -C ${publicMirrorPath} add packages && git -C ${publicMirrorPath} commit -m "Mirror: v${result.resolvedVersion}" && git -C ${publicMirrorPath} push origin main`,
    { stdio: 'inherit' }
  )
}
```

### Example 6: CI/CD Integration with Version Capture

Capture the resolved version for use in downstream CI/CD steps.

```typescript
import { monocrate } from 'monocrate'
import * as fs from 'fs'

async function ciPublishWithReporting() {
  // Create build output directory
  const buildDir = process.env.CI_BUILD_DIR || './build'
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true })
  }

  const versionFile = `${buildDir}/VERSION`

  const result = await monocrate({
    pathToSubjectPackages: 'packages/app',
    cwd: process.cwd(),
    outputRoot: buildDir,
    publish: true,
    bump: 'patch',
    report: versionFile,
  })

  // Read back the version for logging
  const version = fs.readFileSync(versionFile, 'utf-8').trim()

  // Set environment variable for next step in CI
  console.log(`::set-output name=version::${version}`)
  console.log(`Published to npm at: ${result.resolvedVersion}`)

  return {
    version: result.resolvedVersion,
    outputDir: result.outputDir,
  }
}
```

### Example 7: Dry-Run Verification

Perform a dry run to verify the assembly without publishing, then conditionally proceed.

```typescript
import { monocrate } from 'monocrate'
import * as fs from 'fs'

async function publishWithVerification() {
  // First, dry run to verify the assembly
  console.log('Running dry-run verification...')
  const dryRun = await monocrate({
    pathToSubjectPackages: 'packages/app',
    cwd: process.cwd(),
    outputRoot: './verify-output',
    publish: false,
    bump: 'patch',
  })

  // Verify the output
  const packageJsonPath = `${dryRun.outputDir}/package.json`
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error('Assembly verification failed: package.json not found')
  }

  const pkgJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
  console.log(`Verified assembly: ${pkgJson.name} v${pkgJson.version}`)

  // Proceed with actual publishing
  const publishResult = await monocrate({
    pathToSubjectPackages: 'packages/app',
    cwd: process.cwd(),
    publish: true,
    bump: 'patch',
  })

  console.log(`Successfully published v${publishResult.resolvedVersion}`)
  return publishResult
}
```

## Error Handling

Monocrate throws errors when configuration is invalid or operations fail. Always wrap calls in try-catch or use proper async error handling.

### Common Errors

**Non-existent cwd:** The `cwd` path must exist and be a valid directory.

```typescript
try {
  await monocrate({
    pathToSubjectPackages: 'packages/app',
    cwd: '/nonexistent/path',
    publish: false,
    bump: 'patch',
  })
} catch (error) {
  console.error(`Failed: ${error.message}`)
  // Output: Failed: cwd does not exist: /nonexistent/path
}
```

**Invalid package path:** The package path must exist relative to `cwd`.

```typescript
try {
  await monocrate({
    pathToSubjectPackages: 'packages/missing',
    cwd: process.cwd(),
    publish: false,
    bump: 'patch',
  })
} catch (error) {
  console.error(`Package not found: ${error.message}`)
}
```

**Invalid version specifier:** Use valid semver versions or increment keywords.

```typescript
try {
  await monocrate({
    pathToSubjectPackages: 'packages/app',
    cwd: process.cwd(),
    publish: false,
    bump: 'invalid-version', // Invalid
  })
} catch (error) {
  console.error(`Invalid version: ${error.message}`)
}
```

**NPM publishing failure:** Publishing failures (auth, network, etc.) bubble up as errors.

```typescript
try {
  await monocrate({
    pathToSubjectPackages: 'packages/app',
    cwd: process.cwd(),
    publish: true,
    bump: 'patch',
  })
} catch (error) {
  console.error(`Publishing failed: ${error.message}`)
  process.exit(1)
}
```

### Graceful Error Handling Pattern

```typescript
import { monocrate, type MonocrateResult } from 'monocrate'

async function safePublish(): Promise<MonocrateResult | null> {
  try {
    const result = await monocrate({
      pathToSubjectPackages: 'packages/app',
      cwd: process.cwd(),
      publish: true,
      bump: 'patch',
    })
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Monocrate failed: ${message}`)
    return null
  }
}

// Usage
const result = await safePublish()
if (result) {
  console.log(`Success: v${result.resolvedVersion}`)
} else {
  console.log('Publishing failed, see errors above')
}
```

## TypeScript Usage

Monocrate is fully typed with TypeScript. Leverage the type exports for type-safe automation.

### Type Imports

```typescript
import { monocrate, type MonocrateOptions, type MonocrateResult } from 'monocrate'
```

### Options Typing

TypeScript enforces that required fields are provided and types are correct:

```typescript
import type { MonocrateOptions } from 'monocrate'

// Valid: all required fields provided
const options: MonocrateOptions = {
  pathToSubjectPackages: 'packages/app',
  cwd: process.cwd(),
  publish: false,
  bump: 'patch',
}

// TypeScript error: missing 'cwd'
// const invalid: MonocrateOptions = {
//   pathToSubjectPackages: 'packages/app',
//   publish: false,
// }

// TypeScript error: 'publish' must be boolean, not string
// const invalid: MonocrateOptions = {
//   pathToSubjectPackages: 'packages/app',
//   cwd: process.cwd(),
//   publish: 'yes',
// }
```

### Result Typing

The result is typed, providing autocomplete and safety for accessing result properties:

```typescript
import { monocrate, type MonocrateResult } from 'monocrate'

const result: MonocrateResult = await monocrate({
  pathToSubjectPackages: 'packages/app',
  cwd: process.cwd(),
  publish: false,
  bump: 'patch',
})

// Fully typed access
const version: string = result.resolvedVersion
const dir: string = result.outputDir
const summaries: { packageName: string; outputDir: string }[] = result.summaries
```

### Building Wrapper Functions

Create type-safe wrapper functions for your automation patterns:

```typescript
import { monocrate, type MonocrateOptions, type MonocrateResult } from 'monocrate'

async function publishPatch(packagePath: string): Promise<MonocrateResult> {
  const options: MonocrateOptions = {
    pathToSubjectPackages: packagePath,
    cwd: process.cwd(),
    publish: true,
    bump: 'patch',
  }
  return monocrate(options)
}

async function dryRunPackages(packages: string[]): Promise<MonocrateResult> {
  const options: MonocrateOptions = {
    pathToSubjectPackages: packages,
    cwd: process.cwd(),
    publish: false,
    bump: 'minor',
    outputRoot: './dry-run',
  }
  return monocrate(options)
}
```

## Integration Patterns

### Programmatic Testing

Test your release workflow without publishing to npm:

```typescript
import { test, expect } from 'vitest'
import { monocrate } from 'monocrate'

test('package assembly produces valid output', async () => {
  const result = await monocrate({
    pathToSubjectPackages: 'packages/app',
    cwd: process.cwd(),
    publish: false,
    bump: '1.0.0',
    outputRoot: './test-output',
  })

  expect(result.resolvedVersion).toBe('1.0.0')
  expect(result.outputDir).toContain('test-output')
  expect(result.summaries).toHaveLength(1)
  expect(result.summaries[0]?.packageName).toBe('@myorg/app')
})
```

### Build Tool Integration

Use monocrate in your build tool (Vite, esbuild, Webpack plugins, etc.):

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { monocrate } from 'monocrate'

export default defineConfig({
  plugins: [
    {
      name: 'monocrate-publish',
      async closeBundle() {
        if (process.env.PUBLISH === 'true') {
          const result = await monocrate({
            pathToSubjectPackages: 'packages/app',
            cwd: process.cwd(),
            publish: true,
            bump: 'patch',
          })
          console.log(`Published v${result.resolvedVersion}`)
        }
      },
    },
  ],
})
```

### Custom Release Scripts

Create organization-specific release scripts:

```typescript
// scripts/release.ts
import { monocrate } from 'monocrate'
import { execSync } from 'child_process'

async function release() {
  // Ensure clean git state
  const status = execSync('git status --porcelain').toString()
  if (status.trim()) {
    throw new Error('Git working directory not clean')
  }

  // Run tests before release
  execSync('npm test', { stdio: 'inherit' })

  // Publish
  const result = await monocrate({
    pathToSubjectPackages: 'packages/app',
    cwd: process.cwd(),
    publish: true,
    bump: 'minor',
  })

  // Create release commit
  execSync(`git tag -a v${result.resolvedVersion} -m "Release v${result.resolvedVersion}"`)
  execSync(`git push origin main --tags`)

  console.log(`Release complete: v${result.resolvedVersion}`)
}

release().catch((error) => {
  console.error(error)
  process.exit(1)
})
```

## Summary

The Monocrate programmatic API provides fine-grained control over assembly and publishing workflows. With TypeScript support, configurable options, and clear error handling, you can integrate Monocrate into any Node.js automation pipeline. Whether you're building custom release scripts, CI/CD integrations, or build tool plugins, Monocrate's API adapts to your workflow.
