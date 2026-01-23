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

const NpmViewVersionResult = z.string()

const NpmPackFile = z.object({
  path: z.string(),
})

const NpmPackEntry = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  size: z.number(),
  unpackedSize: z.number(),
  shasum: z.string(),
  integrity: z.string(),
  filename: z.string(),
  files: z.array(NpmPackFile),
})
type NpmPackEntry = z.infer<typeof NpmPackEntry>

const NpmPackOutput = z.array(NpmPackEntry)

type ViewVersionResult = { found: true; version: string } | { found: false; errorCode: string }

interface PackResult {
  files: string[]
  filename: string
  size: number
  unpackedSize: number
  shasum: string
  integrity: string
}

interface NpmClientOptions {
  env?: Partial<Record<string, string>>
}

interface PublishOptions {
  userconfig?: AbsolutePath
}

interface PackOptions {
  dryRun?: boolean
}

export class NpmClient {
  private readonly env: Partial<Record<string, string>> | undefined

  constructor(options?: NpmClientOptions) {
    this.env = options?.env
  }

  async publish(dir: AbsolutePath, options?: PublishOptions): Promise<void> {
    const args: string[] = []
    if (options?.userconfig !== undefined) {
      args.push('--userconfig', options.userconfig)
    }
    await runNpm('publish', args, dir, this.env !== undefined ? { env: this.env } : undefined)
  }

  async viewVersion(packageName: string, cwd: AbsolutePath): Promise<ViewVersionResult> {
    const result = await runNpm('view', ['-s', '--json', packageName, 'version'], cwd, {
      stdio: 'pipe',
      nonZeroExitCodePolicy: 'return',
      ...(this.env !== undefined ? { env: this.env } : {}),
    })

    const parsed: unknown = JSON.parse(result.stdout)

    if (result.ok) {
      const versionResult = NpmViewVersionResult.safeParse(parsed)
      if (!versionResult.success) {
        throw new Error(`Unexpected response from npm view: ${result.stdout}`)
      }
      return { found: true, version: versionResult.data }
    }

    const errorResult = NpmErrorResponse.safeParse(parsed)
    if (errorResult.success) {
      const code = errorResult.data.error.code ?? 'UNKNOWN'
      if (code === 'E404') {
        return { found: false, errorCode: code }
      }
      const detail = errorResult.data.error.detail ?? errorResult.data.error.summary ?? '<No Further Details>'
      throw new Error(`npm view failed (${code}): ${detail}`)
    }

    throw new Error(`Unexpected response from npm view: ${result.stdout}`)
  }

  async pack(dir: AbsolutePath, options?: PackOptions): Promise<PackResult> {
    const args = ['--json']
    if (options?.dryRun === true) {
      args.push('--dry-run')
    }

    const { stdout } = await runNpm('pack', args, dir, {
      stdio: 'pipe',
      ...(this.env !== undefined ? { env: this.env } : {}),
    })

    const json: unknown = JSON.parse(stdout)

    const errorResult = NpmErrorResponse.safeParse(json)
    if (errorResult.success) {
      const summary = errorResult.data.error.summary ?? errorResult.data.error.detail ?? '<No Details>'
      throw new Error(`npm pack failed: ${summary}`)
    }

    const parsed = NpmPackOutput.safeParse(json)
    if (!parsed.success) {
      throw new Error(`Failed to parse npm pack output: ${parsed.error.message}`)
    }

    const packEntry = parsed.data[0]
    if (packEntry === undefined) {
      throw new Error('npm pack returned empty output')
    }

    return {
      files: packEntry.files.map((f) => f.path),
      filename: packEntry.filename,
      size: packEntry.size,
      unpackedSize: packEntry.unpackedSize,
      shasum: packEntry.shasum,
      integrity: packEntry.integrity,
    }
  }
}
