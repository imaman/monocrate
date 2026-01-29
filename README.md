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

Now publish it:

```bash
npx monocrate publish packages/my-app
```

That's it. Your package is live on npm. Users can `npm install @myorg/my-app` and it just works—all entry points kept, sourcemaps and TypeScript types correctly resolve, and if you ever want to bundle it into an application it will be very tree-shaking friendly. By default this publishes with a `minor` increment; you can pick your own via `--bump`.

**Want to inspect before publishing?** Use `prepare` instead:

```bash
npx monocrate prepare packages/my-app --output-dir ./dist
cd dist
npm publish
```

## How It Works

**Graph traversal**: Walks your package's `dependencies` (not `devDependencies`) to find every internal package in the closure.

**File extraction**: Uses `npm pack` to determine publishable files (respects `.npmignore`, `files` field). Copies them to `deps/` preserving each package's structure.

**Import rewriting**: The critical piece. Your code has `import { foo } from '@myorg/utils'`. After extraction, that needs to become `import { foo } from './deps/packages/utils/dist/index.js'`. Regex can't handle this—you need TypeScript's module resolution, `exports` maps, subpath imports. Monocrate uses `ts-morph` to parse files as ASTs, resolve imports using the same algorithm TypeScript uses, and rewrite specifiers in both `.js` and `.d.ts` files.

**Standard output**: The result is a normal npm package. No custom runtime, no special install steps. Tree-shaking works because modules aren't concatenated. TypeScript types resolve because paths aren't flattened. Stack traces point to real files because structure is preserved.

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
