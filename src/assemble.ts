import * as fsPromises from 'node:fs/promises'
import { collectPackageLocations } from './collect-package-locations.js'
import { FileCopier } from './file-copier.js'
import { ImportRewriter } from './import-rewriter.js'
import type { PackageClosure } from './package-closure.js'
import { resolveVersion } from './resolve-version.js'
import { rewritePackageJson } from './rewrite-package-json.js'
import type { VersionSpecifier } from './version-specifier.js'

export async function assemble(
  closure: PackageClosure,
  monorepoRoot: string,
  outputDir: string,
  versionSpecifier: VersionSpecifier | undefined
): Promise<void> {
  const locations = collectPackageLocations(closure, monorepoRoot)
  const packageMap = new Map(locations.map((at) => [at.name, at] as const))

  await fsPromises.mkdir(outputDir, { recursive: true })
  await Promise.all([
    (async () => {
      const newVersion = versionSpecifier
        ? await resolveVersion(closure.subjectPackageName, versionSpecifier)
        : undefined
      rewritePackageJson(closure, newVersion, outputDir)
    })(),
    (async () => {
      const copiedFiles = await new FileCopier(packageMap, outputDir).copy()
      await new ImportRewriter(packageMap, outputDir).rewriteAll(copiedFiles)
    })(),
  ])
}
