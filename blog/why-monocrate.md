# The Monorepo Publishing Problem Nobody Talks About

I've published packages from monorepos five different ways. They all sucked in unique ways.

You know the scenario. You have a monorepo with 10 packages. One of them is a CLI tool you want to publish to npm. Simple, right? You run `npm publish` from the package directory and...

```
npm ERR! code E404
npm ERR! 404 Not Found - GET https://registry.npmjs.org/@myorg%2futils - Not found
npm ERR! 404 '@myorg/utils@^1.2.0' is not in this registry.
```

Your CLI depends on `@myorg/utils`, which is another package in your monorepo. npm has no idea what that is. It's not published. It's just sitting there in `packages/utils`, two directories over.

This isn't a new problem. But after three years of dealing with it, watching teams waste days on workarounds, I finally understand why the existing solutions are all terrible. And why we needed to build something different.

## Why Existing Solutions Don't Work

Every solution to this problem trades one kind of pain for another. Let me walk you through what we tried.

### Option 1: Publish Everything

The obvious answer: just publish all your internal packages. If `@myorg/utils` isn't on npm, put it there.

This sounds fine until you actually do it.

Now you have 10 packages to maintain. Every time you change `core`, you bump its version, publish it, then bump the version in `utils` that depends on it, publish that, then bump the version in your CLI, publish that. You're managing a cascade of version updates across 10 packages for what should be a single release.

Your team's npm namespace fills with packages nobody asked for. `@myorg/internal-validation-helpers`. `@myorg/config-utils`. `@myorg/really-just-three-functions`. These aren't products. They're implementation details. But now they're out there, with public docs expectations, semantic versioning commitments, and npm's rate limits breathing down your neck.

And here's the kicker: you still need to coordinate versions. If you publish `core@2.0.0` with breaking changes, every package that depends on it breaks. Unless you carefully orchestrate the release of all 10 packages simultaneously. Which you will get wrong. Ask me how I know.

### Option 2: Bundle Everything

Bundlers are great. webpack, esbuild, rollup—they're phenomenal tools that solve real problems. For applications.

But when you bundle a library, you're compiling away the module structure that makes Node.js packages work.

Here's what happens. You run `webpack` on your CLI package. It sees `import { validate } from '@myorg/utils'`, follows the dependency, and inlines everything into `bundle.js`. Beautiful. Self-contained. One file.

Then a user installs your package and gets an error:

```javascript
Error: Cannot find module './deps/config'
    at bundle.js:1523
    at Object.<anonymous> (bundle.js:1523)
```

You open `bundle.js` to debug. 40,000 lines of minified code. Your careful module structure is gone. All your code, your dependencies' code, and three versions of `lodash` are blended into a smoothie. The stack trace says line 1523. That could be anywhere.

Type declarations are worse. TypeScript's `tsc` doesn't bundle `.d.ts` files the way bundlers handle JavaScript. So you either generate types from the bundled output (good luck), manually maintain a separate type definition (nobody does this right), or ship a disconnected `.d.ts` file that references modules that don't exist anymore.

Tree-shaking breaks too. You bundle everything into one file, users import your package, and their bundler sees an opaque JavaScript blob. It can't tree-shake individual functions anymore. They wanted one utility function. They got 500KB.

Bundlers are amazing for what they do. But when webpack gives you `bundle.js:1523` in your stack trace, you're debugging minified code at 2 AM.

### Option 3: Manual Copying

After bundling frustrated us enough, someone suggested, "Why don't we just copy the files?"

So I did. I spent 20 minutes carefully copying files from `packages/utils` into `packages/cli/deps/utils`. Then I went through every import statement in the CLI:

```javascript
// Before
import { validate } from '@myorg/utils'

// After
import { validate } from './deps/utils/dist/index.js'
```

Updated 47 imports. Tested locally. Looked good. Pushed to CI. Published to npm.

Three hours later, production broke. I'd forgotten to update three imports buried in files I didn't test. The package passed local testing because Node's module resolution found `@myorg/utils` through the workspace. But on npm, without the monorepo workspace, those imports failed.

Manual copying works until you forget one import and your package breaks in production. Then you spend three hours finding which of 47 imports you missed.

This doesn't scale. Every release means manually copying files, updating imports, and praying you didn't miss anything. It's not sustainable.

### Option 4: Monorepo Tools

What about Lerna, Nx, Turborepo? These are great tools. We use them. But they solve a different problem.

Monorepo orchestration tools help you build, test, and publish multiple packages. They're fantastic at understanding your dependency graph, running tasks in the right order, and coordinating releases.

But they don't solve the packaging problem. Lerna will happily publish 10 packages to npm for you. In the right order. With synchronized versions. But it's still publishing 10 packages. It doesn't help you publish a single self-contained package that includes its internal dependencies.

These tools are orchestrators, not packagers. They help you manage multiple packages. They don't help you collapse multiple packages into one.

## What We Actually Need

After trying everything, the requirements became clear:

1. **Self-contained output** — One package with everything it needs, nothing pointing at unpublished dependencies
2. **Preserved module structure** — Not a bundle. Individual files stay individual files. Tree-shaking works.
3. **Automated import rewriting** — No manual find-and-replace. The tool figures out which imports need to change.
4. **Type declarations included** — `.d.ts` files work without extra configuration
5. **One command** — No multi-step process. No configuration files. Point at a package, done.

The core insight: we don't need a bundler. We need an intelligent file copier.

## Enter Monocrate

Monocrate takes a different approach. Instead of bundling everything into one file or forcing you to publish everything as separate packages, it assembles a single publishable package by copying files and rewriting imports.

Here's the philosophy: **smart file copy, not a bundler**.

The process:

1. **Discover packages** — Monocrate reads your workspace configuration (npm, yarn, or pnpm workspaces) and builds a map of every package in your monorepo.

2. **Build dependency graph** — Starting from your target package, it traces every internal dependency. If your CLI depends on `utils` which depends on `core`, Monocrate finds all three.

3. **Copy publishable files** — For each package, Monocrate runs `npm pack` to determine which files would be published, then copies only those files to the output directory. No source files. No tests. Just what would ship.

4. **Rewrite imports** — This is the critical step. Monocrate parses every `.js` and `.d.ts` file, finds imports of internal packages, and rewrites them to relative paths:

   ```javascript
   // Before (in your monorepo)
   import { validate } from '@myorg/utils'

   // After (in published package)
   import { validate } from './deps/packages/utils/dist/index.js'
   ```

   It handles static imports, re-exports, and dynamic `import()` calls. It uses each package's `exports` field (or `main` field) to resolve the correct entry point.

5. **Merge dependencies** — Monocrate generates a `package.json` that combines all third-party dependencies from your target package and its internal dependencies. Internal references are removed. External dependencies are preserved.

The output structure looks like this:

```
output/
  package.json       ← merged deps, internal refs removed
  src/
    cli.js           ← your CLI's files
    commands.js
  deps/
    packages/
      utils/
        dist/
          index.js   ← utils' publishable files, imports rewritten
          helpers.js
      core/
        dist/
          index.js   ← core's publishable files, imports rewritten
```

Entry points work unchanged because each package's file structure stays in the same relative position. If `utils` exports from `dist/index.js`, that path is preserved. Your published package's `exports` field points to the same paths. Tools that import your package follow the same resolution logic.

### What It Doesn't Do

Monocrate makes specific trade-offs. It's important to be clear about what it doesn't do.

**It doesn't optimize your code.** No minification, no dead code elimination, no fancy bundler tricks. It copies files as-is. If you want optimization, run your bundler first, then use Monocrate to assemble the output.

**It doesn't handle circular dependencies well.** If package A depends on B which depends on A, Monocrate will copy both, but you'll have a weird package structure. Fix your circular dependencies first.

**It doesn't work with non-standard module systems.** If your packages use something other than standard ES modules or CommonJS with proper `exports`/`main` fields, you're on your own.

**It doesn't publish multiple packages separately.** If you genuinely need to publish 10 separate packages, use Lerna or changesets. Monocrate is for collapsing multiple internal packages into one.

These aren't bugs. They're design decisions. Monocrate does one thing: make a self-contained package from a monorepo package with internal dependencies.

### When to Use It

Use Monocrate when:

- You have a monorepo with multiple packages
- One or more packages are meant to be published
- Those packages depend on other packages in the monorepo
- Those dependencies are internal—you don't want to publish them separately
- You want to preserve module structure, not bundle everything into one file

Don't use Monocrate when:

- You're already publishing all your packages separately and that's working fine
- You want to bundle everything into a single file (use webpack/esbuild/rollup)
- Your package has no internal dependencies
- You need advanced bundler features like code splitting or chunk optimization

## Real-World Impact

After switching to Monocrate, here's what changed:

**Time saved**: Publishing went from a 20-minute careful process to a 5-second command:

```bash
monocrate publish packages/cli --bump patch
```

**Reduced errors**: No more forgotten imports. No more manual copying. The tool handles it.

**Better debugging**: When users report errors, the stack traces reference actual file names and line numbers. `deps/packages/utils/dist/helpers.js:42` tells you exactly where to look. Not `bundle.js:1523`.

**Actual module structure**: Published packages have the same file structure as the source. Tree-shaking works. Type declarations work. `exports` field works.

The most surprising benefit: we stopped worrying about internal package boundaries. Before, we'd hesitate to split code into separate packages because publishing would be painful. Now we split things freely. If it makes sense architecturally, do it. Monocrate handles the packaging.

## Try It

If you've struggled with any of this, try Monocrate:

```bash
npm install -g monocrate
monocrate publish packages/your-package --bump patch
```

It's open source. MIT licensed. One command. No configuration.

The monorepo publishing problem isn't going away. But it doesn't have to suck.

---

## Distribution Notes

**Where to post:**
- **Dev.to**: Great audience of working developers who've hit this problem
- **Personal blog**: If you have an engineering blog, this fits perfectly
- **Hacker News**: Submit as "Show HN: Monocrate – From monorepo to npm in one command" with a link to the GitHub repo
- **Reddit**: r/javascript, r/node, r/typescript would all appreciate this
- **Twitter/X**: Thread the key points with code examples
- **LinkedIn**: Engineers and tech leads are actively looking for solutions to this

**Suggested title variations:**
- "I Tried 5 Ways to Publish from a Monorepo. They All Sucked. So I Built Monocrate."
- "The Monorepo Publishing Problem Nobody Talks About (And How We Solved It)"
- "Why Bundlers Don't Work for Library Publishing (And What Does)"

**Call to action:**
Link to the GitHub repo, invite feedback, and ask readers to share their own monorepo publishing horror stories in the comments.
