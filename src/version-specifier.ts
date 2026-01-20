import { z } from 'zod'

const SemVerPart = z.union([z.literal('patch'), z.literal('minor'), z.literal('major')])
export type VersionSpecifier = { tag: 'major' | 'minor' | 'patch' } | { tag: 'explicit'; value: string }
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
