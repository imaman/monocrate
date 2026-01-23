import { z } from 'zod'
import type { AbsolutePath } from './paths.js'
import { runNpm } from './run-npm.js'
import type { VersionSpecifier } from './version-specifier.js'

const NpmErrorResponse = z.object({
  error: z.object({
    code: z.string().optional(),
    detail: z.string().optional(),
  }),
})

async function getCurrentPublishedVersion(dir: AbsolutePath, packageName: string): Promise<string> {
  const result = await runNpm('view', ['-s', '--json', packageName, 'version'], dir, {
    stdio: 'pipe',
    nonZeroExitCodePolicy: 'return',
  })

  const parsed: unknown = JSON.parse(result.stdout)

  if (result.ok) {
    if (typeof parsed !== 'string') {
      throw new Error(`Unexpected response from npm view: ${result.stdout}`)
    }
    return parsed
  }

  const errorResult = NpmErrorResponse.safeParse(parsed)
  if (errorResult.success) {
    if (errorResult.data.error.code === 'E404') {
      return '0.0.0'
    }
    throw new Error(
      `npm view failed (${errorResult.data.error.code ?? '<No Error Code>'}): ${errorResult.data.error.detail ?? '<No Further Details>'}`
    )
  }

  throw new Error(`Unexpected response from npm view: ${result.stdout}`)
}

export async function resolveVersion(dir: AbsolutePath, packageName: string, versionSpecifier: VersionSpecifier) {
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
