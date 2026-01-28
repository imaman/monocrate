import type { MonorepoPackage } from './repo-explorer.js'

export function validatePublishNames(packages: Map<string, MonorepoPackage>): void {
  // const publishNames = new Map<string, string>()
  const names = new Map<string, string>()

  for (const pkg of packages.values()) {
    const other = names.get(pkg.publishAs)
    if (other) {
      throw new Error(`Publish name conflict between "${pkg.name}" and "${other}`)
    }
    names.set(pkg.publishAs, pkg.name)
  }
}
