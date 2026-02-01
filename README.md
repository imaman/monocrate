# monocrate

[![npm version](https://img.shields.io/npm/v/monocrate.svg)](https://www.npmjs.com/package/monocrate)
[![CI](https://github.com/imaman/monocrate/actions/workflows/ci.yml/badge.svg)](https://github.com/imaman/monocrate/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

*Because publishing from a monorepo should take seconds, not days.*

## The Problem

Monorepos are great. Publishing from a monorepo is comically hard:

Consider `@acme/my-awesome-package`, which imports `@acme/internal-utils`, a workspace dependency. The naive approach, running `npm publish`, produces an uninstallable package because `@acme/internal-utils` was never published to npm.

The standard solution is the "publish everything" approach. Tools like [Lerna](https://lerna.js.org/) will publish every internal dependency as its own public package. Installation now works, but `@acme/internal-utils` just became a permanently published API you're committed to maintaining. _Your internal refactoring freedom is gone._

Bundlers offer the opposite approach: tools like [esbuild](https://esbuild.github.io/) or [Rollup](https://rollupjs.org/) produce a self-contained file. But getting the TypeScript declarations (those `.d.ts` files) and the sourcemaps to _dovetail with the bundle_ requires fragile toolchain gymnastics.

## The Solution

[monocrate](https://www.npmjs.com/package/monocrate) solves this cleanly: a publishing CLI built for the monorepo era, it collects your package and its transitive internal dependencies into a single publishable unit.

It handles subpath imports, dynamic imports, and TypeScript's module resolution rules correctly. Your internal packages stay private. Consumers install one package. Tree-shaking works. Sourcemaps work. Types work.

## How It Works

Monocrate treats your package as the root of a dependency graph, then builds a self-contained publishable structure:

0. **Setup**: Creates a dedicated output directory
1. **Dependency Discovery**: Traverses the dependency graph to find all workspace packages your code depends on, transitively
2. **File Embedding**: Copies the publishable files (what `npm pack` would include) of each internal dependency into the output directory
3. **Entry Point Resolution**: Examines each package's entry points to compute the exact file locations that imports will resolve to
4. **Import Rewriting**: Scans the `.js` and `.d.ts` files, converting imports of workspace packages to relative path imports (`@acme/internal-utils` -> `../deps/packages/internal-utils/dist/index.js`)
5. **Dependency Pruning**: Rewrites the dependencies in the `package.json` - removes all workspace packages deps, adds any third-party deps they brought in

The result is a standard npm package that looks like you hand-crafted it for publication.

### What Gets Published

Given this monorepo structure:

```
packages/
├── my-awesome-package/
│   ├── package.json      # name: @acme/my-awesome-package
│   └── src/
│       └── index.ts      # import ... from '@acme/internal-utils'
└── internal-utils/
    ├── package.json      # name: @acme/internal-utils (private)
    └── src/
        └── index.ts
```

Running `npx monocrate packages/my-awesome-package` produces:

```
<tmpdir>/
└── __acme__my-awesome-package/
    ├── package.json      # name: @acme/my-awesome-package
    ├── dist/
    │   └── index.js      # rewritten:
    │                     # import ... from '../deps/packages/internal-utils/dist/index.js'
    └── deps/
        └── packages/
            └── internal-utils/
                └── dist/
                    └── index.js
```

Consumers get one package containing exactly the code they need, with no broken references to private workspace packages.

## Installation

```bash
pnpm add --save-dev monocrate
# or: yarn add --dev monocrate
# or: npm install --save-dev monocrate
```

## Usage

> **Note:** `monocrate` is a publishing tool, not a build tool. If you have a build script, run it first:
> ```bash
> npm run build
> ```

Once the package is built, you can `monocrate` it:

```bash
# Publish a package, patch bumping its version
npx monocrate packages/my-awesome-package --bump patch

# Use --dry-run to run in "prepare" mode: do everything short of publishing
npx monocrate packages/my-awesome-package --dry-run --output-dir /tmp/inspect --bump patch

# --bump defaults to "minor", so these two are identical:
npx monocrate packages/my-awesome-package --bump minor
npx monocrate packages/my-awesome-package

# Explicit version
npx monocrate packages/my-awesome-package --bump 2.3.0
```

> **Note:** `monocrate` does not modify your source code. Bump strategies are applied to the package's most recent version on the registry, not the version in your local `package.json`.

### Custom Publish Name

Publish `@acme/my-awesome-package` as `best-package-ever` without a repo-wide rename:

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

Use `monocrate` as a library for custom workflows or build steps:

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

The above snippet is the programmatic equivalent of `npx monocrate packages/my-awesome-package --bump minor`.

### API Reference

#### `monocrate(options): Promise<MonocrateResult>`

Assembles one or more monorepo packages and their in-repo dependencies, and optionally publishes to npm.

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

