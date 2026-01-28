# Monocrate Quickstart

[Back to README](../README.md) | [Full Documentation](../README.md)

Get your monorepo package published to npm in 10 minutes.

## What You'll Do

1. Install monocrate
2. Run `monocrate prepare` to preview the output
3. Run `monocrate publish` to publish to npm
4. Verify your package on npm

That's it. No manual import rewrites, no separate published deps to maintain.

## Prerequisites

Before you start, you need:

- **Node.js 20+** installed
- **npm account** configured locally (`npm login` done)
- **A monorepo** with npm, yarn, or pnpm workspaces
- **Target package** has a valid entry point (a `main` or `exports` field in `package.json`)

Monocrate handles internal dependencies automatically. You don't need them published yet.

## Installation

Install monocrate globally so you can use it from anywhere:

```bash
$ npm install -g monocrate
```

Verify it works:

```bash
$ monocrate --version
0.2.0
```

If that fails, check that `npm` added `.npm` packages to your PATH. Reinstall if needed.

## Your First Publish

Let's say your monorepo looks like this:

```
my-monorepo/
  package.json                 ← has "workspaces": ["packages/*"]
  packages/
    utils/
      package.json             ← name: "@myorg/utils"
      dist/
        index.js               ← export const format = () => ...
        index.d.ts
    cli/
      package.json             ← name: "@myorg/cli"
      dist/
        index.js               ← import { format } from '@myorg/utils'
        index.d.ts
```

You want to publish `@myorg/cli`. It depends on `@myorg/utils`, which isn't published yet.

### Step 1: Preview the Output

Run `monocrate prepare` to see what would be published without actually publishing:

```bash
$ cd my-monorepo
$ monocrate prepare packages/cli
```

You'll see output like:

```
preparing @myorg/cli...
resolved version: 1.0.0
output written to: /tmp/monocrate-abc123/cli
```

That temp directory is your published package. Let's look inside:

```
/tmp/monocrate-abc123/cli/
  package.json                 ← merged version, no workspaces, no devDeps
  dist/
    index.js                   ← imports rewritten
    index.d.ts
  deps/
    packages/
      utils/
        dist/
          index.js             ← imports rewritten
          index.d.ts
```

### Step 2: Verify the Import Rewrites

This is the magic part. Open `/tmp/monocrate-abc123/cli/dist/index.js`:

**Before (source):**
```javascript
import { format } from '@myorg/utils';
```

**After (in prepared output):**
```javascript
import { format } from '../deps/packages/utils/dist/index.js';
```

Same for types in `index.d.ts`. Monocrate rewrote the import from the package name to a relative path. Now the package is self-contained—no external deps needed.

Check `deps/packages/utils/dist/index.js` too. Any imports it had are also rewritten.

The `package.json` merged all third-party dependencies from both `cli` and `utils`, removed internal refs, and dropped `devDependencies`.

### Step 3: Publish to npm

Ready? Publish with a version bump:

```bash
$ monocrate publish packages/cli --bump patch
```

Output:

```
publishing @myorg/cli...
resolved version: 1.0.1
published to npm!
```

That's it. Your package is live on npm. The entire dependency tree (cli + utils) is self-contained in the tarball.

### Step 4: Verify on npm

Check that it's really there:

```bash
$ npm view @myorg/cli

@myorg/cli@1.0.1

published a few seconds ago
```

Install it in a test project and verify types work:

```bash
$ npm install @myorg/cli
```

TypeScript will find the `.d.ts` files automatically. You can import and use it like any other npm package.

## Version Bumping

By default, `--bump` bumps the patch version. Other options:

```bash
# Bump minor
monocrate publish packages/cli --bump minor

# Bump major
monocrate publish packages/cli --bump major

# Set exact version
monocrate publish packages/cli --bump 2.0.0
```

## Publishing Multiple Packages

Need to publish several packages with synchronized versions?

```bash
monocrate publish packages/cli packages/sdk --bump minor
```

Both will get the same new version.

## Choosing Between `prepare` and `publish`

- **`monocrate prepare`** — assemble the package to a directory (usually temp) but don't publish. Use this to inspect the output before committing.
- **`monocrate publish`** — assemble and immediately publish to npm. Use this for CI/CD or when you're confident.

## Outputs to Inspect

After `monocrate prepare`, inspect these to make sure everything looks right:

1. **`package.json`** — should list only third-party deps, not internal ones
2. **`dist/`** — should have compiled JavaScript and TypeScript declarations
3. **`deps/`** — should have all in-repo dependencies with rewritten imports

Use `cat` or an editor to check file contents. If imports don't look right, stop and debug before publishing.

## Troubleshooting

**"Monorepo root not found"**

Monocrate looks for a `package.json` with `workspaces` at the repo root. Make sure you're in a monorepo directory or pass `--root`:

```bash
monocrate prepare packages/cli --root /path/to/monorepo
```

**"Package not found in workspaces"**

Check that the path you passed matches a workspace in your root `package.json`. Paths are relative to the monorepo root.

**"Missing main or exports field"**

Each package needs a valid entry point. Add to your `package.json`:

```json
{
  "main": "dist/index.js",
  "types": "dist/index.d.ts"
}
```

**"npm login required"**

Run `npm login` and enter your npm credentials. Check your `.npmrc` file if you use a token instead.

## Next Steps

- Read the [full API documentation](../README.md#options) for all flags and examples
- Learn about [--mirror-to](../README.md#examples) to auto-sync sources to a public repository
- Check the [architecture spec](./copy-based-assembly-spec.md) if you're curious how import rewriting works
- Set up a GitHub Actions workflow to publish on every release

## Common Patterns

**Publish on git tag:**
```bash
# In your CI workflow
if [ "$GITHUB_REF_TYPE" = "tag" ]; then
  monocrate publish packages/cli --bump "$GITHUB_REF_NAME"
fi
```

**Output to a specific directory for inspection:**
```bash
monocrate prepare packages/cli --output-dir ./publish-staging
```

**Mirror sources to your public repo at the same time:**
```bash
monocrate publish packages/sdk --mirror-to ../public-sdk/packages
```

---

Done? Your package is on npm. Questions? Open an issue on [GitHub](https://github.com/imaman/monocrate).
