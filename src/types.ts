import type { PackageJson } from './package-json.js'

export interface MonorepoPackage {
  name: string
  path: string
  packageJson: PackageJson
}

export interface DependencyGraph {
  packageToBundle: MonorepoPackage
  inRepoDeps: MonorepoPackage[]
  allThirdPartyDeps: Record<string, string>
}

export interface BundleOptions {
  sourceDir: string
  outputDir: string
  monorepoRoot: string
}

export type BundleResult = { success: true; outputDir: string } | { success: false; error: string }

export interface PackageLocation {
  name: string
  sourceDistDir: string
  outputDistDir: string
  outputEntryPoint: string
  resolveSubpath(subpath: string): string
}

export type PackageMap = Map<string, PackageLocation>
