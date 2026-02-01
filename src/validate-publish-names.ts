import type { MonorepoPackage } from './repo-explorer.js'

export function validatePublishNames(packages: Map<string, MonorepoPackage>): void {
  const names = new Map<string, string>()
  const sortedPackages = [...packages.values()].sort((a, b) => a.name.localeCompare(b.name))

  for (const pkg of sortedPackages) {
    const other = names.get(pkg.publishAs)
    if (other) {
      throw new Error(
        `Publish name collision: both "${other}" and "${pkg.name}" would both be published as "${pkg.publishAs}"`
      )
    }
    names.set(pkg.publishAs, pkg.name)
  }
}
