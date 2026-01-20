import * as path from 'node:path'
import * as ResolveExports from 'resolve.exports'
import type { PackageMap } from './package-map.js'
import type { DependencyGraph } from './build-dependency-graph.js'
import type { MonorepoPackage } from './monorepo.js'
import { getFilesToPack } from './get-files-to-pack.js'

const DEFAULT_ENTRY_POINT = 'dist/index.js'

function resolveEntryPoint(main: string | undefined): string {
  return main ?? DEFAULT_ENTRY_POINT
}

function resolveSubpathImport(packageJson: Record<string, unknown>, outputPrefix: string, subpath: string): string {
  // Try exports field resolution (resolve.exports only handles the exports field, not main)
  const resolved = ResolveExports.resolve(packageJson, `./${subpath}`)
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
  // Fallback: subpath relative to package root (Node.js semantics when no exports field)
  return path.join(outputPrefix, `${subpath}.js`)
}

function registerPackageLocation(packageMap: PackageMap, pkg: MonorepoPackage, outputPrefix: string): void {
  const filesToCopy = getFilesToPack(pkg.path)

  packageMap.set(pkg.name, {
    name: pkg.name,
    packageDir: pkg.path,
    outputPrefix,
    filesToCopy,
    outputEntryPoint: path.join(outputPrefix, resolveEntryPoint(pkg.packageJson.main)),
    resolveSubpath(subpath: string): string {
      return resolveSubpathImport(pkg.packageJson, outputPrefix, subpath)
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
