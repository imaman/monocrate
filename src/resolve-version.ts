import { spawnSync } from 'node:child_process'
import { z } from 'zod'

const SemVerPart = z.union([z.literal('patch'), z.literal('minor'), z.literal('major')])

function getCurrentPublishedVersion(packageName: string): string {
  const result = spawnSync('npm', ['view', packageName, 'version'], {
    encoding: 'utf-8',
  })
  if (result.status !== 0 || !result.stdout.trim()) {
    return '0.0.0'
  }
  return result.stdout.trim()
}

type VersionSpecifier = { tag: 'major' | 'minor' | 'patch' } | { tag: 'explicit'; value: string }

export function resolveVersion(packageName: string, versionSpecifier: VersionSpecifier) {
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

export function parseVersionSpecifier(value: string | undefined): VersionSpecifier | undefined {
  if (value === undefined) {
    return undefined
  }

  const parsedPart = SemVerPart.safeParse(value)
  if (parsedPart.success) {
    return { tag: parsedPart.data }
  }

  const isSemver = /^\d+\.\d+\.\d+(-[\w.-]+)?(\+[\w.-]+)?$/.test(value)
  if (!isSemver) {
    throw new Error(
      `Invalid publish value: "${value}". Expected "patch", "minor", "major" or an explicit version such as "1.2.3"`
    )
  }

  return { tag: 'explicit', value }
}
