import * as fs from 'node:fs'
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

interface PackageLocationInput {
  pkg: MonorepoPackage
  monorepoRoot: string
  isPackageToBundle: boolean
}

function createPackageLocation(input: PackageLocationInput): PackageLocation {
  const { pkg, monorepoRoot, isPackageToBundle } = input
  const distDir = getDistDir(pkg.packageJson.main)
  const entryPoint = getEntryPoint(pkg.packageJson.main)
  const monorepoRelativePath = path.relative(monorepoRoot, pkg.path)

  const sourceDistDir = path.resolve(pkg.path, distDir)

  const outputDistDir = isPackageToBundle ? distDir : path.join('deps', monorepoRelativePath, distDir)

  const outputEntryPoint = isPackageToBundle ? entryPoint : path.join('deps', monorepoRelativePath, entryPoint)

  return {
    name: pkg.name,
    sourceDistDir,
    outputDistDir,
    outputEntryPoint,
    resolveSubpath(subpath: string): string {
      return isPackageToBundle ? path.join(distDir, subpath) : path.join('deps', monorepoRelativePath, distDir, subpath)
    },
  }
}

interface ValidationError {
  packageName: string
  message: string
}

function validatePackageLocation(location: PackageLocation): ValidationError | null {
  if (!fs.existsSync(location.sourceDistDir)) {
    return {
      packageName: location.name,
      message: `dist directory not found at ${location.sourceDistDir}. Did you run the build for ${location.name}?`,
    }
  }
  return null
}

export interface BuildPackageMapResult {
  packageMap: PackageMap
  errors: ValidationError[]
}

export function buildPackageMap(graph: DependencyGraph, monorepoRoot: string): BuildPackageMapResult {
  const packageMap: PackageMap = new Map()
  const errors: ValidationError[] = []

  const mainLocation = createPackageLocation({
    pkg: graph.packageToBundle,
    monorepoRoot,
    isPackageToBundle: true,
  })
  packageMap.set(graph.packageToBundle.name, mainLocation)

  const mainError = validatePackageLocation(mainLocation)
  if (mainError) {
    errors.push(mainError)
  }

  for (const dep of graph.inRepoDeps) {
    const depLocation = createPackageLocation({
      pkg: dep,
      monorepoRoot,
      isPackageToBundle: false,
    })
    packageMap.set(dep.name, depLocation)

    const depError = validatePackageLocation(depLocation)
    if (depError) {
      errors.push(depError)
    }
  }

  return { packageMap, errors }
}
