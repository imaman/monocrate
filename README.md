# monocrate

## The Problem

You try to publish a package from your monorepo:

```
npm ERR! code EUNSUPPORTEDPROTOCOL
npm ERR! Unsupported URL Type "workspace:": workspace:*
```

Your code imports from other packages in the same monorepo:

```typescript
// packages/my-app/src/index.ts
import { validateEmail, parseDate } from '@myorg/utils'
import { ApiClient } from '@myorg/api-client'

export function processUser(email: string) {
  if (!validateEmail(email)) throw new Error('invalid email')
  return new ApiClient().createUser(email)
}
```

The `workspace:*` protocol only works inside your monorepo. When you publish to npm, consumers can't install it because `@myorg/utils` and `@myorg/api-client` don't exist on npm. You have three bad options: (1) publish all six internal packages separately and maintain them forever as public API, (2) bundle everything into one file and break tree-shaking and `.d.ts` files, or (3) manually copy files and rewrite imports until you miss one and ship broken types.

## Quickstart

You have a package you want to publish. First, build it:

```bash
npm run build  # or tsc, or whatever compiles your TypeScript
```

Now extract it with its dependencies:

```bash
npx monocrate publish packages/my-app
```

This creates an `output/` directory. Inside, you'll find:
- Your app's compiled code at the root
- Internal dependencies copied under `deps/packages/utils/` and `deps/packages/api-client/`
- All imports rewritten: `import { foo } from '@myorg/utils'` becomes `import { foo } from './deps/packages/utils/dist/index.js'`
- A merged `package.json` with third-party dependencies from the entire dependency tree

Publish it:

```bash
cd output
npm publish
```

Done. Your users can now `npm install @myorg/my-app`. It works like any npm package—tree-shaking works, TypeScript types resolve, no special runtime needed.

## How It Works

Monocrate treats publishing from a monorepo as a graph problem. When you point it at a package, it recursively walks `dependencies` (not `devDependencies`—those are build tools, not runtime requirements) to identify every internal package in the dependency closure. It determines which files each package would publish by delegating to `npm pack`, the same logic npm uses. These files get copied into an output directory under `deps/`, preserving each package's structure.

The hard part is import rewriting. Your code contains statements like `import { foo } from '@myorg/utils'`. After extraction, that import needs to point to the copied files: `import { foo } from './deps/packages/utils/dist/index.js'`. Regex fails here—you need to understand TypeScript's module resolution, handle package.json `exports` maps, resolve subpath imports like `@myorg/utils/async`, and process both `.js` and `.d.ts` files identically. Monocrate uses `ts-morph` to parse each file as an AST, locate import/export declarations, check if they reference internal packages, resolve the target path using the same algorithm TypeScript uses, compute the relative path from the importing file to the resolved target, and rewrite the import specifier.

The output is publishable using standard `npm publish`. No custom runtime, no special install steps, no lock-in. Users who install your package get a normal npm dependency with working module boundaries. If they run a bundler, tree-shaking eliminates unused code because modules aren't concatenated. If they use TypeScript, declaration files resolve correctly because paths weren't flattened. If they debug, stack traces point to real file locations because source structure is preserved.

## When NOT to Use This

**Don't use monocrate if:**

- You want to publish every package in your monorepo separately (use Changesets or Lerna—they manage multi-package versioning and changelogs)
- Your packages have circular dependencies (no tool can extract that—refactor your dependency graph first)
- You need a single bundled output file (use esbuild or Rollup—monocrate preserves module structure, doesn't bundle)
- You're deploying to a runtime that supports workspace protocol natively (just deploy—no extraction needed)
- Your internal packages have different license terms (publishing them together as one package is legally unclear—consult a lawyer)
- You expect zero configuration (monocrate needs your packages built—run `tsc` or `esbuild` first, it won't compile for you)

**Wrong fit examples:**

- "I want semantic-release to version all my packages" → You want changesets + semantic-release, not monocrate
- "I need one minified bundle.js for browsers" → You want esbuild bundle, not monocrate
- "My package imports from `../../other-package/src/utils.ts`" → Your imports bypass package boundaries, monocrate can't rewrite raw path imports (use proper package references)
- "I want to publish to npm without running my build step" → Monocrate expects compiled output in `dist/`, not source in `src/`

## Built Because

We maintain a 110+ package monorepo. When we wanted to open-source one package, we faced publishing six dependencies or giving up. Bundling broke types. Manual copying broke on the second PR. We built monocrate to extract what we wanted to share without publishing our entire internal structure.

Read the full story: [docs/mission-statement.md](docs/mission-statement.md)

---

**License**: MIT
**Repository**: [github.com/imaman/monocrate](https://github.com/imaman/monocrate)
**Issues**: [github.com/imaman/monocrate/issues](https://github.com/imaman/monocrate/issues)
