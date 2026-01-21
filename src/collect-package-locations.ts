import * as ResolveExports from 'resolve.exports'
import type { PackageLocation } from './package-location.js'
import type { PackageClosure } from './package-closure.js'
import type { MonorepoPackage } from './monorepo.js'
import { getFilesToPack } from './get-files-to-pack.js'
import { AbsolutePath, PathInRepo } from './paths.js'
import type { PackageJson } from './package-json.js'

/**
 * Resolves an import specifier to a package-relative path using Node.js resolution semantics.
 * Handles both bare imports (subpath='') and subpath imports (subpath='utils/helper').
 */
export function resolveImport(packageJson: PackageJson, subpath: string): string {
  const entry = subpath === '' ? '.' : `./${subpath}`

  // Try exports field resolution (resolve.exports only handles the exports field, not main)
  const resolved = ResolveExports.resolve(packageJson, entry)
  if (resolved) {
    // The exports field can map to an array of fallback paths. Node.js tries them in order and uses
    // the first "processable" path (e.g., skips unsupported protocols), but does NOT fall back if the
    // file is missing. Picking the first entry matches Node.js behavior.
    // See: https://nodejs.org/api/packages.html#package-entry-points
    const resolvedPath = Array.isArray(resolved) ? resolved[0] : resolved
    if (resolvedPath !== undefined) {
      // If the resolved path starts with './', remove it
      return resolvedPath.startsWith('./') ? resolvedPath.slice(2) : resolvedPath
    }
  }

  // Otherwise (no exports field or no matching export) -
  if (subpath === '') {
    // Bare import (e.g., import ... from '@myorg/pkg'): use main field, then index.js (Node.js default)
    return packageJson.main ?? 'index.js'
  }
  // Subpath import (e.g., import ... from '@myorg/pkg/utils/helper'): subpath relative to package root
  return `${subpath}.js`
}

async function createPackageLocation(pkg: MonorepoPackage, directoryInOutput: AbsolutePath): Promise<PackageLocation> {
  const filesToCopy = await getFilesToPack(pkg.path)

  return {
    name: pkg.name,
    fromDir: pkg.path,
    toDir: directoryInOutput,
    filesToCopy,
    packageJson: pkg.packageJson,
  }
}

export async function collectPackageLocations(
  closure: PackageClosure,
  outputDir: AbsolutePath
): Promise<PackageLocation[]> {
  // TODO(imaman): use promises()
  return Promise.all(
    closure.members.map((dep) =>
      createPackageLocation(
        dep,
        dep.name === closure.subjectPackageName
          ? outputDir
          : AbsolutePath.join(outputDir, PathInRepo('deps'), dep.pathInRepo)
      )
    )
  )
}
