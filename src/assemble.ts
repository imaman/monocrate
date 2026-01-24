import * as fsPromises from 'node:fs/promises'
import { collectPackageLocations } from './collect-package-locations.js'
import { FileCopier } from './file-copier.js'
import { ImportRewriter } from './import-rewriter.js'
import type { PackageClosure } from './package-closure.js'
import { rewritePackageJson } from './rewrite-package-json.js'
import type { AbsolutePath } from './paths.js'

/**
 * Assembles a package closure to the output directory.
 * @param closure - The package closure to assemble
 * @param outputDir - The output directory path
 * @param resolvedVersion - The pre-resolved version to use, or undefined if not publishing
 * @returns The version that was used (same as resolvedVersion)
 */
export async function assemble(
  closure: PackageClosure,
  outputDir: AbsolutePath,
  resolvedVersion: string | undefined
): Promise<string | undefined> {
  const locations = await collectPackageLocations(closure, outputDir)
  const packageMap = new Map(locations.map((at) => [at.name, at] as const))

  // TODO(imaman): transition to explict integration with verdaccio testkit in which cass we will not need to inject an
  // npmrc file
  const subject = packageMap.get(closure.subjectPackageName)
  if (!subject) {
    throw new Error(`Internal mismatch: could not find location data of "${closure.subjectPackageName}"`)
  }

  await fsPromises.mkdir(outputDir, { recursive: true })
  const copiedFiles = await new FileCopier(packageMap).copy()
  await new ImportRewriter(packageMap).rewriteAll(copiedFiles)
  // This must happen after file copying completes (otherwise the rewritten package.json could be overwritten)
  rewritePackageJson(closure, resolvedVersion, outputDir)
  return resolvedVersion
}
