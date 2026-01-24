import type { AbsolutePath } from './paths.js'
import type { VersionSpecifier } from './version-specifier.js'
import { NpmClient } from './npm-client.js'

async function getCurrentPublishedVersion(dir: AbsolutePath, packageName: string): Promise<string> {
  return (await new NpmClient().viewVersion(packageName, dir)) ?? '0.0.0'
}

function parseVersion(version: string): [number, number, number] {
  const nums = version.split('.').slice(0, 3).map(Number)
  if (nums.length !== 3) {
    throw new Error(`Version is ill-formatted: "${version}"`)
  }
  return [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0]
}

function compareVersions(a: string, b: string): number {
  const [aMajor, aMinor, aPatch] = parseVersion(a)
  const [bMajor, bMinor, bPatch] = parseVersion(b)
  if (aMajor !== bMajor) {
    return aMajor - bMajor
  }
  if (aMinor !== bMinor) {
    return aMinor - bMinor
  }
  return aPatch - bPatch
}

function incrementVersion(version: string, increment: 'major' | 'minor' | 'patch'): string {
  const nums = parseVersion(version)
  const indexToIncrement = { major: 0, minor: 1, patch: 2 }[increment]
  return nums.map((n, i) => (i < indexToIncrement ? n : i === indexToIncrement ? n + 1 : 0)).join('.')
}

export async function resolveVersion(dir: AbsolutePath, packageName: string, versionSpecifier: VersionSpecifier) {
  if (versionSpecifier.tag === 'explicit') {
    return versionSpecifier.value
  }

  const currentVersion = await getCurrentPublishedVersion(dir, packageName)
  return incrementVersion(currentVersion, versionSpecifier.tag)
}

export interface PackageVersionInfo {
  dir: AbsolutePath
  packageName: string
}

/**
 * Resolves a shared version across multiple packages.
 * When using an increment keyword (patch/minor/major), finds the maximum current version
 * among all packages and applies the increment to it.
 */
export async function resolveVersionAcrossPackages(
  packages: PackageVersionInfo[],
  versionSpecifier: VersionSpecifier
): Promise<string> {
  if (versionSpecifier.tag === 'explicit') {
    return versionSpecifier.value
  }

  const currentVersions = await Promise.all(
    packages.map(async (p) => getCurrentPublishedVersion(p.dir, p.packageName))
  )

  const maxVersion = currentVersions.reduce(
    (max, v) => (compareVersions(v, max) > 0 ? v : max),
    '0.0.0'
  )

  return incrementVersion(maxVersion, versionSpecifier.tag)
}
