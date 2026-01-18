export type PackageMap = Map<
  string,
  {
    name: string
    sourceDistDir: string
    outputDistDir: string
    outputEntryPoint: string
    resolveSubpath(subpath: string): string
  }
>
