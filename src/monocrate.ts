import * as fs from 'node:fs/promises'
import * as fsSync from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { findMonorepoRoot } from './monorepo.js'
import { computePackageClosure } from './compute-package-closure.js'
import type { PackageClosure } from './package-closure.js'
import { assemble } from './assemble.js'
import { publish } from './publish.js'
import { parseVersionSpecifier } from './version-specifier.js'
import { resolveVersionAcrossPackages } from './resolve-version.js'
import { AbsolutePath, RelativePath } from './paths.js'
import { manglePackageName } from './name-mangler.js'

export interface MonocrateOptions {
  /**
   * Path(s) to the package directory(ies) to assemble.
   * Can be absolute or relative. Relative paths are resolved from the cwd option.
   * When multiple packages are provided, they are all published with a shared version.
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

/**
 * Output details for a single processed package.
 */
export interface PackageOutput {
  /**
   * The input path that was provided for this package.
   */
  inputPath: string
  /**
   * The output directory path where the assembly was created.
   */
  outputDir: string
}

export interface MonocrateResult {
  /**
   * The output directory path where the assembly was created.
   * When multiple packages are processed, this is the first package's output directory.
   */
  outputDir: string
  /**
   * The new version (AKA: 'resolved version') for the package(s).
   * Undefined when publishToVersion was not specified.
   */
  resolvedVersion: string | undefined
  /**
   * Output details for each processed package.
   * When a single package is processed, this array has one entry.
   */
  outputs: PackageOutput[]
}

/**
 * Assembles monorepo package(s) and their in-repo dependencies for npm publishing.
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

  // Normalize pathToSubjectPackage to an array
  const subjectPaths = Array.isArray(options.pathToSubjectPackage)
    ? options.pathToSubjectPackage
    : [options.pathToSubjectPackage]

  if (subjectPaths.length === 0) {
    throw new Error('pathToSubjectPackage must contain at least one path')
  }

  const sourceDirs = subjectPaths.map((p) => AbsolutePath(path.resolve(cwd, p)))

  // Use the first source dir to find the monorepo root if not provided
  const firstSourceDir = sourceDirs[0]
  if (firstSourceDir === undefined) {
    throw new Error('pathToSubjectPackage must contain at least one path')
  }
  const monorepoRoot = options.monorepoRoot
    ? AbsolutePath(path.resolve(cwd, options.monorepoRoot))
    : findMonorepoRoot(firstSourceDir)

  // Validate publish argument before any side effects
  const versionSpecifier = parseVersionSpecifier(options.publishToVersion)

  const outputRoot = AbsolutePath(
    options.outputRoot ? path.resolve(cwd, options.outputRoot) : await fs.mkdtemp(path.join(os.tmpdir(), 'monocrate-'))
  )

  // Compute closures for all packages, keeping track of the source info
  interface SubjectInfo {
    inputPath: string
    sourceDir: AbsolutePath
    closure: PackageClosure
  }
  const subjects: SubjectInfo[] = []
  for (let i = 0; i < sourceDirs.length; i++) {
    const sourceDir = sourceDirs[i]
    const inputPath = subjectPaths[i]
    if (sourceDir === undefined || inputPath === undefined) {
      throw new Error('Internal error: sourceDir or inputPath is undefined')
    }
    const closure = await computePackageClosure(sourceDir, monorepoRoot)
    subjects.push({ inputPath, sourceDir, closure })
  }

  // Resolve shared version across all packages if publishing
  let resolvedVersion: string | undefined
  if (versionSpecifier) {
    resolvedVersion = await resolveVersionAcrossPackages(
      subjects.map((s) => ({
        dir: s.sourceDir,
        packageName: s.closure.subjectPackageName,
      })),
      versionSpecifier
    )
  }

  // Assemble and publish each package (fail-fast)
  const outputs: PackageOutput[] = []
  for (const subject of subjects) {
    const outputDir = AbsolutePath.join(outputRoot, RelativePath(manglePackageName(subject.closure.subjectPackageName)))
    await assemble(subject.closure, outputDir, resolvedVersion)

    if (versionSpecifier) {
      await publish(outputDir, monorepoRoot)
    }

    outputs.push({ inputPath: subject.inputPath, outputDir })
  }

  // Output resolved version (same as before, using first package's perspective)
  if (resolvedVersion !== undefined) {
    if (options.outputFile) {
      const outputFilePath = path.resolve(cwd, options.outputFile)
      fsSync.writeFileSync(outputFilePath, resolvedVersion)
    } else {
      console.log(resolvedVersion)
    }
  }

  const firstOutput = outputs[0]
  if (firstOutput === undefined) {
    throw new Error('Internal error: no outputs produced')
  }

  return { outputDir: firstOutput.outputDir, resolvedVersion, outputs }
}
