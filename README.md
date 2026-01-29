# monocrate

## Why?

You built something useful in your monorepo. Maybe it's a data validation library that elegantly handles edge cases, or an API client that gracefully retries and caches. You want to share it—open-source it, let others benefit from the work you put in.

But it depends on other packages in your monorepo:

```typescript
// packages/data-validator/src/index.ts
import { parseSchema, SchemaType } from '@myorg/schema-parser'
import { formatError } from '@myorg/error-formatter'
import { memoize } from '@myorg/utils'

export function validate(data: unknown, schema: SchemaType) {
  const parsed = parseSchema(schema)
  const validator = memoize((d) => parsed.check(d))
  if (!validator(data)) {
    throw formatError(parsed.errors)
  }
}
```

When you try `npm publish`, it fails—the `workspace:*` protocol only works inside your monorepo. Consumers can't install it because `@myorg/schema-parser`, `@myorg/error-formatter`, and `@myorg/utils` don't exist on npm.

So now what? Your options aren't great:

- 😵 Publish all the internal packages separately—now you're maintaining six npm packages forever, and your internal implementation details became public API
- 🤦 Bundle everything into one file with esbuild—breaks tree-shaking, mangles TypeScript types, flattens your carefully structured modules
- 🤕 Manually copy files and rewrite imports yourself—works once, breaks on the second PR when someone forgets a step

**Monocrate solves this.** One command, super simple, and you'll have your package on npm in no time.

## Quickstart

First, build your package:

```bash
npm run build  # or tsc, or whatever compiles your TypeScript
```

Now publish it:

```bash
npx monocrate publish packages/data-validator
```

That's it. Your package is live on npm. Users can `npm install @myorg/data-validator` and it just works—all entry points kept, sourcemaps and TypeScript types correctly resolve, and if you ever want to bundle it into an application it will be very tree-shaking friendly. By default this publishes with a `minor` increment.

**Need a different version bump?** Use the `--bump` option:

```bash
npx monocrate publish packages/data-validator --bump patch   # 1.2.3 → 1.2.4
npx monocrate publish packages/data-validator --bump 2.0.0   # Exact version
```

**Want to inspect before publishing?** Use `prepare` instead:

```bash
npx monocrate prepare packages/data-validator --output-dir ./dist
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
