import { spawn } from 'node:child_process'
import type { VersionSpecifier } from './version-specifier.js'

async function getCurrentPublishedVersion(packageName: string): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn('npm', ['view', packageName, 'version'])

    const stdout: string[] = []
    proc.stdout.on('data', (data: Buffer) => {
      stdout.push(data.toString())
    })

    proc.on('close', (code: number | null) => {
      const output = stdout.join('').trim()
      if (code !== 0 || !output) {
        resolve('0.0.0')
      } else {
        resolve(output)
      }
    })
  })
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
