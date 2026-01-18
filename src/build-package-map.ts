import * as fs from 'node:fs'
import * as path from 'node:path'
import type { PackageMap } from './types.js'
import type { DependencyGraph } from './build-dependency-graph.js'
import type { MonorepoPackage } from './monorepo.js'

const DEFAULT_DIST_DIR = 'dist'
const DEFAULT_ENTRY_POINT = 'dist/index.js'

function resolveDistDir(main: string | undefined): string {
  if (main === undefined) {
    return DEFAULT_DIST_DIR
  }
  const dir = path.dirname(main)
  return dir === '' || dir === '.' ? DEFAULT_DIST_DIR : dir
}

function resolveEntryPoint(main: string | undefined): string {
  return main ?? DEFAULT_ENTRY_POINT
}

function registerPackageLocation(packageMap: PackageMap, pkg: MonorepoPackage, outputPrefix: string): void {
  const distDir = resolveDistDir(pkg.packageJson.main)
  const sourceDistDir = path.resolve(pkg.path, distDir)

  if (!fs.existsSync(sourceDistDir)) {
    throw new Error(`dist directory not found at ${sourceDistDir}. Did you run the build for ${pkg.name}?`)
  }

  const outputDistDir = path.join(outputPrefix, distDir)

  packageMap.set(pkg.name, {
    name: pkg.name,
    sourceDistDir,
    outputDistDir,
    outputEntryPoint: path.join(outputPrefix, resolveEntryPoint(pkg.packageJson.main)),
    resolveSubpath(subpath: string): string {
      return path.join(outputDistDir, subpath)
    },
  })
}

function computeDepOutputPrefix(dep: MonorepoPackage, monorepoRoot: string): string {
  return path.join('deps', path.relative(monorepoRoot, dep.path))
}

export function buildPackageMap(graph: DependencyGraph, monorepoRoot: string): PackageMap {
  const packageMap: PackageMap = new Map()

  registerPackageLocation(packageMap, graph.packageToBundle, '')

  for (const dep of graph.inRepoDeps) {
    registerPackageLocation(packageMap, dep, computeDepOutputPrefix(dep, monorepoRoot))
  }

  return packageMap
}
