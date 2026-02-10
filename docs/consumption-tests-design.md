# Consumption Tests Design Statement

## Purpose

Consumption tests verify that an assembled package is correctly structured and consumable before publishing to npm. They run after Verdaccio publish but before npm publish, catching configuration mistakes (broken exports, missing type declarations, incorrect import rewrites) that unit tests cannot detect.

## Key Design Decisions

### No Test Runner Framework

Consumption tests are plain scripts, not jest/vitest tests. Runtime tests are vanilla JavaScript executed with `node` - exit code 0 means pass, non-zero means fail. Compilation tests are vanilla TypeScript that never execute - they must satisfy `tsc --noEmit`.

**Rationale**: These tests verify package structure and publishability, not business logic. Adding jest/vitest would:
- Require installing a test framework in an isolated temp directory where the package is consumed
- Introduce dependency version conflicts (what if the package itself depends on a different vitest version?)
- Add conceptual overhead - developers would need to distinguish "unit tests" from "consumption tests" from "consumption tests that look like unit tests but run differently"
- Violate the isolation principle - consumption tests should only access what real users access

The exit code contract is trivial to implement: `throw new Error()` or `process.exit(1)` fails the test. TypeScript compilation tests need zero runtime code - type assertions alone verify correctness.

### consumption-tests/ Directory Location

Tests live at `packages/my-app/consumption-tests/` alongside `src/` and `dist/`. Monocrate discovers them by checking if this directory exists in the package being published.

**Rationale**: Other locations considered:
- `src/consumption-tests/` - Would get compiled to `dist/` and published, bloating the package
- `test/consumption/` or `__tests__/consumption/` - Conflicts with existing test conventions and tooling that may already use these directories
- `.monocrate/consumption-tests/` - Hidden directory creates discovery issues and violates principle of least surprise
- Root-level `consumption-tests/` - In multi-package monorepos, unclear which tests belong to which package

The chosen location makes ownership clear (tests belong to the package), keeps them separate from source code (won't be compiled), and follows the pattern used by other package-specific metadata (like `scripts/` or `examples/`).

### Separate Runtime and Compilation Tests

Runtime tests (`.js` files) execute with node. Compilation tests (`.ts` files) run through `tsc --noEmit` without execution. Both must pass for publish to proceed.

**Rationale**: These verify orthogonal concerns:
- Runtime tests catch import resolution failures, missing exports, crashes on module load
- Compilation tests catch missing `.d.ts` files, incorrect type exports, broken `exports` field paths for types

Many packages need only one kind. TypeScript libraries need both - runtime tests verify JavaScript works, compilation tests verify types work. Pure JavaScript packages skip compilation tests. Conflating them would force every package to set up TypeScript compilation even if they don't ship types.

### Exit Code Contract

Runtime tests must exit with code 0 to pass. Any non-zero exit code or uncaught exception fails the test. No special test runner protocol needed.

**Rationale**: Universal contract that works with any script. No need to teach users a custom API or parse test output. If the script crashes or calls `process.exit(1)`, it failed. This matches how CI systems determine success/failure.

### When Tests Run in Publish Flow

The flow is: `monocrate publish` → assemble package → publish to Verdaccio → run consumption tests → tests pass → publish to npm. If tests fail, abort before npm publish.

**Rationale**: Verdaccio acts as a staging area. The package must be truly published (not just packed) to catch issues like:
- Incorrect `.npmignore` excluding necessary files
- `exports` field pointing to files that exist locally but weren't included in the tarball
- Dependencies on in-repo packages that didn't get rewritten

Running tests before Verdaccio publish would test the wrong artifact. Running tests after npm publish would be too late - the broken package is already public.

### Test Isolation Model

Tests run in a temporary directory where monocrate runs `npm install <package>@<version>` from Verdaccio. No ability to install additional dependencies.

**Rationale**: This mirrors real-world usage. When users install your package, they get only what's in your package and its declared dependencies. If your test needs a testing library, you're testing the wrong thing - use unit tests for that. Consumption tests verify the package is importable and structurally sound, not that all features work correctly.

## Architecture

### Integration Point

Consumption tests hook into `monocrate.ts` between Verdaccio publish and npm publish. Current flow:

```typescript
// In monocrate.ts
for (const assembler of assemblers) {
  const { compiletimeMembers } = await assembler.assemble(resolvedVersion)

  if (options.publish) {
    await publish(npmClient, assembler.getOutputDir())  // ← Publishes to Verdaccio
  }
}
```

Becomes:

```typescript
if (options.publish) {
  await publish(npmClient, assembler.getOutputDir())
  await runConsumptionTests(assembler.getSourcePackagePath(), resolvedVersion, npmClient)
  // If tests pass, proceed to npm publish (if not already published to Verdaccio only)
}
```

### Test Discovery

Check for `consumption-tests/` directory in source package. Glob for `*.js` (runtime tests) and `*.ts` (compilation tests). No configuration needed - presence of the directory enables the feature.

### Test Environment Setup

For each package being published:

1. Create temp directory with `fs.mkdtemp(path.join(os.tmpdir(), 'monocrate-consumption-'))`
2. Write temporary `.npmrc` pointing to Verdaccio registry (same npmrc used for publish)
3. Run `npm install <package-name>@<version>` to install from Verdaccio
4. Copy consumption test files to temp directory
5. Execute tests

This creates a realistic consumption scenario - the package comes from the registry, not local filesystem.

### Runtime Test Execution

For each `.js` file in `consumption-tests/`:

1. Copy test file to temp directory
2. Spawn `node <test-file>` as child process
3. Capture stdout/stderr for error reporting
4. Check exit code - 0 means pass, anything else fails
5. If failed, abort publish and show output

Use `child_process.spawn` rather than `execSync` to handle long-running tests with streaming output.

### Compilation Test Execution

For each `.ts` file in `consumption-tests/`:

1. Copy test file to temp directory
2. Spawn `tsc --noEmit <test-file>` as child process
3. Capture compiler output
4. Check exit code - 0 means no type errors
5. If failed, abort publish and show TypeScript errors

TypeScript must be available (either in package dependencies or globally installed). If `tsc` not found, skip compilation tests with a warning (don't fail - package might not ship types).

### Error Handling

When a test fails:
- Log which test failed (filename)
- Show complete stdout/stderr output
- Show exit code if non-zero
- Abort publish with clear error message
- Leave temp directory intact for debugging (with path logged)

### Cleanup

On success, delete temp directory. On failure, preserve it for debugging. Log the temp directory path so developers can inspect the installed package state.

## Open Questions

**File extensions**: Should we explicitly support `.mjs` and `.cjs` for runtime tests? Or just `.js` with package.json `"type": "module"` controlling interpretation? Explicit extensions would let a single package test both ESM and CommonJS entry points.

**Environment variables**: Should we expose test metadata as environment variables (e.g., `MONOCRATE_PACKAGE_NAME`, `MONOCRATE_VERSION`, `MONOCRATE_TEST_TYPE`)? This would help tests verify they're testing the correct package version, but adds API surface.

**Peer dependencies**: How do we handle packages with peer dependencies? Real users install peer deps themselves, but consumption tests run in isolation. Should we install peer deps automatically (violating the isolation principle) or require packages with peer deps to skip consumption tests?

**Test timeout**: Should individual tests have a timeout? 30 seconds seems reasonable for basic import verification, but where do we draw the line between "quick smoke test" and "integration test that belongs in CI"?

**Compilation test isolation**: Should each `.ts` test run in its own temp directory, or can they share? Shared directory is faster but risks interference if tests write files. Isolated directories are safer but slower.

**Skip flag**: Do we need a way to skip consumption tests? Use cases: debugging, packages that can't run consumption tests (peer dependency issues), rapid iteration. Could be `--skip-consumption-tests` CLI flag or `monocrate.skipConsumptionTests` in package.json.

**ESM vs CommonJS**: Should we detect package `"type": "module"` and adjust test execution? Or assume all `.js` tests must match the package's module type? Mixed-mode testing (ESM package, CommonJS consumption test) might be valuable.

**TypeScript availability**: If `tsc` is not found and compilation tests exist, should we fail or warn? Failing prevents publish when types are critical; warning lets it slide when types are optional.

## Non-Goals

- **NOT a full integration test framework** - No mocking, no assertions library, no test lifecycle hooks. Use jest/vitest for that.
- **NOT for testing business logic** - Unit tests verify correctness. Consumption tests verify package structure.
- **NOT for testing with external services** - No database connections, no API calls. Tests run in isolation with only the published package.
- **NOT for performance testing** - These run on every publish. Keep them fast (under 5 seconds total).

## Implementation Notes

### Existing Patterns to Follow

Monocrate already has patterns for temporary directory management (`folderify` test helper), npm operations (`NpmClient` class), and Verdaccio integration (`VerdaccioTestkit`). Consumption tests should leverage these rather than reinventing.

### Verdaccio Interaction

The `VerdaccioTestkit.runConumser()` method already implements the core pattern: install package from Verdaccio, run JavaScript code against it, capture output. Consumption tests are essentially productionizing this pattern for use in the publish flow.

### File to Create

New file: `src/consumption-tests.ts` containing:
- `runConsumptionTests(packagePath, version, npmClient)` - main entry point
- `discoverTests(packagePath)` - find test files in consumption-tests/
- `runRuntimeTest(testFile, tempDir)` - execute .js test
- `runCompilationTest(testFile, tempDir)` - execute .ts test
- `createTestEnvironment(packageName, version, npmClient)` - set up temp dir with installed package

Integration point in `monocrate.ts` calls `runConsumptionTests` after Verdaccio publish, before npm publish.
