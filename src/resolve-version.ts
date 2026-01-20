import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { z } from 'zod'
import type { VersionSpecifier } from './version-specifier.js'

const execAsync = promisify(exec)

const NpmErrorResponse = z.object({
  error: z.object({
    code: z.string().optional(),
    detail: z.string().optional(),
  }),
})

async function getCurrentPublishedVersion(packageName: string): Promise<string> {
  const { stdout } = await execAsync(`npm view -s --json ${packageName} version`)
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

export async function resolveVersion(packageName: string, versionSpecifier: VersionSpecifier) {
  if (versionSpecifier.tag === 'explicit') {
    return versionSpecifier.value
  }

  const currentVersion = await getCurrentPublishedVersion(packageName)
  const nums = currentVersion.split('.').slice(0, 3).map(Number)

  const index = { major: 0, minor: 1, patch: 2 }[versionSpecifier.tag]
  const n = nums[index]
  if (n === undefined) {
    throw new Error(`Bad versionSpecifier: ${versionSpecifier.tag}`)
  }
  nums[index] = n + 1
  return nums.join('.')
}
