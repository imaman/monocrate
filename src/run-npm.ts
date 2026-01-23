import { x } from 'tinyexec'
import type { AbsolutePath } from './paths.js'

interface NpmOptionsBase {
  env?: Partial<Record<string, string>>
}

interface StdioPipe {
  stdio: 'pipe'
}

interface StdioInherit {
  stdio?: 'inherit'
}

interface PolicyThrow {
  nonZeroExitCodePolicy?: 'throw'
}

interface PolicyReturn {
  nonZeroExitCodePolicy: 'return'
}

interface WithOutput {
  stdout: string
  stderr: string
}

type ResultOnError =
  | {
      ok: false
      error: Error
    }
  | { ok: true }

export async function runNpm(
  subcommand: string,
  args: string[],
  cwd: AbsolutePath,
  options: NpmOptionsBase & StdioInherit & PolicyReturn
): Promise<ResultOnError>
export async function runNpm(
  subcommand: string,
  args: string[],
  cwd: AbsolutePath,
  options: NpmOptionsBase & StdioPipe & PolicyReturn
): Promise<ResultOnError & WithOutput>
export async function runNpm(
  subcommand: string,
  args: string[],
  cwd: AbsolutePath,
  options?: NpmOptionsBase & StdioInherit & PolicyThrow
): Promise<{ ok: true }>
export async function runNpm(
  subcommand: string,
  args: string[],
  cwd: AbsolutePath,
  options: NpmOptionsBase & StdioPipe & PolicyThrow
): Promise<{ ok: true } & WithOutput>
export async function runNpm(
  subcommand: string,
  args: string[],
  cwd: AbsolutePath,
  options?: NpmOptionsBase & (StdioPipe | StdioInherit) & (PolicyThrow | PolicyReturn)
): Promise<ResultOnError | (ResultOnError & WithOutput) | { ok: true } | ({ ok: true } & WithOutput)> {
  const errorPolicy = options?.nonZeroExitCodePolicy ?? 'throw'
  const stdio = options?.stdio ?? 'inherit'

  const proc = x('npm', [subcommand, ...args], {
    nodeOptions: { cwd, env: options?.env, stdio },
    throwOnError: false,
  })

  const result = await proc

  if (result.exitCode === undefined) {
    throw new Error(`npm ${subcommand} terminated abnormally` + (proc.killed ? ' (killed)' : ''))
  }

  if (result.exitCode !== 0) {
    const error = new Error(`npm ${subcommand} exited with code ${String(result.exitCode)}`)
    if (errorPolicy === 'throw') {
      throw error
    }
    if (stdio === 'pipe') {
      return { ok: false, stdout: result.stdout, stderr: result.stderr, error }
    }
    return { ok: false, error }
  }

  if (stdio === 'pipe') {
    return { ok: true, stdout: result.stdout, stderr: result.stderr }
  }
  return { ok: true }
}
