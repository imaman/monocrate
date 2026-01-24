import * as fs from 'node:fs/promises'
import * as fsSync from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { findMonorepoRoot } from './monorepo.js'
import { computePackageClosure } from './compute-package-closure.js'
import { assemble } from './assemble.js'
import { publish } from './publish.js'
import { parseVersionSpecifier } from './version-specifier.js'
import { AbsolutePath } from './paths.js'

export interface MonocrateOptions {
  /**
   * Path to the package directory to assemble.
   * Can be absolute or relative. Relative paths are resolved from the cwd option.
   */
  pathToSubjectPackage: string
  /**
   * Path to the output directory where the assembly will be written.
   * Can be absolute or relative. Relative paths are resolved from the cwd option.
   * If not specified, a dedicated temp directory is created under the system temp directory.
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

  const outputDir = AbsolutePath(
    options.outputDir ? path.resolve(cwd, options.outputDir) : await fs.mkdtemp(path.join(os.tmpdir(), 'monocrate-'))
  )

  const closure = await computePackageClosure(sourceDir, monorepoRoot)
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
