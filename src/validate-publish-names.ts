import type { MonorepoPackage } from './repo-explorer.js'

export function validatePublishNames(packages: Map<string, MonorepoPackage>): void {
  const names = new Map<string, string>()

  for (const pkg of packages.values()) {
    const other = names.get(pkg.publishAs)
    if (other) {
      throw new Error(
        `Publish name collision: both "${pkg.name}" and "${other}" would both be published as "${pkg.publishAs}"`
      )
    }
    names.set(pkg.publishAs, pkg.name)
  }
}
