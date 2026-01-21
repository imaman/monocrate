import type { PackageJson } from './package-json.js'
import type { AbsolutePath, PathInRepo } from './paths.js'

export interface PackageLocation {
  /**
   * The package name from package.json
   * @example "@myorg/utils"
   */
  name: string

  /**
   * Absolute path to the source package directory
   * @example "/home/user/monorepo/packages/utils"
   */
  packageDir: AbsolutePath

  // pathInRepo: PathInRepo

  /**
   * Prefix for the output location. Empty string for the subject package,
   * relative path under deps/ for in-repo dependencies
   * @example "" (subject package)
   * @example "deps/packages/utils" (in-repo dependency)
   */
  directoryInOutput: PathInRepo

  /**
   * Individual file paths (relative to the package dir) to copy, as determined by `npm pack --dry-run`.
   * These are the exact files npm would include in the published tarball.
   * @example ["dist/index.js", "dist/utils.js", "package.json"]
   */
  filesToCopy: string[]

  /**
   * The package.json contents, used for import resolution
   */
  packageJson: PackageJson
}

export type PackageMap = Map<string, PackageLocation>
