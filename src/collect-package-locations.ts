import * as path from 'node:path'
import * as ResolveExports from 'resolve.exports'
import type { PackageLocation } from './package-map.js'
import type { DependencyGraph } from './build-dependency-graph.js'
import type { MonorepoPackage } from './monorepo.js'
import { getFilesToPack } from './get-files-to-pack.js'

/**
 * Resolves an import specifier to a file path using Node.js resolution semantics.
 * Handles both bare imports (subpath='') and subpath imports (subpath='utils/helper').
 */
export function resolveImport(location: PackageLocation, subpath: string): string {
  const entry = subpath === '' ? '.' : `./${subpath}`

  // Try exports field resolution (resolve.exports only handles the exports field, not main)
  const resolved = ResolveExports.resolve(location.packageJson, entry)
  if (resolved) {
    // The exports field can map to an array of fallback paths. Node.js tries them in order and uses
    // the first "processable" path (e.g., skips unsupported protocols), but does NOT fall back if the
    // file is missing. Picking the first entry matches Node.js behavior.
    // See: https://nodejs.org/api/packages.html#package-entry-points
    const resolvedPath = Array.isArray(resolved) ? resolved[0] : resolved
    if (resolvedPath !== undefined) {
      // The resolved path starts with './', remove it
      const cleanPath = resolvedPath.startsWith('./') ? resolvedPath.slice(2) : resolvedPath
      return path.join(location.outputPrefix, cleanPath)
    }
  }

  // No exports field or no matching export
  if (subpath === '') {
    // Bare import (e.g., import ... from '@myorg/pkg'): use main field, then index.js (Node.js default)
    return path.join(location.outputPrefix, location.packageJson.main ?? 'index.js')
  }
  // Subpath import (e.g., import ... from '@myorg/pkg/utils/helper'): subpath relative to package root
  return path.join(location.outputPrefix, `${subpath}.js`)
}

function createPackageLocation(pkg: MonorepoPackage, outputPrefix: string) {
  const filesToCopy = getFilesToPack(pkg.path)

  return {
    name: pkg.name,
    packageDir: pkg.path,
    outputPrefix,
    filesToCopy,
    packageJson: pkg.packageJson,
  }
}

function computeDepOutputPrefix(dep: MonorepoPackage, monorepoRoot: string): string {
  return path.join('deps', path.relative(monorepoRoot, dep.path))
}

export function collectPackageLocations(graph: DependencyGraph, monorepoRoot: string) {
  return graph.inRepoDeps.map((dep) =>
    createPackageLocation(dep, dep === graph.subjectPackage ? '' : computeDepOutputPrefix(dep, monorepoRoot))
  )
}
