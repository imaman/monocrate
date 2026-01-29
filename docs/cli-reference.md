# Monocrate CLI Reference

From monorepo to npm in one command.

## Installation

Install Monocrate globally to use the CLI:

```bash
npm install -g monocrate
```

**Requirements:**
- Node.js 20.0.0 or higher
- Monorepo must use npm, yarn, or pnpm workspaces
- Packages must have valid entry points (`exports` or `main` field in package.json)

Verify installation:

```bash
monocrate --version
monocrate --help
```

## Commands Overview

Monocrate provides two main commands for working with monorepo packages:

| Command | Purpose | When to use |
|---------|---------|------------|
| `monocrate prepare` | Assemble packages without publishing | Inspect output, validate structure, manual publishing |
| `monocrate publish` | Assemble packages and publish to npm | Production publishing with automatic npm registry upload |

Both commands accept one or more package directories and support the same set of options/flags.

## monocrate prepare

**Syntax:**

```bash
monocrate prepare <packages...> [OPTIONS]
```

**Description:**

Assembles your monorepo packages into self-contained distributables without publishing to npm. This command:

1. Discovers and analyzes all internal dependencies
2. Bundles your package with its internal dependencies (e.g., local `@org/utils`)
3. Rewrites imports to use relative paths instead of package names
4. Generates a complete `package.json` with merged third-party dependencies
5. Outputs to a staging directory for inspection or manual publishing

Use `prepare` to validate output structure before publishing, or to manually control the publishing process.

### Basic Example

```bash
monocrate prepare packages/my-app
```

Output:
```
✓ Prepared @myorg/app@1.0.0
✓ Output: /tmp/monocrate-xyz/my-app
```

### Multiple Packages

Assemble and stage multiple packages with synchronized versions:

```bash
monocrate prepare packages/core packages/cli packages/web
```

Output:
```
✓ Prepared @myorg/core@2.1.0
✓ Prepared @myorg/cli@2.1.0
✓ Prepared @myorg/web@2.1.0
```

All packages are versioned together, and each gets its own output directory.

## monocrate publish

**Syntax:**

```bash
monocrate publish <packages...> [OPTIONS]
```

**Description:**

Assembles and publishes packages directly to npm. This command:

1. Performs all steps of `prepare` (assembly and dependency resolution)
2. Publishes the assembled package to the npm registry
3. Optionally mirrors source files to another directory
4. Writes resolved version to stdout or a report file

Use `publish` for standard CI/CD workflows and automated release processes.

### Basic Example

```bash
monocrate publish packages/my-app
```

Output:
```
✓ Resolved version: 1.0.1 (bumped from 1.0.0 with minor)
✓ Published @myorg/app@1.0.1 to npm
```

### With Version Bump

```bash
monocrate publish packages/api --bump patch
```

Output:
```
✓ Resolved version: 2.0.1 (bumped from 2.0.0 with patch)
✓ Published @myorg/api@2.0.1 to npm
```

### Publishing Multiple Packages

```bash
monocrate publish packages/core packages/cli --bump minor
```

Output:
```
✓ Resolved version: 3.1.0 (bumped from 3.0.5 with minor)
✓ Published @myorg/core@3.1.0 to npm
✓ Published @myorg/cli@3.1.0 to npm
```

Both packages use the same resolved version.

## Options/Flags

### `--bump <version>` (alias: `-b`)

Specifies the version bump strategy or explicit target version.

**Values:**

- `patch` - Increments patch version (1.0.0 → 1.0.1). Use for bug fixes.
- `minor` - Increments minor version (1.0.0 → 1.1.0). Use for new features. **Default**.
- `major` - Increments major version (1.0.0 → 2.0.0). Use for breaking changes.
- Explicit semver version - Sets exact version (e.g., `1.2.3`, `2.0.0-beta.1`, `0.0.1`)

**Default:** `minor`

**How it works:**

- When using `patch`, `minor`, or `major`, Monocrate finds the highest version across all target packages and applies the increment.
- When using an explicit version, that exact version is used.
- Pre-release versions are supported: `1.0.0-alpha.1`, `2.0.0-rc.2`, etc.

**Examples:**

Patch bump for bug fixes:

```bash
monocrate publish packages/app --bump patch
```

Output:
```
✓ Resolved version: 1.5.1 (bumped from 1.5.0 with patch)
✓ Published @myorg/app@1.5.1 to npm
```

Major bump for breaking changes:

```bash
monocrate publish packages/core --bump major
```

Output:
```
✓ Resolved version: 2.0.0 (bumped from 1.2.5 with major)
✓ Published @myorg/core@2.0.0 to npm
```

Set explicit version (including pre-release):

```bash
monocrate publish packages/sdk --bump 1.0.0-beta.1
```

Output:
```
✓ Resolved version: 1.0.0-beta.1 (explicit)
✓ Published @myorg/sdk@1.0.0-beta.1 to npm
```

### `--output-dir <path>` (alias: `-o`)

Specifies where assembled packages are written.

**Default:** Auto-generated temporary directory under system temp folder

**When to use:**

- Inspect the assembled output before publishing
- Manually publish to alternative registries
- Keep outputs for auditing or debugging
- Integrate with custom build pipelines

**Examples:**

Stage to a specific directory for inspection:

```bash
monocrate prepare packages/app --output-dir ./dist/staging
```

Output structure:
```
./dist/staging/
├── app/
│   ├── package.json
│   ├── dist/
│   ├── deps/
│   │   └── packages/
│   │       ├── utils/
│   │       └── core/
│   └── ...
```

Persist output for CI/CD pipeline:

```bash
monocrate publish packages/cli --output-dir ./build/release
```

### `--root <path>` (alias: `-r`)

Specifies the monorepo root directory.

**Default:** Auto-detected by searching upward for a package.json with `workspaces` configuration

**When to use:**

- Working from a subdirectory outside the monorepo
- Explicit control over monorepo location
- CI/CD environments where detection might fail
- Debugging monorepo structure issues

**Examples:**

Explicit root from subdirectory:

```bash
monocrate publish packages/app --root /home/user/my-monorepo
```

Using relative path:

```bash
cd /home/user/my-monorepo/scripts
monocrate publish ../packages/app --root ..
```

Auto-detected (recommended):

```bash
cd /home/user/my-monorepo
monocrate publish packages/app
# Root auto-detected as /home/user/my-monorepo
```

### `--mirror-to <path>` (alias: `-m`)

Mirrors source files from the monorepo to another directory (typically a public repository).

**Default:** No mirroring

**What it does:**

- Copies source files of all assembled packages to the target directory
- Preserves original file structure relative to monorepo root
- Only copies committed files (from git HEAD)
- Wipes each package's target directory before copying
- Fails if any package has untracked files

**Primary use case:**

Publishing from a private monorepo while maintaining a public open-source mirror repository.

**Examples:**

Mirror to public repo after publishing:

```bash
monocrate publish packages/sdk \
  --mirror-to ../public-mirror-repo/packages
```

Result:
```
private-monorepo/packages/sdk/  (original, private)
public-mirror-repo/packages/sdk/  (mirrored, public)
```

Multiple packages with synchronized mirroring:

```bash
monocrate publish packages/core packages/utils \
  --mirror-to ../public/packages
```

Result:
```
public/packages/
├── core/        ← copied from private monorepo
└── utils/       ← copied from private monorepo
```

Git-aware behavior:

```bash
# This works (all files committed)
monocrate publish packages/app --mirror-to ../public/packages

# This fails (untracked files in package)
git add .
# ... without committing ...
monocrate publish packages/app --mirror-to ../public/packages
# Error: Package has untracked files
```

### `--report <path>`

Writes the resolved version to a file instead of stdout.

**Default:** Output written to stdout

**When to use:**

- Capture resolved version for post-processing
- Pass version to downstream build steps
- Parse version from file in CI/CD pipelines
- Avoid mixed stdout from multiple tools

**Examples:**

Write version to file:

```bash
monocrate publish packages/app --bump patch --report ./version.txt
```

Content of `./version.txt`:
```
1.0.1
```

Use in CI/CD script:

```bash
#!/bin/bash
monocrate publish packages/app --bump minor --report version.txt
VERSION=$(cat version.txt)
echo "Published version: $VERSION"
gh release create "v$VERSION" --title "Release $VERSION"
```

Capture version from `prepare`:

```bash
monocrate prepare packages/lib --report ./staging-version.txt
STAGING_VERSION=$(cat staging-version.txt)
echo "Staged as version: $STAGING_VERSION"
```

## Environment Variables

### `NODE_AUTH_TOKEN`

Authentication token for publishing to npm.

**Default:** None

**Required for:**

- Publishing to npm registry with private packages
- Publishing to scoped packages (`@myorg/package`)
- CI/CD environments where npm credentials must be set

**How to set:**

Generate npm token:

```bash
npm token create
# Keep token safe, never commit to git
```

In your CI/CD provider (GitHub Actions example):

```yaml
- name: Publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
  run: monocrate publish packages/app --bump patch
```

In local environment:

```bash
export NODE_AUTH_TOKEN=npm_1234567890abcdef
monocrate publish packages/app --bump patch
```

## Common Usage Patterns

### Simple Release Flow

Standard workflow for publishing a single package:

```bash
# Test and validate
npm test

# Bump version and publish (default: minor)
monocrate publish packages/my-package

# Or with specific bump
monocrate publish packages/my-package --bump patch
```

### Multi-Package Monorepo

Release multiple interdependent packages with synchronized versions:

```bash
# All packages bumped together with same version
monocrate publish packages/core packages/cli packages/web --bump minor
```

### Staged Publishing with Inspection

Prepare output, verify, then publish to specific registry:

```bash
# Stage to local directory
monocrate prepare packages/app --output-dir ./dist/release

# Inspect output structure
ls -la ./dist/release/app

# Manually publish if validation passes
npm publish ./dist/release/app --registry https://custom-registry.example.com
```

### Open-Source Mirroring

Publish from private monorepo while syncing sources to public repo:

```bash
# Publish to npm and mirror sources
monocrate publish packages/sdk --bump minor \
  --mirror-to ../open-source-sdk/packages

# Push mirrored changes to public repo
cd ../open-source-sdk
git add .
git commit -m "Sync from private monorepo"
git push origin main
```

### CI/CD with Version Tracking

Capture and report version for downstream steps:

```bash
#!/bin/bash
set -e

# Publish and capture version
VERSION_FILE=$(mktemp)
monocrate publish packages/app --bump patch --report "$VERSION_FILE"
VERSION=$(cat "$VERSION_FILE")

# Create release notes
echo "Released version $VERSION"

# Tag release
git tag "v$VERSION"
git push origin "v$VERSION"

# Send notification
curl -X POST https://hooks.example.com/releases \
  -d "{\"version\": \"$VERSION\", \"package\": \"@myorg/app\"}"
```

### Explicit Version Control

Set exact version for release candidates and final releases:

```bash
# Release candidate
monocrate publish packages/app --bump 2.0.0-rc.1

# Final release after testing
monocrate publish packages/app --bump 2.0.0

# Hotfix to older major version
monocrate publish packages/app --bump 1.9.5
```

## Exit Codes

| Code | Meaning | Examples |
|------|---------|----------|
| 0 | Success | Package published, output staged, version resolved |
| 1 | Error | Missing required package, npm publish failed, git errors |

**Exit code 1 (Error) occurs when:**

- No package directories specified: `monocrate publish` (without packages)
- Package directory not found: `monocrate publish ./nonexistent`
- Invalid package structure (missing `package.json`, no entry point)
- Monorepo root not found and auto-detection fails
- npm publish fails (invalid credentials, network error, package already published)
- Git operation fails for mirroring (untracked files, uncommitted changes)
- Node.js version below 20.0.0

**Example error scenarios:**

```bash
# No packages specified
$ monocrate publish
At least one package directory must be specified
$ echo $?
1

# Package not found
$ monocrate publish ./packages/unknown
ENOENT: no such file or directory, scandir './packages/unknown'
$ echo $?
1

# npm auth failure
$ monocrate publish packages/app
ENOPERM: npm ERR! 403 Forbidden
$ echo $?
1

# Untracked files with mirror
$ monocrate publish packages/app --mirror-to ../public
Package has untracked files. Commit or stash changes.
$ echo $?
1
```

## Help and Diagnostics

View built-in help:

```bash
monocrate --help
monocrate prepare --help
monocrate publish --help
```

Check version:

```bash
monocrate --version
```

Debug flag combinations:

```bash
# Verbose output available through Node process
NODE_DEBUG=* monocrate publish packages/app --bump patch
```

## See Also

- [Programmatic API](./api-reference.md) - Use Monocrate in your code
- [Repository Structure](./how-it-works.md) - Understand how Monocrate assembles packages
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions
