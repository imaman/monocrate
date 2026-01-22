import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { z } from 'zod'
import type { VersionSpecifier } from './version-specifier.js'

const execFileAsync = promisify(execFile)

const NpmErrorResponse = z.object({
  error: z.object({
    code: z.string().optional(),
    detail: z.string().optional(),
  }),
})

async function getCurrentPublishedVersion(dir: string, packageName: string): Promise<string> {
  const { stdout } = await execFileAsync('npm', ['view', '-s', '--json', packageName, 'version'], { cwd: dir })
  const parsed: unknown = JSON.parse(stdout)

  const errorResult = NpmErrorResponse.safeParse(parsed)
  if (errorResult.success) {
    if (errorResult.data.error.code === 'E404') {
      return '0.0.0'
    }
    throw new Error(
      `npm view failed (${errorResult.data.error.code ?? '<No Error Code>'}): ${errorResult.data.error.detail ?? '<No Further Details>'}`
    )
  }

  if (typeof parsed !== 'string') {
    throw new Error(`Unexpected response from npm view: ${stdout}`)
  }

  return parsed
}

export async function resolveVersion(dir: string, packageName: string, versionSpecifier: VersionSpecifier) {
  if (versionSpecifier.tag === 'explicit') {
    return versionSpecifier.value
  }

  const currentVersion = await getCurrentPublishedVersion(dir, packageName)
  const nums = currentVersion.split('.').slice(0, 3).map(Number)
  if (nums.length !== 3) {
    throw new Error(`Current version is ill-formatted: "${currentVersion}"`)
  }

  const indexToIncrement = { major: 0, minor: 1, patch: 2 }[versionSpecifier.tag]
  return nums.map((n, i) => (i < indexToIncrement ? n : i === indexToIncrement ? n + 1 : 0)).join('.')
}
