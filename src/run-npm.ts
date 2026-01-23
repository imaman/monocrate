import { x } from 'tinyexec'
import type { AbsolutePath } from './paths.js'

type NpmSubcommand = 'view' | 'publish' | 'pack'

interface NpmOptionsBase {
  env?: Partial<Record<string, string>>
}

interface StdioPipe {
  inheritStdio?: false
}

interface StdioInherit {
  inheritStdio: true
}

interface PolicyThrow {
  nonZeroExitCodePolicy?: 'throw'
}

interface PolicyReturn {
  nonZeroExitCodePolicy: 'return'
}

interface ResultSuccess {
  ok: true
}

interface ResultError {
  ok: false
  error: Error
}

interface WithOutput {
  stdout: string
  stderr: string
}

type NpmResultWithOutput = (ResultSuccess | ResultError) & WithOutput
type NpmResultNoOutput = ResultSuccess | ResultError

export async function runNpm(
  subcommand: NpmSubcommand,
  args: string[],
  cwd: AbsolutePath,
  options: NpmOptionsBase & StdioInherit & PolicyReturn
): Promise<NpmResultNoOutput>
export async function runNpm(
  subcommand: NpmSubcommand,
  args: string[],
  cwd: AbsolutePath,
  options: NpmOptionsBase & StdioPipe & PolicyReturn
): Promise<NpmResultWithOutput>
export async function runNpm(
  subcommand: NpmSubcommand,
  args: string[],
  cwd: AbsolutePath,
  options: NpmOptionsBase & StdioInherit & PolicyThrow
): Promise<ResultSuccess>
export async function runNpm(
  subcommand: NpmSubcommand,
  args: string[],
  cwd: AbsolutePath,
  options?: NpmOptionsBase & StdioPipe & PolicyThrow
): Promise<ResultSuccess & WithOutput>
export async function runNpm(
  subcommand: NpmSubcommand,
  args: string[],
  cwd: AbsolutePath,
  options?: NpmOptionsBase & (StdioPipe | StdioInherit) & (PolicyThrow | PolicyReturn)
): Promise<NpmResultWithOutput | NpmResultNoOutput> {
  const errorPolicy = options?.nonZeroExitCodePolicy ?? 'throw'
  const env = options?.env !== undefined ? { ...process.env, ...options.env } : undefined
  const inheritStdio = options?.inheritStdio ?? false

  const proc = x('npm', [subcommand, ...args], {
    nodeOptions: { cwd, env, stdio: inheritStdio ? 'inherit' : 'pipe' },
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
    if (inheritStdio) {
      return { ok: false, error }
    }
    return { ok: false, stdout: result.stdout, stderr: result.stderr, error }
  }

  if (inheritStdio) {
    return { ok: true }
  }
  return { ok: true, stdout: result.stdout, stderr: result.stderr }
}
