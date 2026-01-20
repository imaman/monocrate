import * as fs from 'node:fs'
import * as path from 'node:path'
import type { PackageMap } from './package-map.js'
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

function resolveFilesToCopy(pkg: MonorepoPackage): string[] {
  const files = pkg.packageJson.files
  if (files !== undefined && files.length > 0) {
    return files
  }
  // Fall back to dist directory derived from main
  return [resolveDistDir(pkg.packageJson.main)]
}

function validateFilesToCopy(packageDir: string, filesToCopy: string[], packageName: string): void {
  const existingFiles = filesToCopy.filter((file) => fs.existsSync(path.resolve(packageDir, file)))

  if (existingFiles.length === 0) {
    const triedPaths = filesToCopy.map((f) => path.resolve(packageDir, f)).join(', ')
    throw new Error(`No files to copy found for ${packageName}. Tried: ${triedPaths}. Did you run the build?`)
  }
}

function registerPackageLocation(packageMap: PackageMap, pkg: MonorepoPackage, outputPrefix: string): void {
  const packageDir = path.resolve(pkg.path)
  const filesToCopy = resolveFilesToCopy(pkg)
  const distDir = resolveDistDir(pkg.packageJson.main)
  const outputDistDir = path.join(outputPrefix, distDir)

  validateFilesToCopy(packageDir, filesToCopy, pkg.name)

  packageMap.set(pkg.name, {
    name: pkg.name,
    packageDir,
    outputPrefix,
    filesToCopy,
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

  registerPackageLocation(packageMap, graph.subjectPackage, '')

  for (const dep of graph.inRepoDeps) {
    registerPackageLocation(packageMap, dep, computeDepOutputPrefix(dep, monorepoRoot))
  }

  return packageMap
}
