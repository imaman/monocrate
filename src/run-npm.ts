import { execFile } from 'node:child_process'
import type { AbsolutePath } from './paths.js'

type NpmSubcommand = 'view' | 'publish' | 'pack'

interface NpmOptionsBase {
  env?: Partial<Record<string, string>>
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

  return new Promise((resolve, reject) => {
    execFile('npm', [subcommand, ...args], { cwd, env }, (error, stdout, stderr) => {
      if (error) {
        if (errorPolicy === 'throw') {
          reject(error instanceof Error ? error : new Error('npm command failed'))
          return
        }
        resolve({ ok: false, stdout, stderr, error })
        return
      }
      resolve({ ok: true, stdout, stderr })
    })
  })
}
