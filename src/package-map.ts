export interface PackageLocation {
  name: string
  packageDir: string // Source package directory (absolute path)
  outputPrefix: string // "" for subject, "deps/packages/..." for deps
  filesToCopy: string[] // Files/directories to copy (from `files` field or default)
  outputEntryPoint: string // For import rewriting
  resolveSubpath(subpath: string): string // For import rewriting
}

export type PackageMap = Map<string, PackageLocation>
