# Monocrate

From monorepo to npm in one command.

## Why

Publishing from a monorepo breaks when your package depends on internal packages. npm doesn't understand workspace references like `@myorg/utils`. You're forced to either publish every internal package separately, manually copy and merge files, or bundle everything into a single file (losing module structure and type declarations).

Monocrate gives you:

- **One command** — point at your package, done
- **Self-contained output** — internal dependencies are included, nothing else to publish
- **Preserved module structure** — no flattening into a single file, tree-shaking works
- **Type declarations included** — `.d.ts` files just work
- **Open-source mirroring** — `--mirror-to` copies sources to a public repo alongside publishing

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
| `-o, --output` | Output directory. Defaults to a temp directory. |
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
monocrate prepare packages/app --output ./publish-staging

# Mirror sources to a public repo after publishing
monocrate publish packages/sdk --mirror-to ../public-repo/packages
```

## How It Works

1. Discovers all packages in the monorepo via workspace configuration
2. Builds a dependency graph starting from your target package
3. Copies each package's `dist/` directory to the output
4. Rewrites import statements from package names to relative paths
5. Generates a `package.json` with merged third-party dependencies

### Output Structure

```
monorepo/
  packages/
    app/          ← you want to publish this
    utils/        ← app depends on this
    core/         ← utils depends on this

output/
  package.json    ← merged deps, in-repo refs removed
  dist/           ← app's compiled code
  deps/
    packages/
      utils/dist/ ← utils' compiled code (imports rewritten)
      core/dist/  ← core's compiled code (imports rewritten)
```

Entry points (`main`, `types`, `exports`) work unchanged because the `dist/` directory stays in the same relative position.

## Requirements

- Node.js 20+
- All packages must be compiled (have a `dist/` directory)
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

## License

MIT
