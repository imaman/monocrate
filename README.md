# Monocrate

[![npm version](https://img.shields.io/npm/v/monocrate.svg)](https://www.npmjs.com/package/monocrate)
[![CI](https://github.com/imaman/monocrate/actions/workflows/ci.yml/badge.svg)](https://github.com/imaman/monocrate/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

From monorepo to npm in one command.

## Why

Publishing from a monorepo breaks when your package depends on internal packages. npm doesn't understand workspace references like `@myorg/utils`. You're forced to either publish every internal package separately, manually copy and merge files, or bundle everything into a single file (losing module structure and type declarations).

Monocrate gives you:

- **One command** — point at your package, done
- **Self-contained output** — internal dependencies are included, nothing else to publish
- **Preserved module structure** — no flattening into a single file, tree-shaking works
- **Type declarations included** — `.d.ts` files just work
- **Open-source mirroring** — `--mirror-to` copies sources to a public repo alongside publishing

## What Monocrate Does

**Before** (won't publish):
```typescript
// packages/cli/dist/index.js
import { helper } from '@myorg/utils'
```
```bash
$ npm publish
ERROR: Cannot find module '@myorg/utils'
```

**After** (ready to publish):
```typescript
// output/dist/index.js
import { helper } from '../deps/packages/utils/dist/index.js'
```
```bash
$ monocrate publish packages/cli --bump patch
✓ Published @myorg/cli@1.0.1
```

Monocrate copies `@myorg/utils` into the output and updates the import. That's it.

> **Not a bundler:** Unlike webpack or esbuild, monocrate doesn't flatten your code into one file.
> Your 50 files stay 50 files. Tree-shaking works. Debugging shows actual file:line numbers.
>
> **Use bundlers for:** Browser apps that need optimization
> **Use monocrate for:** Node.js libraries that should preserve module structure

## When to Use Monocrate

- ✅ You have a monorepo with internal dependencies
- ✅ You want to publish ONE package, not all of them
- ✅ You're publishing a Node.js library (not a browser app)
- ✅ You want to preserve module structure for tree-shaking
- ✅ You want easy debugging (not minified bundles)

## When NOT to Use Monocrate

- ❌ Browser applications (use webpack/vite instead)
- ❌ You want aggressive minification/optimization
- ❌ All your packages are already public on npm

## Install

```bash
npm install -g monocrate
```

## Usage

```bash
# Prepare for inspection without publishing
monocrate prepare packages/my-app

# Publish directly to npm
monocrate publish packages/my-app --bump patch
```

### Commands

**`prepare <packages...>`** — Assemble packages but don't publish. Useful for inspecting output or manual publishing.

**`publish <packages...>`** — Assemble and publish to npm.

### Options

| Flag | Description |
|------|-------------|
| `-b, --bump` | Version bump: `patch`, `minor`, `major`, or explicit version like `1.2.3`. Defaults to `minor`. |
| `-o, --output-dir` | Output directory. Defaults to a temp directory. |
| `-r, --root` | Monorepo root. Auto-detected if omitted. |
| `-m, --mirror-to` | Mirror source files to another directory (for open-source mirrors). |
| `--report` | Write the resolved version to a file instead of stdout. |

### Examples

```bash
# Bump patch version and publish
monocrate publish packages/cli --bump patch

# Publish multiple packages with synchronized versions
monocrate publish packages/core packages/cli

# Prepare to a specific directory for inspection
monocrate prepare packages/app --output-dir ./publish-staging

# Mirror sources to a public repo after publishing
monocrate publish packages/sdk --mirror-to ../public-repo/packages
```

## How It Works

1. Discovers all packages in the monorepo via workspace configuration
2. Builds a dependency graph starting from your target package
3. Copies each package's publishable files (determined by `npm pack`) to the output
4. Rewrites import statements from package names to relative paths (using `exports` or `main` fields)
5. Generates a `package.json` with merged third-party dependencies

### Output Structure

**Your monorepo:**
```
monorepo/
  packages/
    app/          ← you want to publish this
    utils/        ← app depends on this
    core/         ← utils depends on this
```

**After `monocrate prepare packages/app`:**
```
output/
  package.json    ← merged deps, @myorg refs removed
  dist/           ← app's files
  src/
  deps/
    packages/
      utils/      ← utils' files (imports rewritten)
        dist/
        src/
      core/       ← core's files (imports rewritten)
        dist/
        src/
```

Entry points (`main`, `types`, `exports`) work unchanged because each package's file structure stays in the same relative position.

## Requirements

- Node.js 20+
- Packages must have valid entry points (`exports` or `main` field in package.json)
- Monorepo must use npm, yarn, or pnpm workspaces

## Programmatic API

```typescript
import { monocrate } from 'monocrate';

const result = await monocrate({
  pathToSubjectPackages: ['packages/my-app'],
  cwd: process.cwd(),
  publish: false,
  bump: 'minor',
});

console.log(result.resolvedVersion);  // "1.3.0"
console.log(result.outputDir);        // "/tmp/monocrate-xyz/my-app"
```

## Documentation

- **[Quickstart Guide](./docs/quickstart.md)** — Your first publish in 10 minutes
- **[How It Works](./docs/how-it-works.md)** — Detailed explanation of the process
- **[CLI Reference](./docs/cli-reference.md)** — Complete command documentation
- **[Troubleshooting](./docs/troubleshooting.md)** — Common issues and solutions
- **[Advanced Guide](./docs/advanced.md)** — Multi-package publishing, mirroring, CI/CD
- **[API Documentation](./docs/api.md)** — Programmatic usage
- **[CI/CD Integration](./docs/ci-cd.md)** — GitHub Actions and GitLab examples

[View all documentation →](./docs/README.md)

## License

MIT
