import * as fs from 'node:fs/promises'
import * as fsSync from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { findMonorepoRoot } from './monorepo.js'
import { computePackageClosure } from './compute-package-closure.js'
import { assemble } from './assemble.js'
import { publish } from './publish.js'
import { parseVersionSpecifier, type VersionSpecifier } from './version-specifier.js'
import { AbsolutePath, RelativePath } from './paths.js'
import { manglePackageName } from './name-mangler.js'
import { findMaxVersion, applyVersionIncrement } from './resolve-version.js'
import type { PackageClosure } from './package-closure.js'

export interface MonocrateOptions {
  /**
   * Path to the package directory to assemble.
   * Can be absolute or relative. Relative paths are resolved from the cwd option.
   */
  pathToSubjectPackage: string
  /**
   * Path to the output root directory where the assembly will be written.
   * The actual output will be placed in a subdirectory named after the package.
   * Can be absolute or relative. Relative paths are resolved from the cwd option.
   * If not specified, a dedicated temp directory is created under the system temp directory.
   */
  outputRoot?: string
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

export interface MonocrateResult {
  /**
   * The output directory path where the assembly was created.
   */
  outputDir: string
  /**
   * The new version (AKA: 'resolved version') for the package.
   * Undefined when publishToVersion was not specified.
   */
  resolvedVersion: string | undefined
}

/**
 * Assembles a monorepo package and its in-repo dependencies for npm publishing.
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

  const sourceDir = AbsolutePath(path.resolve(cwd, options.pathToSubjectPackage))
  const monorepoRoot = options.monorepoRoot
    ? AbsolutePath(path.resolve(cwd, options.monorepoRoot))
    : findMonorepoRoot(sourceDir)

  // Validate publish argument before any side effects
  const versionSpecifier = parseVersionSpecifier(options.publishToVersion)

  const outputRoot = AbsolutePath(
    options.outputRoot ? path.resolve(cwd, options.outputRoot) : await fs.mkdtemp(path.join(os.tmpdir(), 'monocrate-'))
  )

  const closure = await computePackageClosure(sourceDir, monorepoRoot)
  const outputDir = AbsolutePath.join(outputRoot, RelativePath(manglePackageName(closure.subjectPackageName)))
  const resolvedVersion = await assemble(closure, outputDir, versionSpecifier)

  if (versionSpecifier) {
    await publish(outputDir, monorepoRoot)
  }

  if (resolvedVersion !== undefined) {
    if (options.outputFile) {
      const outputFilePath = path.resolve(cwd, options.outputFile)
      fsSync.writeFileSync(outputFilePath, resolvedVersion)
    } else {
      console.log(resolvedVersion)
    }
  }

  return { outputDir, resolvedVersion }
}

export interface MonocrateMultipleOptions {
  /**
   * Array of paths to package directories to assemble.
   * Each path can be absolute or relative. Relative paths are resolved from the cwd option.
   */
  pathsToSubjectPackages: readonly string[]
  /**
   * Path to the output root directory where all assemblies will be written.
   * Each package will be placed in a subdirectory named after the package.
   * Can be absolute or relative. Relative paths are resolved from the cwd option.
   * If not specified, a dedicated temp directory is created under the system temp directory.
   */
  outputRoot?: string
  /**
   * Path to the monorepo root directory.
   * Can be absolute or relative. Relative paths are resolved from the cwd option.
   * If not specified, auto-detected by searching for a root package.json with workspaces.
   */
  monorepoRoot?: string
  /**
   * Publish all assemblies to npm after building.
   * Accepts either an explicit semver version (e.g., "1.2.3") or an increment keyword ("patch", "minor", "major").
   * For increments, the version is determined by finding the maximum current version across all packages
   * and applying the increment to it. All packages are published with this shared version.
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

export interface PackageResult {
  /**
   * The name of the package that was processed.
   */
  packageName: string
  /**
   * The output directory path where the assembly was created.
   */
  outputDir: string
}

export interface MonocrateMultipleResult {
  /**
   * Results for each package that was processed, in the same order as the input.
   */
  packages: PackageResult[]
  /**
   * The shared resolved version used for all packages.
   * Undefined when publishToVersion was not specified.
   */
  resolvedVersion: string | undefined
}

interface PreparedPackage {
  sourceDir: AbsolutePath
  closure: PackageClosure
  outputDir: AbsolutePath
}

/**
 * Assembles multiple monorepo packages and their in-repo dependencies for npm publishing.
 * All packages share the same version, derived from the highest current version among them.
 * @param options - Configuration options for the assembly process
 * @returns The result of the assembly operation for all packages
 * @throws Error if assembly or publishing fails for any package (fail-fast)
 */
export async function monocrateMultiple(options: MonocrateMultipleOptions): Promise<MonocrateMultipleResult> {
  if (options.pathsToSubjectPackages.length === 0) {
    throw new Error('At least one package path must be specified')
  }

  // Resolve and validate cwd first
  const cwd = AbsolutePath(path.resolve(options.cwd))
  const cwdExists = await fs
    .stat(cwd)
    .then(() => true)
    .catch(() => false)
  if (!cwdExists) {
    throw new Error(`cwd does not exist: ${cwd}`)
  }

  // Validate publish argument before any side effects
  const versionSpecifier = parseVersionSpecifier(options.publishToVersion)

  // Resolve source directories
  const sourceDirs = options.pathsToSubjectPackages.map((p) => AbsolutePath(path.resolve(cwd, p)))
  const firstSourceDir = sourceDirs[0]
  if (firstSourceDir === undefined) {
    throw new Error('At least one package path must be specified')
  }

  // Find monorepo root (use first package to detect if not specified)
  const monorepoRoot = options.monorepoRoot
    ? AbsolutePath(path.resolve(cwd, options.monorepoRoot))
    : findMonorepoRoot(firstSourceDir)

  // Create output root
  const outputRoot = AbsolutePath(
    options.outputRoot ? path.resolve(cwd, options.outputRoot) : await fs.mkdtemp(path.join(os.tmpdir(), 'monocrate-'))
  )

  // Build closures for all packages
  const preparedPackages: PreparedPackage[] = await Promise.all(
    sourceDirs.map(async (sourceDir) => {
      const closure = await computePackageClosure(sourceDir, monorepoRoot)
      const outputDir = AbsolutePath.join(outputRoot, RelativePath(manglePackageName(closure.subjectPackageName)))
      return { sourceDir, closure, outputDir }
    })
  )

  // Resolve shared version
  let resolvedVersion: string | undefined
  let explicitVersionSpecifier: VersionSpecifier | undefined

  if (versionSpecifier) {
    if (versionSpecifier.tag === 'explicit') {
      resolvedVersion = versionSpecifier.value
    } else {
      // Find max version across all packages and apply increment
      const maxVersion = await findMaxVersion(
        preparedPackages.map((p) => ({
          dir: p.sourceDir,
          packageName: p.closure.subjectPackageName,
        }))
      )
      resolvedVersion = applyVersionIncrement(maxVersion, versionSpecifier)
    }
    explicitVersionSpecifier = { tag: 'explicit', value: resolvedVersion }
  }

  // Assemble and optionally publish each package (fail-fast)
  const packageResults: PackageResult[] = []
  for (const prepared of preparedPackages) {
    await assemble(prepared.closure, prepared.outputDir, explicitVersionSpecifier)

    if (versionSpecifier) {
      await publish(prepared.outputDir, monorepoRoot)
    }

    packageResults.push({
      packageName: prepared.closure.subjectPackageName,
      outputDir: prepared.outputDir,
    })
  }

  // Write output
  if (resolvedVersion !== undefined) {
    if (options.outputFile) {
      const outputFilePath = path.resolve(cwd, options.outputFile)
      fsSync.writeFileSync(outputFilePath, resolvedVersion)
    } else {
      console.log(resolvedVersion)
    }
  }

  return { packages: packageResults, resolvedVersion }
}
