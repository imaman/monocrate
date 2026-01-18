import * as path from 'node:path'
import type { DependencyGraph, MonorepoPackage, PackageLocation, PackageMap } from './types.js'

function getDistDir(main: string | undefined): string {
  const mainPath = main ?? 'dist/index.js'
  const dir = path.dirname(mainPath)
  return dir || 'dist'
}

function getEntryPoint(main: string | undefined): string {
  return main ?? 'dist/index.js'
}

function createPackageLocation(
  pkg: MonorepoPackage,
  monorepoRoot: string,
  isPackageToBundle: boolean
): PackageLocation {
  return {
    name: pkg.name,
    monorepoRelativePath: path.relative(monorepoRoot, pkg.path),
    entryPoint: getEntryPoint(pkg.packageJson.main),
    distDir: getDistDir(pkg.packageJson.main),
    isPackageToBundle,
  }
}

export function buildPackageMap(graph: DependencyGraph, monorepoRoot: string): PackageMap {
  const packageMap: PackageMap = new Map()

  packageMap.set(graph.packageToBundle.name, createPackageLocation(graph.packageToBundle, monorepoRoot, true))

  for (const dep of graph.inRepoDeps) {
    packageMap.set(dep.name, createPackageLocation(dep, monorepoRoot, false))
  }

  return packageMap
}
