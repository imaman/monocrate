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
  packageDir: string

  /**
   * Prefix for the output location. Empty string for the subject package,
   * relative path under deps/ for in-repo dependencies
   * @example "" (subject package)
   * @example "deps/packages/utils" (in-repo dependency)
   */
  outputPrefix: string

  /**
   * Individual file paths to copy, as determined by `npm pack --dry-run`.
   * These are the exact files npm would include in the published tarball.
   * @example ["dist/index.js", "dist/utils.js", "package.json"]
   */
  filesToCopy: string[]

  /**
   * Path to the entry point in the output, used for import rewriting
   * @example "dist/index.js" (subject package)
   * @example "deps/packages/utils/dist/index.js" (in-repo dependency)
   */
  outputEntryPoint: string

  /**
   * Resolves a subpath import to the output location
   * @example resolveSubpath("helpers/math") => "deps/packages/utils/dist/helpers/math"
   */
  resolveSubpath(subpath: string): string
}

export type PackageMap = Map<string, PackageLocation>
