import { spawnSync } from 'node:child_process'
import type { VersionSpecifier } from './version-specifier.js'

function getCurrentPublishedVersion(packageName: string): string {
  const result = spawnSync('npm', ['view', packageName, 'version'], {
    encoding: 'utf-8',
  })
  if (result.status !== 0 || !result.stdout.trim()) {
    return '0.0.0'
  }
  return result.stdout.trim()
}

// eslint-disable-next-line @typescript-eslint/require-await
export async function resolveVersion(packageName: string, versionSpecifier: VersionSpecifier) {
  if (versionSpecifier.tag === 'explicit') {
    return versionSpecifier.value
  }

  const currentVersion = getCurrentPublishedVersion(packageName)
  const nums = currentVersion.split('.').slice(0, 3).map(Number)

  const index = { major: 0, minor: 1, patch: 2 }[versionSpecifier.tag]
  const n = nums[index]
  if (n === undefined) {
    throw new Error(`Bad versionSpecifier: ${versionSpecifier.tag}`)
  }
  nums[index] = n + 1
  return nums.join('.')
}
