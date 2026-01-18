export interface PackageLocation {
  name: string
  sourceDistDir: string
  outputDistDir: string
  outputEntryPoint: string
  resolveSubpath(subpath: string): string
}

export type PackageMap = Map<string, PackageLocation>
