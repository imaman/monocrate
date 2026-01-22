import * as fsPromises from 'node:fs/promises'
import { collectPackageLocations } from './collect-package-locations.js'
import { FileCopier } from './file-copier.js'
import { ImportRewriter } from './import-rewriter.js'
import type { PackageClosure } from './package-closure.js'
import { resolveVersion } from './resolve-version.js'
import { rewritePackageJson } from './rewrite-package-json.js'
import type { VersionSpecifier } from './version-specifier.js'
import type { AbsolutePath } from './paths.js'

export interface AssembleOptions {
  /**
   * Pre-computed version to use. When provided, version resolution is skipped.
   * This is used when assembling multiple packages with a shared version.
   */
  preComputedVersion?: string | undefined
}

export async function assemble(
  closure: PackageClosure,
  outputDir: AbsolutePath,
  versionSpecifier: VersionSpecifier | undefined,
  options: AssembleOptions = {}
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
  const [newVersion] = await Promise.all([
    options.preComputedVersion !== undefined
      ? Promise.resolve(options.preComputedVersion)
      : versionSpecifier
        ? resolveVersion(subject.fromDir, closure.subjectPackageName, versionSpecifier)
        : Promise.resolve(undefined),
    (async () => {
      const copiedFiles = await new FileCopier(packageMap).copy()
      await new ImportRewriter(packageMap).rewriteAll(copiedFiles)
    })(),
  ])
  // This must happen after file copying completes (otherwise the rewritten package.json could be overwritten)
  rewritePackageJson(closure, newVersion, outputDir)
  return newVersion
}
