# Monocrate Documentation

**Version:** 0.2.0 | **Requires:** Node.js 20+

Welcome to Monocrate's documentation. This is your guide to publishing packages from monorepos to npm without the usual complications. Start with the right section for your needs—most people are ready to go after the Quickstart.

---

## Quick Start (5 minutes)

**Just want to publish?** Start here.

```bash
# Install globally
npm install -g monocrate

# Prepare your package (inspect before publishing)
monocrate prepare packages/my-app --output-dir ./staging

# Publish to npm
monocrate publish packages/my-app --bump patch
```

That's it. Your monorepo's internal dependencies are automatically resolved and included in the published package. No manual bundling, no broken imports—just works.

---

## What is Monocrate?

Monocrate solves a specific problem: **publishing a package from a monorepo when it depends on other packages in the same monorepo**.

Without Monocrate, you'd have to:
- Publish every internal dependency separately (slow and messy)
- Manually copy and merge files (error-prone)
- Bundle everything into one file (loses module structure and types)

Monocrate does this automatically: it finds your package's internal dependencies, copies their compiled files into your output, rewrites imports to point to relative paths, and merges third-party dependencies. Your published package is completely self-contained.

---

## Getting Started

### Installation

**Global CLI (recommended):**
```bash
npm install -g monocrate
```

**As a dev dependency:**
```bash
npm install --save-dev monocrate
npx monocrate publish packages/my-app
```

### First Publish

1. **Prepare your package** without publishing (inspect the output):
   ```bash
   monocrate prepare packages/my-app --output-dir ./staging
   ```

2. **Inspect the output** in `./staging/` to see what will be published.

3. **Publish when ready**:
   ```bash
   monocrate publish packages/my-app --bump patch
   ```

Requirements before you start:
- Node.js 20 or later
- Package must have a valid entry point (`main` or `exports` field in `package.json`)
- Monorepo must use npm, yarn, or pnpm workspaces

---

## Core Concepts

### How It Works (High Level)

1. **Discover** — Monocrate finds all packages in your monorepo workspaces
2. **Build dependency graph** — It traces from your target package to all internal dependencies
3. **Copy compiled files** — Copies each package's `dist/` directory to the output
4. **Rewrite imports** — Changes `import { x } from '@myorg/utils'` to `import { x } from '../deps/packages/utils/dist/index.js'`
5. **Merge dependencies** — Combines third-party dependencies from all included packages into one `package.json`

### Output Structure

When you publish `packages/app` that depends on `packages/utils` and `packages/utils` depends on `packages/core`:

```
output/
  package.json           ← Merged deps, in-repo refs removed
  dist/                  ← Your app's compiled files
    index.js
    index.d.ts
  deps/
    packages/
      utils/             ← Internal dep's compiled files
        dist/
          index.js
          index.d.ts
      core/              ← Transitive dep's compiled files
        dist/
          index.js
          index.d.ts
```

**Key point:** Entry points (`main`, `types`, `exports`) work unchanged because `dist/` stays in the same relative position.

### Module Structure is Preserved

Unlike bundlers that flatten code into a single file, Monocrate keeps modules separate. This means:
- Tree-shaking works for consumers
- Type declarations stay intact
- Source maps work without remapping
- Better compatibility with different module loaders

---

## CLI Reference

### Commands

#### `prepare <packages...>`
Assemble your package(s) without publishing. Useful for inspecting output or uploading manually.

```bash
monocrate prepare packages/app --output-dir ./dist
```

#### `publish <packages...>`
Assemble and publish directly to npm. Requires npm credentials configured.

```bash
monocrate publish packages/app --bump patch
```

### Flags

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--bump` | `-b` | Version increment: `patch`, `minor`, `major`, or explicit (e.g., `1.2.3`) | `minor` |
| `--output-dir` | `-o` | Directory to write output. Use for inspection or manual publishing. | Temp directory |
| `--root` | `-r` | Monorepo root. Auto-detected if omitted. | Auto-detect |
| `--mirror-to` | `-m` | Copy source files to another directory (for open-source mirrors) | N/A |
| `--report` | N/A | Write the resolved version to a file instead of stdout | N/A |

### Examples

```bash
# Simple patch bump and publish
monocrate publish packages/cli --bump patch

# Publish multiple packages with synchronized versions
monocrate publish packages/core packages/cli --bump minor

# Inspect output before publishing
monocrate prepare packages/app --output-dir ./publish-staging

# Mirror sources to a public repo alongside publishing
monocrate publish packages/sdk --bump patch --mirror-to ../public-repo/packages

# Publish and save resolved version to a file
monocrate publish packages/app --bump patch --report version.txt
```

---

## Advanced Usage

### Programmatic API

Use Monocrate as a library in your Node.js scripts:

```typescript
import { monocrate } from 'monocrate';

const result = await monocrate({
  pathToSubjectPackages: ['packages/my-app'],
  cwd: process.cwd(),
  publish: false,          // Set to true to publish to npm
  bump: 'minor',
});

console.log(result.resolvedVersion);  // "1.3.0"
console.log(result.outputDir);        // "/tmp/monocrate-xyz/my-app"
```

See TypeScript types for full API documentation.

### Publishing Multiple Packages

Publish several packages with synchronized versions:

```bash
monocrate publish packages/core packages/cli packages/web --bump minor
```

All packages will have their versions bumped together.

### Open-Source Mirroring

If you want to publish both to npm and to a public GitHub repo:

```bash
monocrate publish packages/sdk --bump patch --mirror-to ../sdk-public/src/packages
```

This copies the assembled package's source files to the mirror directory alongside publishing.

### Custom Output Directory

For CI/CD workflows, save the output to inspect or upload differently:

```bash
monocrate prepare packages/app --output-dir ./dist/app
# Now ./dist/app/ contains the publishable package
npm publish ./dist/app
```

---

## Under the Hood

### Copy-Based Assembly Strategy

Monocrate uses a copy-and-rewrite strategy instead of bundling. See the [assembly specification](./copy-based-assembly-spec.md) for technical details on:

- Directory structure and transformations
- Import rewriting algorithm
- `package.json` transformation rules
- Edge cases (subpath imports, dynamic imports, barrel exports)
- Testing guidelines

This approach preserves type declarations and module boundaries, avoiding the complexity of bundler configuration.

---

## Troubleshooting

### Common Issues

**"Cannot find module '@myorg/utils'"**
- Ensure all internal dependencies are in your monorepo's workspaces
- Check that the package has a valid `main` or `exports` field in `package.json`
- Run `monocrate prepare` to inspect the output structure

**"Entry point not found"**
- Verify your package's `package.json` has `main` or `exports`
- Ensure the file exists at that path (relative to package root)

**Version not bumping correctly**
- Use explicit version: `--bump 1.5.0` instead of `--bump minor`
- Check npm credentials: `npm whoami`

**Import still references package name in output**
- May indicate a dynamic or unconventional import pattern
- See the assembly spec for edge cases and examples

### Getting Help

- Check the [assembly specification](./copy-based-assembly-spec.md) for technical deep dives
- Review CLI examples in this document
- Open an issue on [GitHub](https://github.com/imaman/monocrate)

---

## Quick Links

**I want to publish my first package** → Run `npm install -g monocrate` then `monocrate publish packages/my-app --bump patch`

**I want to inspect the output first** → Use `monocrate prepare packages/my-app --output-dir ./staging`

**I need to understand how imports are rewritten** → See [Copy-Based Assembly](./copy-based-assembly-spec.md)

**I'm getting import errors** → Check the [assembly specification](./copy-based-assembly-spec.md) for edge cases

**I want to publish multiple packages together** → Use `monocrate publish packages/core packages/cli --bump minor`

**I want to mirror to another repo** → Add `--mirror-to ../mirror-repo/packages` to your publish command

---

## Requirements Summary

- **Node.js:** 20+
- **Monorepo:** npm, yarn, or pnpm workspaces
- **Packages:** Must have `main` or `exports` field in `package.json`
- **Permissions:** npm login credentials for publishing to npm

---

## License

MIT

---

## Next Steps

- **Brand new?** Start with the installation section and run your first `prepare` command.
- **Ready to publish?** Use the CLI Reference section to find the right flags for your situation.
- **Debugging?** Check Troubleshooting or read the assembly specification for technical details.
- **Building tooling on top?** Check the programmatic API section.
