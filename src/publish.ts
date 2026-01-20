import { spawnSync } from 'node:child_process'
import { z } from 'zod'
import { writePackageJson } from './transform-package-json.js'
import type { PackageJson } from './package-json.js'

const explicitVersionRegex = /^\d+\.\d+\.\d+$/

const VersionSpecifier = z.union([
  z.literal('patch'),
  z.literal('minor'),
  z.literal('major'),
  z.string().regex(explicitVersionRegex, 'Must be x.y.z format'),
])

type VersionSpecifier = z.infer<typeof VersionSpecifier>

function isExplicitVersion(value: string): boolean {
  return explicitVersionRegex.test(value)
}

function getCurrentPublishedVersion(packageName: string): string {
  const result = spawnSync('npm', ['view', packageName, 'version'], {
    encoding: 'utf-8',
  })
  if (result.status !== 0 || !result.stdout.trim()) {
    return '0.0.0'
  }
  return result.stdout.trim()
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

export async function publish(
  packageJson: PackageJson,
  packageName: string,
  versionSpecifier: VersionSpecifier,
  outputDir: string
): Promise<void> {
  if (isExplicitVersion(versionSpecifier)) {
    await writePackageJson({ ...packageJson, version: versionSpecifier }, outputDir)
  } else {
    const currentVersion = getCurrentPublishedVersion(packageName)
    await writePackageJson({ ...packageJson, version: currentVersion }, outputDir)

    // --no-git-tag-version: bump version in package.json only, without creating a git tag (we're in a temp directory, not a git repo)
    const npmVersionResult = spawnSync('npm', ['version', versionSpecifier, '--no-git-tag-version'], {
      cwd: outputDir,
      stdio: 'inherit',
    })
    if (npmVersionResult.status !== 0) {
      throw new Error(`npm version failed with exit code ${String(npmVersionResult.status ?? 1)}`)
    }
  }

  const npmPublishResult = spawnSync('npm', ['publish'], { cwd: outputDir, stdio: 'inherit' })
  if (npmPublishResult.status !== 0) {
    throw new Error(`npm publish failed with exit code ${String(npmPublishResult.status ?? 1)}`)
  }
}
