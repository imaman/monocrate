import * as fs from 'node:fs/promises'
import * as fsSync from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { RepoExplorer } from './repo-explorer.js'
import { PackageAssembler } from './package-assembler.js'
import { publish } from './publish.js'
import { parseVersionSpecifier, type VersionSpecifier } from './version-specifier.js'
import { AbsolutePath } from './paths.js'
import { resolveVersionForMultiple } from './resolve-version.js'

export interface MonocrateOptions {
  /**
   * Path(s) to the package directory(ies) to assemble.
   * Can be a single path or an array of paths for multi-package publishing.
   * Can be absolute or relative. Relative paths are resolved from the cwd option.
   * When multiple packages are specified, they share a resolved version derived from
   * the maximum current version among all subject packages.
   */
  pathToSubjectPackage: string | string[]
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

export interface MonocrateMultiResult {
  /**
   * The output directory paths where the assemblies were created, one per subject package.
   */
  outputDir: string[]
  /**
   * The shared version for all packages.
   * Undefined when publishToVersion was not specified.
   */
  resolvedVersion: string | undefined
}

/** Options with a single subject package path */
type MonocrateSingleOptions = Omit<MonocrateOptions, 'pathToSubjectPackage'> & { pathToSubjectPackage: string }
/** Options with multiple subject package paths */
type MonocrateMultiOptions = Omit<MonocrateOptions, 'pathToSubjectPackage'> & { pathToSubjectPackage: string[] }

/**
 * Assembles a monorepo package and its in-repo dependencies for npm publishing.
 * @param options - Configuration options for the assembly process
 * @returns The result of the assembly operation
 * @throws Error if assembly or publishing fails
 */
export async function monocrate(options: MonocrateSingleOptions): Promise<MonocrateResult>
/**
 * Assembles multiple monorepo packages and their in-repo dependencies for npm publishing.
 * All packages share a resolved version derived from the maximum current version among them.
 * @param options - Configuration options for the assembly process
 * @returns The result of the assembly operation with an array of output directories
 * @throws Error if assembly or publishing fails for any package (fail-fast)
 */
export async function monocrate(options: MonocrateMultiOptions): Promise<MonocrateMultiResult>
export async function monocrate(
  options: MonocrateSingleOptions | MonocrateMultiOptions
): Promise<MonocrateResult | MonocrateMultiResult> {
  // Normalize input to array immediately
  const subjectPaths = Array.isArray(options.pathToSubjectPackage)
    ? options.pathToSubjectPackage
    : [options.pathToSubjectPackage]
  const isMultiPackage = Array.isArray(options.pathToSubjectPackage)

  // Resolve and validate cwd first, then use it to resolve all other paths
  const cwd = AbsolutePath(path.resolve(options.cwd))
  const cwdExists = await fs
    .stat(cwd)
    .then(() => true)
    .catch(() => false)
  if (!cwdExists) {
    throw new Error(`cwd does not exist: ${cwd}`)
  }

  // Resolve all source directories
  const sourceDirs = subjectPaths.map((p) => AbsolutePath(path.resolve(cwd, p)))

  // Use first source dir for monorepo root detection if not explicitly provided
  const firstSourceDir = sourceDirs[0]
  if (!firstSourceDir) {
    throw new Error('At least one subject package path must be provided')
  }

  const monorepoRoot = options.monorepoRoot
    ? AbsolutePath(path.resolve(cwd, options.monorepoRoot))
    : RepoExplorer.findMonorepoRoot(firstSourceDir)
  const explorer = await RepoExplorer.create(monorepoRoot)

  // Validate publish argument before any side effects
  const versionSpecifier = parseVersionSpecifier(options.publishToVersion)

  const outputRoot = AbsolutePath(
    options.outputRoot ? path.resolve(cwd, options.outputRoot) : await fs.mkdtemp(path.join(os.tmpdir(), 'monocrate-'))
  )

  // Create assemblers for all packages and collect package info
  const assemblers = sourceDirs.map((sourceDir) => new PackageAssembler(explorer, sourceDir, outputRoot))

  // Compute shared version from max current version across all packages
  const resolvedVersion = await computeSharedVersion(assemblers, versionSpecifier)

  // Process each package: assemble and optionally publish (fail-fast)
  for (const assembler of assemblers) {
    await assembler.assemble(resolvedVersion)

    if (versionSpecifier) {
      await publish(assembler.getOutputDir(), monorepoRoot)
    }
  }

  // Output version once (shared across all packages)
  if (resolvedVersion !== undefined) {
    if (options.outputFile) {
      const outputFilePath = path.resolve(cwd, options.outputFile)
      fsSync.writeFileSync(outputFilePath, resolvedVersion)
    } else {
      console.log(resolvedVersion)
    }
  }

  // Return appropriate result type based on input type
  const outputDirs = assemblers.map((a) => a.getOutputDir())
  if (isMultiPackage) {
    return { outputDir: outputDirs, resolvedVersion }
  }
  const singleOutputDir = outputDirs[0]
  if (singleOutputDir === undefined) {
    throw new Error('Internal error: expected at least one output directory')
  }
  return { outputDir: singleOutputDir, resolvedVersion }
}

async function computeSharedVersion(
  assemblers: PackageAssembler[],
  versionSpecifier: VersionSpecifier | undefined
): Promise<string | undefined> {
  if (!versionSpecifier) {
    return undefined
  }

  if (assemblers.length === 1) {
    const assembler = assemblers[0]
    if (assembler === undefined) {
      throw new Error('Internal error: expected at least one assembler')
    }
    return assembler.computeNewVersion(versionSpecifier)
  }

  // For multiple packages, find max version and apply specifier
  const packages = assemblers.map((a) => ({
    dir: a.getSourceDir(),
    packageName: a.getPackageName(),
  }))

  return resolveVersionForMultiple(packages, versionSpecifier)
}
