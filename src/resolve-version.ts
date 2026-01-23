import type { AbsolutePath } from './paths.js'
import type { VersionSpecifier } from './version-specifier.js'
import { NpmClient } from './npm-client.js'

async function getCurrentPublishedVersion(dir: AbsolutePath, packageName: string): Promise<string> {
  return (await new NpmClient().viewVersion(packageName, dir)) ?? '0.0.0'
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
