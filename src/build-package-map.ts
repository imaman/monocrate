import * as path from 'node:path'
import * as ResolveExports from 'resolve.exports'
import type { PackageMap } from './package-map.js'
import type { DependencyGraph } from './build-dependency-graph.js'
import type { MonorepoPackage } from './monorepo.js'
import { getFilesToPack } from './get-files-to-pack.js'
import type { PackageJson } from './package-json.js'

/**
 * Resolves an import specifier to a file path using Node.js resolution semantics.
 * Handles both bare imports (subpath='') and subpath imports (subpath='utils/helper').
 */
function resolveImport(packageJson: PackageJson, outputPrefix: string, subpath: string): string {
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
      // The resolved path starts with './', remove it
      const cleanPath = resolvedPath.startsWith('./') ? resolvedPath.slice(2) : resolvedPath
      return path.join(outputPrefix, cleanPath)
    }
  }

  // Fallback when no exports field (or no matching export):
  // - Bare import: use main field, then index.js (Node.js default)
  // - Subpath import: subpath relative to package root
  if (subpath === '') {
    return path.join(outputPrefix, packageJson.main ?? 'index.js')
  }
  return path.join(outputPrefix, `${subpath}.js`)
}

function registerPackageLocation(packageMap: PackageMap, pkg: MonorepoPackage, outputPrefix: string): void {
  const filesToCopy = getFilesToPack(pkg.path)

  packageMap.set(pkg.name, {
    name: pkg.name,
    packageDir: pkg.path,
    outputPrefix,
    filesToCopy,
    outputEntryPoint: resolveImport(pkg.packageJson, outputPrefix, ''),
    resolveSubpath(subpath: string): string {
      return resolveImport(pkg.packageJson, outputPrefix, subpath)
    },
  })
}

function computeDepOutputPrefix(dep: MonorepoPackage, monorepoRoot: string): string {
  return path.join('deps', path.relative(monorepoRoot, dep.path))
}

export function buildPackageMap(graph: DependencyGraph, monorepoRoot: string): PackageMap {
  const packageMap: PackageMap = new Map()

  registerPackageLocation(packageMap, graph.subjectPackage, '')

  for (const dep of graph.inRepoDeps) {
    registerPackageLocation(packageMap, dep, computeDepOutputPrefix(dep, monorepoRoot))
  }

  return packageMap
}
