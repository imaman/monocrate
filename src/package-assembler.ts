import * as fsPromises from 'node:fs/promises'
import { collectPackageLocations } from './collect-package-locations.js'
import { FileCopier } from './file-copier.js'
import { ImportRewriter } from './import-rewriter.js'
import { resolveVersion } from './resolve-version.js'
import { rewritePackageJson } from './rewrite-package-json.js'
import type { VersionSpecifier } from './version-specifier.js'
import { AbsolutePath, RelativePath } from './paths.js'
import type { RepoExplorer, MonorepoPackage } from './repo-explorer.js'
import { computePackageClosure } from './compute-package-closure.js'
import { manglePackageName } from './name-mangler.js'
import type { NpmClient } from './npm-client.js'

export class PackageAssembler {
  readonly pkgName
  readonly publishAs
  constructor(
    private readonly npmClient: NpmClient,
    private readonly explorer: RepoExplorer,
    private readonly fromDir: AbsolutePath,
    private readonly outputRoot: AbsolutePath
  ) {
    const found = this.explorer.listPackages().find((at) => at.fromDir === fromDir)
    if (!found) {
      throw new Error(`Unrecognized package source dir: "${this.fromDir}"`)
    }
    this.pkgName = found.name
    this.publishAs = found.publishAs
  }

  getOutputDir() {
    return AbsolutePath.join(this.outputRoot, RelativePath(manglePackageName(this.pkgName)))
  }

  async computeNewVersion(versionSpecifier: VersionSpecifier | undefined) {
    return versionSpecifier
      ? await resolveVersion(this.npmClient, this.fromDir, this.pkgName, versionSpecifier)
      : Promise.resolve(undefined)
  }

  async assemble(newVersion: string | undefined): Promise<{ compiletimeMembers: MonorepoPackage[] }> {
    const closure = computePackageClosure(this.pkgName, this.explorer)
    const outputDir = this.getOutputDir()
    const locations = await collectPackageLocations(this.npmClient, closure, outputDir)
    const packageMap = new Map(locations.map((at) => [at.name, at] as const))

    const subject = packageMap.get(closure.subjectPackageName)
    if (!subject) {
      throw new Error(`Internal mismatch: could not find location data of "${closure.subjectPackageName}"`)
    }

    await fsPromises.mkdir(outputDir, { recursive: true })
    const copiedFiles = await new FileCopier(packageMap).copy()
    const isInRepoPackage = (pkgName: string) => this.explorer.lookupPackage(pkgName) !== undefined
    const toRepoPath = (outputPath: AbsolutePath): string => {
      for (const loc of packageMap.values()) {
        if (outputPath.startsWith(loc.toDir)) {
          const relativePath = outputPath.slice(loc.toDir.length + 1) // +1 for the path separator
          const pkg = this.explorer.getPackage(loc.name)
          return `${pkg.pathInRepo}/${relativePath}`
        }
      }
      return outputPath // fallback to absolute path if no match
    }
    await new ImportRewriter(packageMap, isInRepoPackage, toRepoPath).rewriteAll(copiedFiles)

    // This must happen after file copying completes (otherwise the rewritten package.json could be overwritten)
    rewritePackageJson(closure, newVersion, outputDir)

    return { compiletimeMembers: closure.compiletimeMembers }
  }
}
