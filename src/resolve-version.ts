import { spawnSync } from 'node:child_process'
import { z } from 'zod'

const explicitVersionRegex = /^\d+\.\d+\.\d+$/

const SemVerPart = z.union([z.literal('patch'), z.literal('minor'), z.literal('major')])

const VersionSpecifier = SemVerPart.or(z.string().regex(explicitVersionRegex, 'Must be x.y.z format'))

export type VersionSpecifier = z.infer<typeof VersionSpecifier>

function getCurrentPublishedVersion(packageName: string): string {
  const result = spawnSync('npm', ['view', packageName, 'version'], {
    encoding: 'utf-8',
  })
  if (result.status !== 0 || !result.stdout.trim()) {
    return '0.0.0'
  }
  return result.stdout.trim()
}

export function resolveVersion(packageName: string, versionSpecifier: VersionSpecifier | undefined) {
  if (!versionSpecifier) {
    return undefined
  }

  const parsed = SemVerPart.safeParse(versionSpecifier)
  if (parsed.success) {
    const currentVersion = getCurrentPublishedVersion(packageName)
    const nums = currentVersion.split('.').slice(0, 3).map(Number)

    const index = { patch: 2, minor: 1, major: 0 }[parsed.data]
    const n = nums[index]
    if (n === undefined) {
      throw new Error(`Bad version string: ${versionSpecifier}`)
    }
    nums[index] = n + 1
    return nums.join('.')
  } else {
    return versionSpecifier
  }
}

export function parseVersionSpecifier(value: string | undefined): VersionSpecifier | undefined {
  if (value === undefined) {
    return undefined
  }
  const parseResult = VersionSpecifier.safeParse(value)
  if (!parseResult.success) {
    throw new Error(
      `Invalid publish value: "${value}". Expected "patch", "minor", "major" or an explicit version such as "1.2.3"`
    )
  }
  return parseResult.data
}
