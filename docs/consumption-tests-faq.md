# Consumption Tests FAQ

## What problem does this solve?

Your package builds fine, passes all unit tests, and `npm pack` runs successfully. You publish it to npm. Then someone tries to install it and gets `Cannot find module '@myorg/utils'` because you forgot to rewrite that import. Or TypeScript can't find type declarations because your `exports` field points to the wrong path. Or the package installs but immediately crashes on import.

Consumption tests catch these breaks before production publish. They install your package from Verdaccio (local npm registry) as if they were an end user, then verify imports actually work. If the test fails, monocrate blocks the publish.

## When do consumption tests run?

After monocrate publishes to Verdaccio but before publishing to npm. The flow is:

1. `monocrate publish packages/my-app --bump patch`
2. Package assembled and published to local Verdaccio
3. Consumption tests run (if defined)
4. Tests pass → publish to npm
5. Tests fail → abort, rollback, show error

You never see a broken package on npm because Verdaccio acts as a staging area.

## Where do consumption tests go?

Create a `consumption-tests/` directory inside your package:

```
packages/my-app/
  src/
  dist/
  consumption-tests/
    runtime.js         ← runs with node, checks exit code
    compilation.ts     ← checks TypeScript compilation
  package.json
```

Monocrate discovers these automatically. No config needed.

## How do I write a runtime test?

Create `consumption-tests/runtime.js` with code that imports and uses your package. If it exits with code 0, the test passes. Any other exit code fails the test.

```javascript
// packages/my-app/consumption-tests/runtime.js
import { processData } from '@myorg/my-app'

const result = processData({ input: 'test' })
if (result.status !== 'success') {
  throw new Error('processData returned unexpected status')
}

console.log('Runtime test passed')
```

Monocrate installs `@myorg/my-app` from Verdaccio into a temp directory, then runs `node runtime.js`. If node exits non-zero or throws, the test fails and publishing stops.

## How do I write a compilation test?

Create `consumption-tests/compilation.ts` that imports types and uses them. Monocrate runs `tsc --noEmit` on this file. If TypeScript reports errors, the test fails.

```typescript
// packages/my-app/consumption-tests/compilation.ts
import { processData, ProcessOptions } from '@myorg/my-app'

const options: ProcessOptions = {
  input: 'test',
  timeout: 5000
}

const result = processData(options)
const status: string = result.status

// This file doesn't run - it just needs to typecheck
```

This catches missing `.d.ts` files, incorrect type exports, or broken `exports` field paths that would make your package unusable for TypeScript users.

## What's the difference from unit tests?

Unit tests verify internal logic. Consumption tests verify the published package structure and exports.

**Unit test** (runs in your monorepo):
```javascript
// packages/my-app/src/processor.test.ts
import { processData } from './processor.js'

test('processData handles errors', () => {
  expect(() => processData(null)).toThrow()
})
```

**Consumption test** (runs after publish to Verdaccio):
```javascript
// packages/my-app/consumption-tests/runtime.js
import { processData } from '@myorg/my-app'  // ← uses package name, not file path

if (typeof processData !== 'function') {
  throw new Error('processData not exported')
}
```

Unit tests catch bugs in your code. Consumption tests catch bugs in your package configuration.

## Do I need jest or vitest?

No. These are plain scripts, not test runner tests.

Runtime tests are vanilla JavaScript that monocrate runs with `node`. Exit code 0 = pass, anything else = fail. Use `throw new Error()` or `process.exit(1)` to fail the test.

Compilation tests are vanilla TypeScript that never execute. They just need to satisfy `tsc --noEmit`. Use type assertions and assignments to verify types, not `expect()` calls.

## What happens if a test fails?

Monocrate shows the error and aborts before publishing to npm:

```
Publishing @myorg/my-app@1.2.3 to Verdaccio...
Running consumption tests...
✗ Runtime test failed with exit code 1:

Error: Cannot find module '@myorg/my-app/utils'
    at runtime.js:2:5

Publish aborted. Fix the issue and try again.
```

The package exists in Verdaccio temporarily for debugging, but never reaches npm. You fix the exports issue, run `monocrate publish` again, and this time it succeeds.

## Do I need this for every package?

Not required, but recommended for packages you publish to npm. Internal-only packages that never leave your monorepo don't need them.

Add consumption tests when:
- Package has complex `exports` field with multiple entry points
- Package depends on in-repo packages (imports get rewritten)
- Package provides TypeScript types (catch `.d.ts` export issues)
- You've been burned by broken publishes before

Skip them for:
- Private packages that won't be published
- Packages with single `main` entry and no dependencies
- Rapid prototyping (add later when stabilizing for release)

## Can I have multiple test files?

Yes. Name them descriptively:

```
consumption-tests/
  basic-import.js          ← verifies main export works
  subpath-imports.js       ← verifies exports["./utils"] works
  async-operations.js      ← verifies async APIs work
  typescript-types.ts      ← verifies types compile
```

Monocrate runs all `.js` files as runtime tests and all `.ts` files as compilation tests. All must pass for publish to proceed.

## How do I test subpath exports?

Import them directly:

```javascript
// consumption-tests/subpath-imports.js
import { helper } from '@myorg/my-app/utils'
import { config } from '@myorg/my-app/config'

if (typeof helper !== 'function') {
  throw new Error('utils subpath export broken')
}

if (!config.version) {
  throw new Error('config subpath export broken')
}
```

This catches `exports` field mistakes like pointing `"./utils"` to a non-existent file or forgetting to include the file in your package output.

## Can I install additional dependencies in tests?

No. Tests only have access to your published package and its dependencies. This is intentional—it mirrors what real users experience.

If your test needs a testing library, it means you're writing the wrong kind of test. Consumption tests verify package structure, not business logic. Use unit tests for logic that requires assertions libraries.

## How long should tests take?

Seconds. These run on every publish, so keep them fast.

Good runtime test: Import package, call a function, check result. 100ms.

Bad runtime test: Start a server, make HTTP requests, query database. 30 seconds.

Save integration tests for CI. Consumption tests verify the package is importable and usable, not that all features work correctly.
