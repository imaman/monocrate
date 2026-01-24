import type { AbsolutePath } from './paths.js'
import type { VersionSpecifier } from './version-specifier.js'
import { NpmClient } from './npm-client.js'

async function getCurrentPublishedVersion(dir: AbsolutePath, packageName: string): Promise<string> {
  return (await new NpmClient().viewVersion(packageName, dir)) ?? '0.0.0'
}

function parseVersion(version: string): [number, number, number] {
  const nums = version.split('.').slice(0, 3).map(Number)
  if (nums.length !== 3 || nums.some(isNaN)) {
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

function applyIncrement(version: string, specifier: VersionSpecifier): string {
  if (specifier.tag === 'explicit') {
    return specifier.value
  }

  const nums = parseVersion(version)
  const indexToIncrement = { major: 0, minor: 1, patch: 2 }[specifier.tag]
  return nums.map((n, i) => (i < indexToIncrement ? n : i === indexToIncrement ? n + 1 : 0)).join('.')
}

/**
 * Resolves a version for multiple packages by finding the maximum current published version
 * among all packages and applying the version specifier to it.
 *
 * @param packages - Array of { dir, packageName } for each subject package
 * @param versionSpecifier - The version specifier (patch/minor/major or explicit)
 * @returns The resolved version to use for all packages
 */
export async function resolveVersionForMultiple(
  packages: { dir: AbsolutePath; packageName: string }[],
  versionSpecifier: VersionSpecifier
): Promise<string> {
  if (versionSpecifier.tag === 'explicit') {
    return versionSpecifier.value
  }

  // Fetch current versions for all packages in parallel
  const currentVersions = await Promise.all(
    packages.map(async ({ dir, packageName }) => getCurrentPublishedVersion(dir, packageName))
  )

  // Find the maximum version
  const maxVersion = currentVersions.reduce((max, v) => (compareVersions(v, max) > 0 ? v : max), '0.0.0')

  // Apply the increment to the max version
  return applyIncrement(maxVersion, versionSpecifier)
}

export async function resolveVersion(dir: AbsolutePath, packageName: string, versionSpecifier: VersionSpecifier) {
  if (versionSpecifier.tag === 'explicit') {
    return versionSpecifier.value
  }

  const currentVersion = await getCurrentPublishedVersion(dir, packageName)
  return applyIncrement(currentVersion, versionSpecifier)
}
