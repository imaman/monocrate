import { z } from 'zod'
import type { AbsolutePath } from './paths.js'
import { runNpm } from './run-npm.js'

const NpmErrorResponse = z.object({
  error: z.object({
    code: z.string().optional(),
    summary: z.string().optional(),
    detail: z.string().optional(),
  }),
})

export class NpmClient {
  private readonly env: Partial<Record<string, string>> | undefined

  constructor(options?: { env?: Partial<Record<string, string>> }) {
    this.env = options?.env
  }

  async publish(dir: AbsolutePath, options?: { userconfig?: AbsolutePath }): Promise<void> {
    await runNpm('publish', options?.userconfig ? ['--userconfig', options.userconfig] : [], dir, { env: this.env })
  }

  /**
   * @param packageName
   * @param cwd
   * @returns the version of `packageName` or undefined (if not found)
   */
  async viewVersion(packageName: string, cwd: AbsolutePath): Promise<string | undefined> {
    const result = await runNpm('view', ['-s', '--json', packageName, 'version'], cwd, {
      stdio: 'pipe',
      nonZeroExitCodePolicy: 'return',
      ...(this.env !== undefined ? { env: this.env } : {}),
    })

    if (result.ok) {
      const parsed = z.string().safeParse(JSON.parse(result.stdout))
      if (!parsed.success) {
        throw new Error(`Response of 'npm view' could not be parsed: ${result.stdout}`)
      }
      return parsed.data
    }

    const parsed = NpmErrorResponse.safeParse(JSON.parse(result.stdout))
    if (!parsed.success) {
      throw new Error(`Error response of 'npm view' could not be parsed: ${result.stdout}`)
    }

    const code = parsed.data.error.code ?? 'UNKNOWN'
    if (code !== 'E404') {
      const detail = parsed.data.error.detail ?? parsed.data.error.summary ?? '<No Further Details>'
      throw new Error(`npm view failed (${code}): ${detail}`)
    }
    return undefined
  }

  async pack(dir: AbsolutePath, options?: { dryRun?: boolean }) {
    const { stdout } = await runNpm('pack', ['--json', ...(options?.dryRun ? ['--dry-run'] : [])], dir, {
      stdio: 'pipe',
      env: this.env,
    })
    const json: unknown = JSON.parse(stdout)

    const errorResult = NpmErrorResponse.safeParse(json)
    if (errorResult.success) {
      const summary = errorResult.data.error.summary ?? errorResult.data.error.detail ?? '<No Details>'
      throw new Error(`npm pack failed: ${summary}`)
    }

    const parsed = z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          version: z.string(),
          size: z.number(),
          unpackedSize: z.number(),
          shasum: z.string(),
          integrity: z.string(),
          filename: z.string(),
          files: z.array(
            z.object({
              path: z.string(),
            })
          ),
        })
      )
      .safeParse(json)
    if (!parsed.success) {
      throw new Error(`Failed to parse npm pack output: ${parsed.error.message}`)
    }

    return parsed.data
  }
}
