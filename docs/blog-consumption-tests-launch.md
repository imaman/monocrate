# Catch Packaging Bugs Before npm Publish

Your package builds. Unit tests pass. `npm pack` succeeds. You publish to npm. Then someone installs it and immediately hits `Cannot find module '@myorg/utils'` because you forgot to rewrite an internal import. Or their TypeScript build fails because your `exports` field points to a nonexistent `.d.ts` file.

These bugs don't show up in your monorepo. They only surface after the package is on npm, installed as a real dependency. By then you've published a broken version, your users are blocked, and you're scrambling to push a patch.

Monocrate now catches these before they reach npm. Define **consumption tests** in your package—simple scripts that verify the published artifact actually works. They run automatically after publishing to Verdaccio (local staging registry) but before publishing to npm. If the tests fail, the publish aborts.

## What Are Consumption Tests?

Plain JavaScript or TypeScript files that import your package and verify it's usable. No test runner required.

**Runtime test** (`consumption-tests/runtime.js`):
```javascript
import { processData } from '@myorg/my-app'

const result = processData({ input: 'test' })
if (result.status !== 'success') {
  throw new Error('processData returned unexpected status')
}

console.log('Runtime test passed')
```

Monocrate installs your package from Verdaccio into a temp directory and runs `node runtime.js`. Exit code 0 = pass. Anything else = fail and abort publish.

**Compilation test** (`consumption-tests/types.ts`):
```typescript
import { processData, ProcessOptions } from '@myorg/my-app'

const options: ProcessOptions = {
  input: 'test',
  timeout: 5000
}

const result = processData(options)
const status: string = result.status

// This file doesn't run—it just needs to typecheck
```

Monocrate runs `tsc --noEmit` on the file. TypeScript errors = test fails, publish aborts.

## How It Works

When you run `monocrate publish packages/my-app --bump patch`:

1. Package is assembled and published to Verdaccio (local registry)
2. Consumption tests run against the Verdaccio version
3. Tests pass → publish to npm
4. Tests fail → abort, show error, never reach npm

Verdaccio acts as a staging area. You get one last verification that the package structure is correct before it goes live.

## What This Catches

**Import rewrites**: Forgot to convert `@myorg/utils` to a relative path? The runtime test imports your package and immediately fails.

**Export paths**: `exports` field points to `./dist/index.js` but the file is at `./lib/index.js`? Test fails.

**Missing type declarations**: TypeScript can't find `.d.ts` files? Compilation test fails.

**Subpath exports**: `@myorg/my-app/utils` should work but doesn't? Write a test that imports it.

These are packaging bugs, not logic bugs. Your unit tests won't catch them because they run inside your monorepo where imports resolve differently.

## When to Use This

Add consumption tests to packages you publish to npm, especially if:
- The package has multiple entry points via `exports` field
- It depends on other packages in your monorepo (imports get rewritten)
- It ships TypeScript types
- You've published broken packages before

Skip them for:
- Private packages that won't be published
- Simple packages with a single entry point and no dependencies

## Getting Started

Create a `consumption-tests/` directory in your package:

```
packages/my-app/
  src/
  dist/
  consumption-tests/
    runtime.js
    types.ts
  package.json
```

Add test files. That's it. Monocrate discovers them automatically—no config needed. The next time you run `monocrate publish`, the tests run before npm publish.

If a test fails, you'll see the error and the publish stops. Fix the issue, publish again, and this time it succeeds.

Full details: [consumption-tests-faq.md](./consumption-tests-faq.md)
