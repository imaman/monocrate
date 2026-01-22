import { execFile } from 'node:child_process'
import { z } from 'zod'
import type { VersionSpecifier } from './version-specifier.js'

const NpmErrorResponse = z.object({
  error: z.object({
    code: z.string().optional(),
    detail: z.string().optional(),
  }),
})

export async function getCurrentPublishedVersion(dir: string, packageName: string): Promise<string> {
  const { error, stdout } = await new Promise<{ error: Error | undefined; stdout: string }>((resolve) => {
    execFile('npm', ['view', '-s', '--json', packageName, 'version'], { cwd: dir }, (error, stdout) => {
      resolve({ error: error ?? undefined, stdout })
    })
  })

  const parsed: unknown = JSON.parse(stdout)

  if (!error) {
    if (typeof parsed !== 'string') {
      throw new Error(`Unexpected response from npm view: ${stdout}`)
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

  throw new Error(`Unexpected response from npm view: ${stdout}`)
}

function parseVersion(version: string): [number, number, number] {
  const nums = version.split('.').slice(0, 3).map(Number)
  if (nums.length !== 3) {
    throw new Error(`Version is ill-formatted: "${version}"`)
  }
  return nums as [number, number, number]
}

function compareVersions(a: string, b: string): number {
  const [aMajor, aMinor, aPatch] = parseVersion(a)
  const [bMajor, bMinor, bPatch] = parseVersion(b)
  if (aMajor !== bMajor) return aMajor - bMajor
  if (aMinor !== bMinor) return aMinor - bMinor
  return aPatch - bPatch
}

function applyIncrement(version: string, increment: 'major' | 'minor' | 'patch'): string {
  const nums = parseVersion(version)
  const indexToIncrement = { major: 0, minor: 1, patch: 2 }[increment]
  return nums.map((n, i) => (i < indexToIncrement ? n : i === indexToIncrement ? n + 1 : 0)).join('.')
}

/**
 * Resolves the version for multiple packages by finding the maximum current version
 * and applying the version specifier to it.
 */
export async function resolveVersionForPackages(
  packages: { dir: string; packageName: string }[],
  versionSpecifier: VersionSpecifier
): Promise<string> {
  if (versionSpecifier.tag === 'explicit') {
    return versionSpecifier.value
  }

  const versions = await Promise.all(
    packages.map(async ({ dir, packageName }) => getCurrentPublishedVersion(dir, packageName))
  )

  const maxVersion = versions.reduce((max, v) => (compareVersions(v, max) > 0 ? v : max), '0.0.0')
  return applyIncrement(maxVersion, versionSpecifier.tag)
}

export async function resolveVersion(
  dir: string,
  packageName: string,
  versionSpecifier: VersionSpecifier
): Promise<string> {
  return resolveVersionForPackages([{ dir, packageName }], versionSpecifier)
}
