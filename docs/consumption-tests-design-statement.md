# Consumption Tests Design Statement

## Overview

Consumption tests are lightweight, artifact-level verification scripts that run immediately after `monocrate prepare` to confirm a packaged output would actually work when installed from a registry. They are not end-to-end integration tests—they are targeted smoke tests that detect real packaging failures before they reach npm: missing files from the `files` field, incorrect `exports` configuration, missing type definitions that should have been built and included, and third-party dependency version conflicts.

When you configure your package—specifying `exports`, `files`, `main`, and `types` fields—you're making a contract: "when users install this from npm, they can import these entry points and it will work." But you have no automated way to verify that contract before publishing. After running `monocrate prepare` to assemble your output, you're left with manual inspection or worse: discovering configuration mistakes after publishing to npm, at which point the cost of fixing it is high—republish under a new version, pollute version history, erode user trust. Consumption tests bridge this gap by letting you run automated checks on the prepared artifact before it ever reaches a registry, catching missing files, incorrect `exports` paths, and broken type definitions while you can still fix them locally.

Consumption tests plug this gap. They live in the package alongside the source code, they're written in plain JavaScript/TypeScript, they run in seconds, and they can be executed before `monocrate publish` runs. They're a built-in safeguard against user configuration mistakes that unit tests can't catch: exports pointing to non-existent files, incorrect entry points in package.json, and missing type definitions because the `files` field didn't include all built artifacts.

## Key Design Decisions

### 1. Test Format: Plain Node.js Scripts, Not Test Frameworks

**Decision:** Write tests as executable Node.js files (`.consumption-test.js`, `.consumption-test.mjs`, `.consumption-test.ts`), invoked with `node test.js`. Exit code 0 = pass, non-zero = fail.

**Rationale:** Monocrate's philosophy is "don't be clever"—rely on battle-tested tools and avoid heavyweight dependencies for their own sake. Jest, Vitest, and similar test frameworks add cognitive overhead, require configuration, and introduce their own failure modes. A consumption test is fundamentally a smoke test; it just needs to verify the package can be installed and imported. Plain Node.js scripts get closer to real-world usage: when users install your package, they run `node index.js`, not a test framework. Exit code semantics are universal and understood by every CI/CD system. Early returns and thrown errors are self-documenting—no assertion library needed.

### 2. Test Variants by File Extension Convention

**Decision:** Use filename patterns to signal test type and module system:
- `*.consumption-test.js` — CommonJS runtime tests
- `*.consumption-test.mjs` — ESM runtime tests
- `*.consumption-test.ts` — TypeScript compilation tests (type checking only, no execution)

**Rationale:** Following the established pattern from `*.compilation-test.ts`. The extension is self-documenting: it tells you both what kind of test it is AND which module system to use. This avoids configuration entirely—the file extension IS the configuration. It's glob-friendly (easy to filter from package.json `files` field) and plays nicely with Node's module resolution: a `.mjs` file is always ESM, a `.cjs` is always CommonJS, a `.ts` file's handling depends on your tsconfig. Developers instantly understand that they need separate test files for CJS vs ESM because of Node's fundamental constraint: a single `package.json` declares one module system for the entire project.

### 3. Isolation: Temp Directory with Registry Override

**Decision:** Each consumption test runs in a fresh, isolated temp directory. The test calls `npm install <package>@<version> --registry=<verdaccio-url>` to fetch the prepared package, then executes within that directory.

**Rationale:** Isolation guarantees correctness. By installing to a clean directory using the registry, there's zero ambiguity about which package code is being tested—it's exactly what would be shipped to users. If the prepared package has a broken `exports` field, if npm pack didn't include a file, or if an import rewrite is malformed, `npm install` or the subsequent `node test.js` will fail with a clear error message. Reusing verdaccio (already integrated into monocrate's test infrastructure) means no new external dependencies. Isolation also prevents the test harness from accidentally shipping test files—they live in a temp directory and are never included in the published package.

### 4. Module System Coverage: One Test Script Per Module System

**Decision:** Cannot test multiple module systems in a single test file. If a package exports both CJS and ESM, it needs separate `.consumption-test.cjs` and `.consumption-test.mjs` scripts.

**Rationale:** Node.js treats module system as a compile-time property (determined by `package.json`'s `type` field), not a runtime parameter. Trying to test both systems in a single file would require workarounds like eval(), dynamic require/import tricks, or spawning child processes—all of which obscure intent and create maintenance headaches. Explicit is better than clever. Developers who export both CJS and ESM understand they have two separate concerns; forcing them into one test file makes the relationship less clear. This matches reality: users of the package will use one or the other, not both simultaneously.

### 5. Configuration: package.json Field with Convention-Based Discovery

**Decision:** Optional `"monocrate.consumptionTests"` field in package.json points to a directory:
```json
{
  "monocrate": {
    "consumptionTests": "consumption-tests/"
  }
}
```
If the field is missing, monocrate auto-detects and defaults to checking if a `consumption-tests/` directory exists.

**Rationale:** Minimal configuration surfaces intent without forcing developers to opt-in explicitly. Convention-based discovery (checking for `consumption-tests/` directory) means most packages just work without any configuration. The optional field is an escape hatch: if a package doesn't want consumption tests, they don't create the directory or can explicitly set the field to `null`. This keeps configuration surface area small while remaining discoverable.

### 6. Error Reporting: Identify the Broken Import, Not Just "Test Failed"

**Decision:** When a consumption test fails, the error message must identify: (a) which import statement failed, (b) which file was missing or unreachable, and (c) which package in the dependency closure is responsible.

**Rationale:** Monocrate's philosophy is "fail early and loud." Developers need to fix the root cause, not debug the test harness. If a consumption test throws `Error: Cannot find module './deps/packages/utils/dist/api.js'`, that tells the developer exactly which file is missing and which import path triggered it. They can then check if `api.js` was supposed to be in the `exports` field, if they forgot to list it in the `files` field, or if their package.json export paths are incorrect. Vague errors ("test failed") or stack traces that require reading test internals force developers to instrument the code or add logging—wasting time that could be spent fixing the actual issue.

## How It Works

### The Developer Experience

Suppose you've prepared a package with `monocrate prepare packages/my-app`. The output directory contains the assembled files, and you want to verify it works before publishing.

You create a file `packages/my-app/consumption-tests/esm.consumption-test.mjs`:

```javascript
// packages/my-app/consumption-tests/esm.consumption-test.mjs
import { MyClass, helperFunction } from 'my-app'

// Verify the public API is importable
if (typeof MyClass !== 'function') {
  throw new Error('Expected MyClass to be a function, got ' + typeof MyClass)
}

// Verify it's executable
const instance = new MyClass()
if (!instance.getValue()) {
  throw new Error('MyClass instance has no getValue() method')
}

// Verify helper functions work
const result = helperFunction(42)
if (result !== 'expected-result') {
  throw new Error(`helperFunction(42) returned '${result}', expected 'expected-result'`)
}

console.log('ESM consumption test passed')
```

If the package also exports CommonJS, you'd add `packages/my-app/consumption-tests/cjs.consumption-test.cjs`:

```javascript
// packages/my-app/consumption-tests/cjs.consumption-test.cjs
const { MyClass, helperFunction } = require('my-app')

if (typeof MyClass !== 'function') {
  throw new Error('Expected MyClass to be a function')
}

const instance = new MyClass()
if (!instance.getValue()) {
  throw new Error('MyClass instance has no getValue() method')
}

console.log('CJS consumption test passed')
```

For TypeScript packages, you'd add `packages/my-app/consumption-tests/types.consumption-test.ts`:

```typescript
// packages/my-app/consumption-tests/types.consumption-test.ts
// This file is never executed, only type-checked
import { MyClass, helperFunction } from 'my-app'

const instance: MyClass = new MyClass()
const value: string = instance.getValue()
const result: string = helperFunction(42)
```

When monocrate prepares the package, it discovers these test files. During CI or before publishing, it:

1. Creates a temp directory
2. Installs the prepared package via verdaccio: `npm install my-app@X.Y.Z --registry=http://localhost:4873`
3. Runs each test script: `node esm.consumption-test.mjs`, `node cjs.consumption-test.cjs`
4. Type-checks the `.ts` file (if TypeScript is present)
5. If any test fails (non-zero exit code or thrown error), monocrate stops and reports the failure with the original error message

If the imports in the `.js` files don't match the `.d.ts` files—say, you configured `.d.ts` to export from a path that doesn't exist in the assembled output—the type checking step catches it. If the `exports` field points to a file you forgot to include in the `files` field, the import in the consumption test will fail with "Cannot find module". If a dependency version conflict slipped through and you wrote test code that exercises it, the runtime test will fail.

## Success Criteria

1. **Catch real export config issues before publishing.** Consumption tests must detect when a package's `exports` field points to non-existent files after assembly. Success means if you configured `exports` to point to `'./dist/api.js'` but forgot to include it in the `files` field, the consumption test fails with a clear error message identifying the missing file and which import triggered it.

2. **Verify the published artifact is installable and executable.** Consumption tests must install the prepared package from verdaccio, import its entry points, and execute basic functionality. Success means if a package exports a function `foo()`, the consumption test can `import { foo } from 'package-name'` and call it. Failure to import or execute indicates broken package.json entry points, missing files, or runtime import errors.

3. **Fast enough to run on every CI build.** Consumption tests must complete in under 30 seconds for a typical package with 2–3 internal dependencies. If they take longer than monocrate's assembly step, developers will disable them. Success means tests fit within existing CI time budgets and don't become a bottleneck.

4. **Detect third-party dependency mismatches.** When monocrate merges dependencies from multiple internal packages, consumption tests must catch version conflicts that slip through (e.g., package A needs `lodash@4.17.0`, package B needs `lodash@4.17.21`, monocrate picks one, and the other breaks). Success means the consumption test installs all third-party deps and exercises code paths that use them, catching runtime failures that static analysis misses.

5. **Fail with actionable error messages.** When a consumption test fails, the output must identify which import failed, which file was missing, and which package in the dependency closure caused the issue. Success means developers can fix the root cause (missing export configuration, incorrect `files` field in package.json, wrong paths in the `exports` field) without debugging the test harness itself.

## Open Questions for the Spec

1. **TypeScript type-checking strategy:** How exactly do we run TypeScript type-checking on `*.consumption-test.ts` files? Do we require `tsconfig.json` in the temp directory? Do we run `tsc --noEmit` on each test file, or do we use a different approach? Should type errors fail the build or just warn?

2. **Third-party dependency pinning:** When a consumption test imports and uses a third-party dependency, should the test verify the dependency is the exact version specified in package.json, or is checking that the code runs sufficient? (This matters for detecting silent version conflicts.)

3. **Monorepo root discovery for test execution:** When running consumption tests, how do we discover which packages have tests? Do we scan the entire monorepo for `consumption-tests/` directories, or do we only run tests for packages that were explicitly prepared/published?

4. **Timeout and failure reporting:** Should there be a global timeout for all consumption tests? If one test times out or throws an uncaught error, should the runner report which test failed, or just "consumption tests failed"? Should stderr from the test be captured and reported to the developer?

5. **Skipping tests conditionally:** Some packages might support only certain module systems (ESM-only, CJS-only). Should we support a convention like `*.skip` to mark certain test files as optional? Or should missing test variants simply be treated as a non-error?
