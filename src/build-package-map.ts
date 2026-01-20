import * as fs from 'node:fs'
import * as path from 'node:path'
import type { PackageMap } from './package-map.js'
import type { DependencyGraph } from './build-dependency-graph.js'
import type { MonorepoPackage } from './monorepo.js'

const DEFAULT_ENTRY_POINT = 'dist/index.js'

/**
 * Resolves the dist directory from the main field.
 * Returns undefined if main is not specified or is at the root level.
 */
function resolveDistDirFromMain(main: string | undefined): string | undefined {
  if (main === undefined) {
    return undefined
  }
  const dir = path.dirname(main)
  return dir === '' || dir === '.' ? undefined : dir
}

function resolveEntryPoint(main: string | undefined): string {
  return main ?? DEFAULT_ENTRY_POINT
}

/**
 * Determines which files/directories to copy based on package.json.
 * Uses npm's `files` field semantics:
 * 1. If `files` is specified, use those entries
 * 2. Otherwise, derive from `main` field's directory
 * 3. If neither provides useful info, throw an error
 */
function resolveFilesToCopy(pkg: MonorepoPackage): string[] {
  const { files, main } = pkg.packageJson

  // If files is explicitly specified, use it
  if (files !== undefined && files.length > 0) {
    return files
  }

  // Try to derive from main field
  const distDir = resolveDistDirFromMain(main)
  if (distDir !== undefined) {
    return [distDir]
  }

  // Cannot determine what to copy
  throw new Error(
    `Cannot determine which files to copy for ${pkg.name}. ` +
      `Either specify a "files" array in package.json, or ensure "main" points to a subdirectory (e.g., "dist/index.js").`
  )
}

function validateFilesToCopy(packageDir: string, filesToCopy: string[], packageName: string): void {
  const existingFiles = filesToCopy.filter((file) => fs.existsSync(path.join(packageDir, file)))

  if (existingFiles.length === 0) {
    const triedPaths = filesToCopy.map((f) => path.join(packageDir, f)).join(', ')
    throw new Error(`No files to copy found for ${packageName}. Tried: ${triedPaths}. Did you run the build?`)
  }
}

function registerPackageLocation(packageMap: PackageMap, pkg: MonorepoPackage, outputPrefix: string): void {
  const packageDir = path.resolve(pkg.path)
  const filesToCopy = resolveFilesToCopy(pkg)
  const distDir = resolveDistDirFromMain(pkg.packageJson.main) ?? 'dist'
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
