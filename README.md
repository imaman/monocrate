# monocrate

[![npm version](https://img.shields.io/npm/v/monocrate.svg)](https://www.npmjs.com/package/monocrate)
[![CI](https://github.com/imaman/monocrate/actions/workflows/ci.yml/badge.svg)](https://github.com/imaman/monocrate/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

*Monorepos? Great. Publishing from a monorepo? Comically hard.*

## The Problem

Here is the distillation:

Consider `@acme/my-awesome-package`, which imports `@acme/internal-utils`, a workspace dependency. The naive 
approach - running `npm publish` - produces an uninstallable package because `@acme/internal-utils` was never published
to npm.

The standard solution is the "publish everything" approach. Tools like [Lerna](https://lerna.js.org/) will publish every
internal dependency as its own public package. Installation now works, but `@acme/internal-utils` just became a 
permanently published API you're committed to maintaining. _Your internal refactoring freedom is gone._

You can throw a bundler at the problem: tools like [esbuild](https://esbuild.github.io/) or 
[Rollup](https://rollupjs.org/) produce a self-contained file from a given entrypoint. But type declarations and 
sourcemaps often break, and consumers can't tree-shake a pre-bundled blob.

## The Solution

[monocrate](https://www.npmjs.com/package/monocrate) is a publishing CLI that gets this right. It produces a single 
publishable directory containing everything needed from your package and its in-repo dependencies. Essentially, it 
produces a standard npm package that looks like you hand-crafted it for publication.

- Consumers - get one package containing exactly the code they need. 
- Internal packages - remain unpublished.
- Tree-shaking - works.
- Sourcemaps - work. 
- Types - work.

### What Gets Published

Given this monorepo structure:
```
/path/to/my-monorepo/
└── packages/
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
/tmp/monocrate-xxxxxx/
└── packages/
    └── my-awesome-package/      # preserves the package's path in the monorepo
        ├── package.json         # name: "@acme/my-awesome-package", version: "1.3.0" (the new resolved version)
        ├── dist/
        │   └── index.js         # rewritten:
        │                        # import ... from '../deps/__acme__internal-utils/dist/index.js'
        └── deps/
            └── __acme__internal-utils/  # mangled package name
                └── dist/
                    └── index.js
```

The `deps/` directory is where the files of in-repo dependencies get embedded. Each dependency is placed under a
mangled version of its package name: `@acme/internal-utils` becomes `__acme__internal-utils`. This avoids name collisions 
regardless of where packages live in the monorepo.

### Version Resolution

`monocrate` uses **registry-based versioning**: it queries the registry for the latest published version and bumps it
according to your `--bump` flag (`patch`, `minor`, `major`). Your source `package.json` is never modified.

This means you don't need to maintain version numbers in your source code. The registry is the versioning source of 
truth, and `monocrate` computes the next version at publish time. Of course, if --bump is an exact version ("1.7.9") it 
is used as-is.

## Installation

```bash
pnpm add --save-dev monocrate
# or: yarn add --dev monocrate
# or: npm install --save-dev monocrate
```

## Usage

> **Note:** `monocrate` publishes, it doesn't build. Run your build first.
> ```bash
> npm run build
> ```

Once built, just `monocrate` it:

```bash
# Publish a package, patch bumping its version
npx monocrate packages/my-awesome-package --bump patch

# Use --dry-run to run in "prepare" mode: do everything short of publishing
npx monocrate packages/my-awesome-package --dry-run --output-dir /tmp/inspect --bump patch

# --bump defaults to "minor", so these two are equivalent:
npx monocrate packages/my-awesome-package --bump minor
npx monocrate packages/my-awesome-package

# Explicit version
npx monocrate packages/my-awesome-package --bump 2.3.0
```
## Programmatic API

For CI pipelines, custom build steps, or integration with other tooling, you can use monocrate as a library instead of invoking the CLI:

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

## Advanced Features

### Custom Publish Name

Sometimes your internal package name doesn't match the name you want on npm. Use `publishName` to publish under a
different name without renaming the package across your monorepo:

```json
{
  "name": "@acme/my-awesome-package",
  "monocrate": {
    "publishName": "best-package-ever"
  }
}
```

### Mirroring to a Public Repo

Want to open-source your package while keeping your monorepo private? Use `--mirror-to` to copy the package and its
in-repo dependencies to a separate public repository:

```bash
npx monocrate packages/my-awesome-package --mirror-to ../public-repo
```

This way, your public repo stays in sync with what you publish—all necessary packages included. Contributors can
clone and work on your package.

Requires a clean working tree. Only committed files (from `git HEAD`) are mirrored.

### Multiple Packages

You can publish packages separately (`monocrate a; monocrate b`) or together in one command. Publishing together
aligns their version numbers—useful when you want a unified version scheme across related packages (à la AWS SDK v3).
This is purely a convenience; correctness is unaffected since in-repo dependencies are always embedded:

```bash
npx monocrate packages/lib-a packages/lib-b --bump 2.4.0
```

## CLI Reference

```
monocrate <packages...> [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `packages` | One or more package directories to publish (required) |

### Options

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


## API Reference

### `monocrate(options): Promise<MonocrateResult>`

Assembles one or more monorepo packages and their in-repo dependencies, and optionally publishes to npm.

### `MonocrateOptions`

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `pathToSubjectPackages` | `string \| string[]` | Yes | — | Package directories to assemble. Relative paths resolved from `cwd`. |
| `publish` | `boolean` | Yes | — | Whether to publish to npm after assembly. |
| `cwd` | `string` | Yes | — | Base directory for resolving relative paths. |
| `bump` | `string` | No | `"minor"` | Version specifier: `"patch"`, `"minor"`, `"major"`, or explicit semver. |
| `outputRoot` | `string` | No | (temp dir) | Output directory for the assembled package. |
| `monorepoRoot` | `string` | No | (auto) | Monorepo root directory; auto-detected if omitted. |
| `mirrorTo` | `string` | No | — | Mirror source files to this directory. |
| `npmrcPath` | `string` | No | — | Path to `.npmrc` file for npm authentication. |

### `MonocrateResult`

| Property | Type | Description |
|----------|------|-------------|
| `outputDir` | `string` | Directory where the first package was assembled. |
| `resolvedVersion` | `string` | The resolved version that was applied. |
| `summaries` | `Array<{ packageName: string; outputDir: string }>` | Details for each assembled package. |


## The Assembly Process

Here's a conceptual breakdown of the steps that happen at a typcial `monocrate` run:

0. **Setup**: Creates a dedicated output directory
1. **Version Resolution**: Computes the new version (see [below](#version-resolution))
2. **Dependency Discovery**: Traverses the dependency graph to find all in-repo packages the package depends on, transitively
3. **File Embedding**: Copies the publishable files (per `npm pack`) of each in-repo dependency into the output directory
4. **Entry Point Resolution**: Examines each package's entry points (respecting `exports` and `main` fields) to compute
the exact file locations that import statements will resolve to
5. **Import Rewriting**: Scans the `.js` and `.d.ts` files, converting imports of workspace packages to relative path
imports (`@acme/internal-utils` becomes `../deps/__acme__internal-utils/dist/index.js`)
6. **Package.json Rewrite**: Sets the resolved version, removes in-repo deps, and adds any third-party deps they brought in
