# monocrate

[![npm version](https://img.shields.io/npm/v/monocrate.svg)](https://www.npmjs.com/package/monocrate)
[![CI](https://github.com/imaman/monocrate/actions/workflows/ci.yml/badge.svg)](https://github.com/imaman/monocrate/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Because publishing from a monorepo should take seconds, not days.

## The Problem

You have a monorepo, you are really proud of `@acme/my-awesome-package` and you want to make it open source. Its main file, `packages/my-awesome-package/src/index.ts`, probably looks something like this:


```typescript
// Reusing validation logic from elsewhere in the monorepo
import { validateUserInput } from '@acme/internal-utils'

export function processData(data: unknown) {
  const validated = validateUserInput(data)
  // ...
}
```

When you publish, things look great:

```bash
$ cd packages/my-awesome-package
$ npm publish
npm notice
npm notice 📦  @acme/my-awesome-package@1.0.0
npm notice Tarball Contents
npm notice 4.4kB README.md
npm notice 9.1kB dist/index.js
...
npm notice
npm notice Publishing to https://registry.npmjs.org/ with tag latest and public access

+ @acme/my-awesome-package@1.0.0
```

But then when you try to install it:

```bash
$ npm install @acme/my-awesome-package
npm error code E404
npm error 404 Not Found - GET https://registry.npmjs.org/@acme%2finternal-utils - Not found
npm error 404
npm error 404  '@acme/internal-utils@1.0.0' is not in this registry.
```

This is your 🚨🚨🚨 moment.

In theory, you could ...
- ...bundle with esbuild, rollup, and similar tools but tree-shaking breaks for consumers, source maps need a lot of attention to get right, and good luck getting these typescript types (.d.ts files) bundled.
- ...manually create the right directory structure, replacing all the imports with relative paths. You will manage to pull it off once, but that's definitely not sustainable.
- ...use a tool such as `lerna` which publishes every internal dependency separately as a standalone public package, but now `@acme/internal-utils` becomes permanent published API. This locks you into supporting that interface indefinitely, and internal refactoring freedom is lost.


## The Solution

Enter monocrate. It collects your package and its transitive internal dependencies into a single publishable unit. It handles subpath imports, dynamic imports, and TypeScript's module resolution rules correctly. Your internal packages stay private. Consumers install one package. Tree-shaking works. Sourcemaps work. Types work.


## Usage

> **Note:** Monocrate is a publishing tool, not a build tool. If you have a build script, run it first:
> ```bash
> npm run build
> ```

Once the package is built, you can run monocrate:

```bash
# Publish a package, patch bumping its version
npx monocrate packages/my-awesome-package --bump patch

# Use --dry-run to run in "prepare" mode: do everything but stop short of publishing to the registry
npx monocrate packages/my-awesome-package --output-dir /tmp/inspect --bump patch --dry-run

# --bump defaults to "minor", so these two are identical:
npx monocrate packages/my-awesome-package --bump minor
npx monocrate packages/my-awesome-package

# Explicit version
npx monocrate packages/my-awesome-package --bump 2.3.0
```

> **Note:** Monocrate does not modify your source code. Bump strategies are applied to the package's most recent version on the registry, not the version in your local `package.json`.

### Custom Publish Name

Publish `@acme/my-awesome-package` as `best-package-ever` without doing a repo-wide renaming:

```json
{
  "name": "@acme/my-awesome-package",
  ...
  "monocrate": {
    "publishName": "best-package-ever"
  }
}
```

### Mirroring to a Public Repo

Want to open-source your package while keeping your monorepo private? Use `--mirror-to` to copy the package and its internal dependencies to a separate public repository:

```bash
npx monocrate packages/my-awesome-package --mirror-to ../public-repo
```

This way, your public repo is self-contained—no dangling references to internal packages. Contributors can clone and work on your package.

Only committed files (from `git HEAD`) are mirrored; fails if untracked files exist.

### Multiple Packages

Publish several packages together with the same version:

```bash
npx monocrate packages/lib-a packages/lib-b --bump 2.4.0
```

### CLI Reference

```
monocrate <packages...> [options]
```

#### Arguments

| Argument | Description |
|----------|-------------|
| `packages` | One or more package directories to publish (required) |

#### Options

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--bump` | `-b` | `string` | `minor` | Version bump strategy: `patch`, `minor`, `major`, or explicit semver (e.g., `2.3.0`) |
| `--dry-run` | `-d` | `boolean` | `false` | Prepare the package without publishing to npm |
| `--output-dir` | `-o` | `string` | (temp dir) | Directory where assembled package is written |
| `--root` | `-r` | `string` | (auto) | Monorepo root directory (auto-detected if omitted) |
| `--mirror-to` | `-m` | `string` | — | Mirror source files to a directory (for public repos) |
| `--report` | | `string` | — | Write resolved version to a file instead of stdout |
| `--help` | | | | Show help |
| `--version` | | | | Show version number |

## Programmatic API

```typescript
import { monocrate } from 'monocrate'

const result = await monocrate({
  pathToSubjectPackages: ['packages/my-awesome-package'],
  publish: true,
  bump: 'minor',
  cwd: process.cwd()
})

console.log(result.resolvedVersion) // '1.3.0'
```

### API Reference

#### `monocrate(options): Promise<MonocrateResult>`

Assembles a monorepo package and its in-repo dependencies for npm publishing.

#### `MonocrateOptions`

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `pathToSubjectPackages` | `string \| string[]` | Yes | — | Package directories to assemble. Relative paths resolved from `cwd`. |
| `publish` | `boolean` | Yes | — | Whether to publish to npm after assembly. |
| `cwd` | `string` | Yes | — | Base directory for resolving relative paths. |
| `bump` | `string` | No | `"minor"` | Version specifier: `"patch"`, `"minor"`, `"major"`, or explicit semver. |
| `outputRoot` | `string` | No | (temp dir) | Output directory for the assembled package. |
| `monorepoRoot` | `string` | No | (auto) | Monorepo root directory; auto-detected if omitted. |
| `report` | `string` | No | — | Write resolved version to this file instead of stdout. |
| `mirrorTo` | `string` | No | — | Mirror source files to this directory. |
| `npmrcPath` | `string` | No | — | Path to `.npmrc` file for npm authentication. |

#### `MonocrateResult`

| Property | Type | Description |
|----------|------|-------------|
| `outputDir` | `string` | Directory where the first package was assembled. |
| `resolvedVersion` | `string` | The resolved version that was applied. |
| `summaries` | `Array<{ packageName: string; outputDir: string }>` | Details for each assembled package. |

## Installation

```bash
npm install --save-dev monocrate
```
