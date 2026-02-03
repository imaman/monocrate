/**
 * Compile-time tests for runNpm overloads.
 * This file is not executed - it only verifies that TypeScript correctly
 * infers return types based on the options passed.
 *
 * If any @ts-expect-error comment does NOT produce an error, the build will fail,
 * indicating a type regression.
 */

/* eslint-disable @typescript-eslint/no-unused-expressions */

import type { AbsolutePath } from '../src/paths.js'
import { runNpm } from '../src/run-npm.js'

export async function testOverloads(cwd: AbsolutePath) {
  // ============================================================
  // Test 1: Default (no options)
  // Policy: throw (default), Stdio: inherit (default)
  // Expected: PolicyThrowResult (just { ok: true })
  // ============================================================
  const defaultCall = await runNpm('view', [], cwd)

  defaultCall.ok satisfies true

  // @ts-expect-error - stdout not available with inherit stdio
  defaultCall.stdout

  // @ts-expect-error - stderr not available with inherit stdio
  defaultCall.stderr

  // @ts-expect-error - error not available with throw policy (it throws instead)
  defaultCall.error

  // ============================================================
  // Test 2: stdio: 'pipe' only
  // Policy: throw (default), Stdio: pipe
  // Expected: PolicyThrowResult & OutputResult
  // ============================================================
  const pipeOnly = await runNpm('view', [], cwd, { stdio: 'pipe' })

  pipeOnly.ok satisfies true
  pipeOnly.stdout satisfies string
  pipeOnly.stderr satisfies string

  // @ts-expect-error - error not available with throw policy
  pipeOnly.error

  // ============================================================
  // Test 3: nonZeroExitCodePolicy: 'return' only
  // Policy: return, Stdio: inherit (default)
  // Expected: PolicyReturnResult (no output)
  // ============================================================
  const returnOnly = await runNpm('view', [], cwd, { nonZeroExitCodePolicy: 'return' })

  returnOnly.ok satisfies boolean

  // @ts-expect-error - stdout not available with inherit stdio
  returnOnly.stdout

  // @ts-expect-error - stderr not available with inherit stdio
  returnOnly.stderr

  if (!returnOnly.ok) {
    returnOnly.error satisfies Error
  }

  // ============================================================
  // Test 4: Both stdio: 'pipe' and nonZeroExitCodePolicy: 'return'
  // Policy: return, Stdio: pipe
  // Expected: PolicyReturnResult & OutputResult
  // ============================================================
  const pipeAndReturn = await runNpm('view', [], cwd, {
    stdio: 'pipe',
    nonZeroExitCodePolicy: 'return',
  })

  pipeAndReturn.ok satisfies boolean
  pipeAndReturn.stdout satisfies string
  pipeAndReturn.stderr satisfies string

  if (!pipeAndReturn.ok) {
    pipeAndReturn.error satisfies Error
  }

  // ============================================================
  // Test 5: Explicit inherit + throw (same as default)
  // ============================================================
  const explicitInheritThrow = await runNpm('view', [], cwd, {
    stdio: 'inherit',
    nonZeroExitCodePolicy: 'throw',
  })

  explicitInheritThrow.ok satisfies true

  // @ts-expect-error - stdout not available with inherit stdio
  explicitInheritThrow.stdout

  // @ts-expect-error - error not available with throw policy
  explicitInheritThrow.error

  // ============================================================
  // Test 6: Explicit pipe + throw
  // ============================================================
  const explicitPipeThrow = await runNpm('view', [], cwd, {
    stdio: 'pipe',
    nonZeroExitCodePolicy: 'throw',
  })

  explicitPipeThrow.ok satisfies true
  explicitPipeThrow.stdout satisfies string
  explicitPipeThrow.stderr satisfies string

  // @ts-expect-error - error not available with throw policy
  explicitPipeThrow.error

  // ============================================================
  // Test 7: Explicit inherit + return
  // ============================================================
  const explicitInheritReturn = await runNpm('view', [], cwd, {
    stdio: 'inherit',
    nonZeroExitCodePolicy: 'return',
  })

  explicitInheritReturn.ok satisfies boolean

  // @ts-expect-error - stdout not available with inherit stdio
  explicitInheritReturn.stdout

  if (!explicitInheritReturn.ok) {
    explicitInheritReturn.error satisfies Error
  }
}
