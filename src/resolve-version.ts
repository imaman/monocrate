import type { AbsolutePath } from './paths.js'
import type { VersionSpecifier } from './version-specifier.js'
import { NpmClient } from './npm-client.js'

async function getCurrentPublishedVersion(dir: AbsolutePath, packageName: string): Promise<string> {
  return (await new NpmClient().viewVersion(packageName, dir)) ?? '0.0.0'
}

function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number)
  const bParts = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const aPart = aParts[i] ?? 0
    const bPart = bParts[i] ?? 0
    if (aPart !== bPart) {
      return aPart - bPart
    }
  }
  return 0
}

export async function findMaxVersion(
  packages: readonly { dir: AbsolutePath; packageName: string }[]
): Promise<string> {
  const versions = await Promise.all(
    packages.map(async ({ dir, packageName }) => getCurrentPublishedVersion(dir, packageName))
  )
  return versions.reduce((max, v) => (compareVersions(v, max) > 0 ? v : max), '0.0.0')
}

export function applyVersionIncrement(baseVersion: string, versionSpecifier: VersionSpecifier): string {
  if (versionSpecifier.tag === 'explicit') {
    return versionSpecifier.value
  }

  const nums = baseVersion.split('.').slice(0, 3).map(Number)
  if (nums.length !== 3) {
    throw new Error(`Base version is ill-formatted: "${baseVersion}"`)
  }

  const indexToIncrement = { major: 0, minor: 1, patch: 2 }[versionSpecifier.tag]
  return nums.map((n, i) => (i < indexToIncrement ? n : i === indexToIncrement ? n + 1 : 0)).join('.')
}

export async function resolveVersion(dir: AbsolutePath, packageName: string, versionSpecifier: VersionSpecifier) {
  if (versionSpecifier.tag === 'explicit') {
    return versionSpecifier.value
  }

  const currentVersion = await getCurrentPublishedVersion(dir, packageName)
  return applyVersionIncrement(currentVersion, versionSpecifier)
}
