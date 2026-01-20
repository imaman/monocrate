import * as path from 'node:path'
import type { PackageMap } from './package-map.js'
import type { DependencyGraph } from './build-dependency-graph.js'
import type { MonorepoPackage } from './monorepo.js'
import { getFilesToPack } from './get-files-to-pack.js'

const DEFAULT_ENTRY_POINT = 'dist/index.js'

function resolveEntryPoint(main: string | undefined): string {
  return main ?? DEFAULT_ENTRY_POINT
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
      return path.join(outputPrefix, subpath)
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
