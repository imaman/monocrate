import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { findMonorepoRoot } from './monorepo.js'
import { computePackageClosure } from './compute-package-closure.js'
import { assemble } from './assemble.js'
import { rewritePackageJson } from './rewrite-package-json.js'
import { publish } from './publish.js'
import { parseVersionSpecifier, resolveVersion } from './resolve-version.js'

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
   * Base directory for resolving relative paths. Must be a valid, existing directory.
   */
  cwd: string
}

/**
 * Assembles a monorepo package and its in-repo dependencies for npm publishing.
 * @param options - Configuration options for the assembly process
 * @returns The output directory path where the assembly was created
 * @throws Error if assembly or publishing fails
 */
export async function monocrate(options: MonocrateOptions): Promise<string> {
  // Resolve and validate cwd first, then use it to resolve all other paths
  const cwd = path.resolve(options.cwd)
  const cwdExists = await fs
    .stat(cwd)
    .then(() => true)
    .catch(() => false)
  if (!cwdExists) {
    throw new Error(`cwd does not exist: ${cwd}`)
  }

  const sourceDir = path.resolve(cwd, options.pathToSubjectPackage)
  const monorepoRoot = options.monorepoRoot ? path.resolve(cwd, options.monorepoRoot) : findMonorepoRoot(sourceDir)

  // Validate publish argument before any side effects
  const versionSpecifier = parseVersionSpecifier(options.publishToVersion)

  const outputDir = options.outputDir
    ? path.resolve(cwd, options.outputDir)
    : await fs.mkdtemp(path.join(os.tmpdir(), 'monocrate-'))

  const closure = await computePackageClosure(sourceDir, monorepoRoot)

  await assemble(closure, monorepoRoot, outputDir)

  const version = resolveVersion(closure.subjectPackageName, versionSpecifier)
  rewritePackageJson(closure, version, outputDir)

  if (version) {
    publish(outputDir)
  }

  return outputDir
}
