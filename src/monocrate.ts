import * as fs from 'node:fs/promises'
import * as fsSync from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { RepoExplorer } from './repo-explorer.js'
import type { MonorepoPackage } from './repo-explorer.js'
import { PackageAssembler } from './package-assembler.js'
import { publish } from './publish.js'
import { parseVersionSpecifier } from './version-specifier.js'
import { AbsolutePath } from './paths.js'
import { maxVersion } from './resolve-version.js'
import { NpmClient } from './npm-client.js'
import { mirrorSources } from './mirror-sources.js'
import type { MonocrateResult } from './monocrate-result.js'
import type { MonocrateOptions } from './monocrate-options.js'

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

  const npmClient = new NpmClient({ userconfig: options.npmrcPath })
  const assemblers = sourceDirs.map((at) => new PackageAssembler(npmClient, explorer, at, outputRoot))
  const a0 = assemblers.at(0)
  if (!a0) {
    throw new Error(`Incosistency - could not find an assembler for the first package`)
  }

  // versionSpecifier is always defined (defaults to 'minor'), so computeNewVersion always returns a string
  const versions = (await Promise.all(assemblers.map((a) => a.computeNewVersion(versionSpecifier)))).flatMap((v) =>
    v ? [v] : []
  )

  const v = versions.at(0)
  if (!v) {
    throw new Error('Inconsistency - no versions computed')
  }
  const resolvedVersion = versions.reduce((soFar, curr) => maxVersion(soFar, curr), v)

  const allPackages = new Map<string, MonorepoPackage>()
  for (const assembler of assemblers) {
    const members = await assembler.assemble(resolvedVersion)
    for (const pkg of members) {
      allPackages.set(pkg.name, pkg)
    }

    if (options.publish) {
      await publish(npmClient, assembler.getOutputDir())
    }
  }

  // Mirror source files if mirrorTo is specified
  if (options.mirrorTo) {
    const mirrorDir = AbsolutePath(path.resolve(cwd, options.mirrorTo))
    await mirrorSources([...allPackages.values()], mirrorDir)
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
