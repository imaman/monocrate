import * as fs from 'node:fs'
import * as path from 'node:path'
import type { DependencyGraph, MonorepoPackage, PackageLocation, PackageMap } from './types.js'

const DEFAULT_MAIN = 'dist/index.js'

function getDistDir(main: string | undefined): string {
  const mainPath = main ?? DEFAULT_MAIN
  const dir = path.dirname(mainPath)
  return dir || 'dist'
}

function getEntryPoint(main: string | undefined): string {
  return main ?? DEFAULT_MAIN
}

function createMainPackageLocation(pkg: MonorepoPackage): PackageLocation {
  const distDir = getDistDir(pkg.packageJson.main)
  const entryPoint = getEntryPoint(pkg.packageJson.main)

  return {
    name: pkg.name,
    sourceDistDir: path.resolve(pkg.path, distDir),
    outputDistDir: distDir,
    outputEntryPoint: entryPoint,
    resolveSubpath(subpath: string): string {
      return path.join(distDir, subpath)
    },
  }
}

function createDependencyLocation(pkg: MonorepoPackage, monorepoRoot: string): PackageLocation {
  const distDir = getDistDir(pkg.packageJson.main)
  const entryPoint = getEntryPoint(pkg.packageJson.main)
  const depsPrefix = path.join('deps', path.relative(monorepoRoot, pkg.path))

  return {
    name: pkg.name,
    sourceDistDir: path.resolve(pkg.path, distDir),
    outputDistDir: path.join(depsPrefix, distDir),
    outputEntryPoint: path.join(depsPrefix, entryPoint),
    resolveSubpath(subpath: string): string {
      return path.join(depsPrefix, distDir, subpath)
    },
  }
}

function validatePackageLocation(location: PackageLocation): void {
  if (!fs.existsSync(location.sourceDistDir)) {
    throw new Error(
      `dist directory not found at ${location.sourceDistDir}. Did you run the build for ${location.name}?`
    )
  }
}

export function buildPackageMap(graph: DependencyGraph, monorepoRoot: string): PackageMap {
  const packageMap: PackageMap = new Map()

  const mainLocation = createMainPackageLocation(graph.packageToBundle)
  packageMap.set(graph.packageToBundle.name, mainLocation)
  validatePackageLocation(mainLocation)

  for (const dep of graph.inRepoDeps) {
    const depLocation = createDependencyLocation(dep, monorepoRoot)
    packageMap.set(dep.name, depLocation)
    validatePackageLocation(depLocation)
  }

  return packageMap
}
