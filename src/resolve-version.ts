import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { VersionSpecifier } from './version-specifier.js'

const execAsync = promisify(exec)

async function getCurrentPublishedVersion(packageName: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`npm view ${packageName} version`)
    return stdout.trim()
  } catch {
    return '0.0.0'
  }
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
