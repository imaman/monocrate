import * as fs from 'node:fs/promises'
import * as fsSync from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { RepoExplorer } from './repo-explorer.js'
import { PackageAssembler } from './package-assembler.js'
import { publish } from './publish.js'
import { parseVersionSpecifier } from './version-specifier.js'
import { AbsolutePath } from './paths.js'
import { maxVersion } from './resolve-version.js'
import { NpmClient } from './npm-client.js'

export interface MonocrateOptions {
  /**
   * Paths to the directories of the various package to assemble. If a string, it is transformed to a single element array.
   * Can be absolute or relative. Relative paths are resolved from the cwd option.
   */
  pathToSubjectPackage: string[] | string
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
   * Version specifier for the assembly.
   * Accepts either an explicit semver version (e.g., "1.2.3") or an increment keyword ("patch", "minor", "major").
   * The resolved version is either this value (if it is an explicit semver value) or is obtained by finding the
   * current version of all the packages to publish, finding the highest version of these, and then applying
   * the increment depicted by this value.
   *
   * Defaults to "minor".
   */
  bump?: string
  /**
   * Whether to publish the assemblies to npm after building.
   * When false, the assembly is prepared with the resolved version but not published
   * (useful for inspection or manual publishing).
   */
  publish: boolean
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
   * The output directory path where the assembly of the first package was created.
   */
  outputDir: string
  /**
   * The new version (AKA: 'resolved version') for the package (or packages).
   */
  resolvedVersion: string
  /**
   * Details about each individual package that was assembled/published.
   */
  summaries: { packageName: string; outputDir: string }[]
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
  const outputRoot = AbsolutePath(
    options.outputRoot ? path.resolve(cwd, options.outputRoot) : await fs.mkdtemp(path.join(os.tmpdir(), 'monocrate-'))
  )

  // Validate bump argument before any side effects (defaults to 'minor')
  const versionSpecifier = parseVersionSpecifier(options.bump ?? 'minor')

  const sources = Array.isArray(options.pathToSubjectPackage)
    ? options.pathToSubjectPackage
    : [options.pathToSubjectPackage]

  const sourceDirs = sources.map((at) => AbsolutePath(path.resolve(cwd, at)))
  const sourceDir0 = sourceDirs.at(0)
  if (!sourceDir0) {
    throw new Error(`At least one package must be specified`)
  }

  const monorepoRoot = options.monorepoRoot
    ? AbsolutePath(path.resolve(cwd, options.monorepoRoot))
    : RepoExplorer.findMonorepoRoot(sourceDir0)
  const explorer = await RepoExplorer.create(monorepoRoot)

  const npmClient = new NpmClient()
  const assemblers = sourceDirs.map((at) => new PackageAssembler(npmClient, explorer, at, outputRoot))
  const a0 = assemblers.at(0)
  if (!a0) {
    throw new Error(`Incosistency - could not find an assembler for the first package`)
  }

  // versionSpecifier is always defined (defaults to 'minor'), so computeNewVersion always returns a string
  const versions = (await Promise.all(assemblers.map((a) => a.computeNewVersion(versionSpecifier)))).flatMap((v) =>
    v ? [v] : []
  )

  const v0 = versions.at(0)
  if (!v0) {
    throw new Error('Inconsistency - no versions computed')
  }
  const resolvedVersion = versions.reduce((soFar, curr) => maxVersion(soFar, curr), v0)

  for (const assembler of assemblers) {
    await assembler.assemble(resolvedVersion)

    if (options.publish) {
      await publish(assembler.getOutputDir(), monorepoRoot)
    }
  }

  if (options.outputFile) {
    const outputFilePath = path.resolve(cwd, options.outputFile)
    fsSync.writeFileSync(outputFilePath, resolvedVersion)
  } else {
    console.log(resolvedVersion)
  }

  return {
    outputDir: a0.getOutputDir(),
    resolvedVersion,
    summaries: assemblers.map((at) => ({ outputDir: at.getOutputDir(), packageName: at.pkgName })),
  }
}
