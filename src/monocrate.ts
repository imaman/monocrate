import * as fs from 'node:fs/promises'
import * as fsSync from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { findMonorepoRoot } from './monorepo.js'
import { computePackageClosure } from './compute-package-closure.js'
import { assemble } from './assemble.js'
import { publish } from './publish.js'
import { parseVersionSpecifier } from './version-specifier.js'
import { resolveVersionForPackages } from './resolve-version.js'
import { AbsolutePath } from './paths.js'
import type { PackageClosure } from './package-closure.js'

export interface MonocrateOptions {
  /**
   * Path(s) to the package directory(ies) to assemble.
   * Can be a single path or an array of paths.
   * Paths can be absolute or relative. Relative paths are resolved from the cwd option.
   * When multiple packages are specified, they are all published with a shared version
   * (the highest current version among them, with the version specifier applied).
   */
  pathToSubjectPackages: string | string[]
  /**
   * Path to the output directory where the assembly will be written.
   * Can be absolute or relative. Relative paths are resolved from the cwd option.
   * When multiple packages are specified, each package gets its own subdirectory under this path.
   * If not specified, a dedicated temp directory is created under the system temp directory for each package.
   */
  outputDir?: string
  /**
   * Path to the monorepo root directory.
   * Can be absolute or relative. Relative paths are resolved from the cwd option.
   * If not specified, auto-detected by searching for a root package.json with workspaces.
   */
  monorepoRoot?: string
  /**
   * Publish the assembly to npm after building.
   * Accepts either an explicit semver version (e.g., "1.2.3") or an increment keyword ("patch", "minor", "major").
   * When specified, the assembly is published to npm with the resolved version.
   * When multiple packages are specified, all packages are published with the same resolved version.
   * If not specified, no publishing occurs.
   */
  publishToVersion?: string
  /**
   * Path to write the output (resolved version) to a file instead of stdout.
   * Can be absolute or relative. Relative paths are resolved from the cwd option.
   * If not specified, output is written to stdout.
   */
  outputFile?: string
  /**
   * Base directory for resolving relative paths. Must be a valid, existing directory.
   */
  cwd: string
}

/**
 * Result for a single package assembly.
 */
export interface PackageResult {
  /**
   * The name of the package that was assembled.
   */
  packageName: string
  /**
   * The output directory path where this package's assembly was created.
   */
  outputDir: string
}

export interface MonocrateResult {
  /**
   * Results for each package that was assembled.
   * When a single package is assembled, this array contains one element.
   */
  packages: PackageResult[]
  /**
   * The output directory path where the assembly was created.
   * When multiple packages are assembled, this is the parent directory containing all package outputs.
   * When a single package is assembled, this is the direct output directory.
   */
  outputDir: string
  /**
   * The new version (AKA: 'resolved version') for the package(s).
   * When multiple packages are assembled, all packages share this version.
   * Undefined when publishToVersion was not specified.
   */
  resolvedVersion: string | undefined
}

/**
 * Derives a safe directory name from a package name.
 * Converts scoped packages like @org/name to org-name.
 */
function packageNameToDirectoryName(packageName: string): string {
  return packageName.replace(/^@/, '').replace(/\//g, '-')
}

interface PackageInfo {
  sourceDir: AbsolutePath
  closure: PackageClosure
  outputDir: AbsolutePath
}

/**
 * Assembles one or more monorepo packages and their in-repo dependencies for npm publishing.
 * When multiple packages are specified, they are all published with a shared version
 * derived from the highest current version among them.
 *
 * @param options - Configuration options for the assembly process
 * @returns The result of the assembly operation
 * @throws Error if assembly or publishing fails
 */
export async function monocrate(options: MonocrateOptions): Promise<MonocrateResult> {
  // Resolve and validate cwd first, then use it to resolve all other paths
  const cwd = AbsolutePath(path.resolve(options.cwd))
  const cwdExists = await fs
    .stat(cwd)
    .then(() => true)
    .catch(() => false)
  if (!cwdExists) {
    throw new Error(`cwd does not exist: ${cwd}`)
  }

  // Normalize to array
  const pathsToPackages = Array.isArray(options.pathToSubjectPackages)
    ? options.pathToSubjectPackages
    : [options.pathToSubjectPackages]

  if (pathsToPackages.length === 0) {
    throw new Error('At least one package path must be specified')
  }

  const sourceDirs = pathsToPackages.map((p) => AbsolutePath(path.resolve(cwd, p)))

  // Use the first package's location to determine monorepo root if not specified
  const monorepoRoot = options.monorepoRoot
    ? AbsolutePath(path.resolve(cwd, options.monorepoRoot))
    : findMonorepoRoot(sourceDirs[0]!)

  // Validate publish argument before any side effects
  const versionSpecifier = parseVersionSpecifier(options.publishToVersion)

  // Compute closures for all packages (needed to get package names and for assembly)
  const closures = await Promise.all(sourceDirs.map((sourceDir) => computePackageClosure(sourceDir, monorepoRoot)))

  // Determine output directories for each package
  const isMultiPackage = sourceDirs.length > 1
  const baseOutputDir = options.outputDir ? AbsolutePath(path.resolve(cwd, options.outputDir)) : undefined

  const packageInfos: PackageInfo[] = await Promise.all(
    sourceDirs.map(async (sourceDir, index) => {
      const closure = closures[index]!
      let outputDir: AbsolutePath

      if (baseOutputDir) {
        if (isMultiPackage) {
          // Multiple packages: each gets a subdirectory under the base output dir
          outputDir = AbsolutePath(path.join(baseOutputDir, packageNameToDirectoryName(closure.subjectPackageName)))
        } else {
          // Single package: use the base output dir directly
          outputDir = baseOutputDir
        }
      } else {
        // No output dir specified: create a temp directory for each package
        outputDir = AbsolutePath(await fs.mkdtemp(path.join(os.tmpdir(), 'monocrate-')))
      }

      return { sourceDir, closure, outputDir }
    })
  )

  // Resolve the shared version for all packages
  let resolvedVersion: string | undefined
  if (versionSpecifier) {
    resolvedVersion = await resolveVersionForPackages(
      packageInfos.map((info) => ({
        dir: info.sourceDir,
        packageName: info.closure.subjectPackageName,
      })),
      versionSpecifier
    )
  }

  // Assemble all packages (fail-fast: if any fails, stop immediately)
  for (const info of packageInfos) {
    await assemble(info.closure, info.outputDir, versionSpecifier, {
      preComputedVersion: resolvedVersion,
    })
  }

  // Publish all packages (fail-fast: if any fails, stop immediately)
  if (versionSpecifier) {
    for (const info of packageInfos) {
      publish(info.outputDir, monorepoRoot)
    }
  }

  // Output resolved version
  if (resolvedVersion !== undefined) {
    if (options.outputFile) {
      const outputFilePath = path.resolve(cwd, options.outputFile)
      fsSync.writeFileSync(outputFilePath, resolvedVersion)
    } else {
      console.log(resolvedVersion)
    }
  }

  // Build result
  const packages: PackageResult[] = packageInfos.map((info) => ({
    packageName: info.closure.subjectPackageName,
    outputDir: info.outputDir,
  }))

  // For outputDir in result: use base output dir if provided, otherwise first package's output dir
  const resultOutputDir = baseOutputDir ?? packageInfos[0]!.outputDir

  return { packages, outputDir: resultOutputDir, resolvedVersion }
}
