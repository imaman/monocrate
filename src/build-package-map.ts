import * as fs from 'node:fs'
import * as path from 'node:path'
import type { DependencyGraph, MonorepoPackage, PackageLocation, PackageMap } from './types.js'

const DEFAULT_DIST_DIR = 'dist'
const DEFAULT_ENTRY_POINT = 'dist/index.js'

function getDistDir(main: string | undefined): string {
  if (main === undefined) {
    return DEFAULT_DIST_DIR
  }
  const dir = path.dirname(main)
  return dir === '' || dir === '.' ? DEFAULT_DIST_DIR : dir
}

function getEntryPoint(main: string | undefined): string {
  return main ?? DEFAULT_ENTRY_POINT
}

function createPackageLocation(pkg: MonorepoPackage, outputPrefix: string): PackageLocation {
  const distDir = getDistDir(pkg.packageJson.main)
  const entryPoint = getEntryPoint(pkg.packageJson.main)
  const outputDistDir = path.join(outputPrefix, distDir)

  return {
    name: pkg.name,
    sourceDistDir: path.resolve(pkg.path, distDir),
    outputDistDir,
    outputEntryPoint: path.join(outputPrefix, entryPoint),
    resolveSubpath(subpath: string): string {
      return path.join(outputDistDir, subpath)
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

  const mainLocation = createPackageLocation(graph.packageToBundle, '')
  packageMap.set(graph.packageToBundle.name, mainLocation)
  validatePackageLocation(mainLocation)

  for (const dep of graph.inRepoDeps) {
    const outputPrefix = path.join('deps', path.relative(monorepoRoot, dep.path))
    const depLocation = createPackageLocation(dep, outputPrefix)
    packageMap.set(dep.name, depLocation)
    validatePackageLocation(depLocation)
  }

  return packageMap
}
