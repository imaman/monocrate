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
  const nums = parseVersion(currentVersion)
  const indexToIncrement = { major: 0, minor: 1, patch: 2 }[versionSpecifier.tag]
  return nums.map((n, i) => (i < indexToIncrement ? n : i === indexToIncrement ? n + 1 : 0)).join('.')
}

export function maxVersion(va: string, vb: string) {
  const [a1, a2, a3] = parseVersion(va)
  const [b1, b2, b3] = parseVersion(vb)

  if (a1 !== b1) {
    return a1 > b1 ? va : vb
  }

  if (a2 !== b2) {
    return a2 > b2 ? va : vb
  }

  if (a3 !== b3) {
    return a3 > b3 ? va : vb
  }

  return va
}

const parseVersion = (s: string): [number, number, number] => {
  const [a, b, c] = s
    .split('.')
    .slice(0, 3)
    .map(Number)
    .filter((at) => Number.isInteger(at))
  if (a === undefined || b === undefined || c === undefined) {
    throw new Error(`Current version is ill-formatted: "${s}"`)
  }

  return [a, b, c]
}
