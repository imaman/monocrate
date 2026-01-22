import { x } from 'tinyexec'
import type { AbsolutePath } from './paths.js'

type NpmSubcommand = 'view' | 'publish' | 'pack'

interface NpmOptionsBase {
  env?: Partial<Record<string, string>>
  inheritStdio?: boolean
}

interface NpmOptionsThrow extends NpmOptionsBase {
  errorPolicy?: 'throw'
}

interface NpmOptionsReturn extends NpmOptionsBase {
  errorPolicy: 'return'
}

interface NpmSuccessResult {
  ok: true
  stdout: string
  stderr: string
}

interface NpmErrorResult {
  ok: false
  stdout: string
  stderr: string
  error: Error
}

type NpmResult = NpmSuccessResult | NpmErrorResult

export async function runNpm(
  subcommand: NpmSubcommand,
  args: string[],
  cwd: AbsolutePath,
  options: NpmOptionsReturn
): Promise<NpmResult>
export async function runNpm(
  subcommand: NpmSubcommand,
  args: string[],
  cwd: AbsolutePath,
  options?: NpmOptionsThrow
): Promise<NpmSuccessResult>
export async function runNpm(
  subcommand: NpmSubcommand,
  args: string[],
  cwd: AbsolutePath,
  options?: NpmOptionsThrow | NpmOptionsReturn
): Promise<NpmResult> {
  const errorPolicy = options?.errorPolicy ?? 'throw'
  const env = options?.env !== undefined ? { ...process.env, ...options.env } : undefined
  const inheritStdio = options?.inheritStdio ?? false

  const proc = x('npm', [subcommand, ...args], {
    nodeOptions: { cwd, env, stdio: inheritStdio ? 'inherit' : 'pipe' },
    throwOnError: false,
  })

  const result = await proc

  if (result.exitCode === undefined) {
    const error = new Error(`npm ${subcommand} terminated abnormally` + (proc.killed ? ' (killed)' : ''))
    if (errorPolicy === 'throw') {
      throw error
    }
    return { ok: false, stdout: result.stdout, stderr: result.stderr, error }
  }

  if (result.exitCode !== 0) {
    const error = new Error(`npm ${subcommand} exited with code ${String(result.exitCode)}`)
    if (errorPolicy === 'throw') {
      throw error
    }
    return { ok: false, stdout: result.stdout, stderr: result.stderr, error }
  }

  return { ok: true, stdout: result.stdout, stderr: result.stderr }
}
