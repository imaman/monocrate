import type { MonorepoPackage } from './repo-explorer.js'

export function validatePublishNames(packages: Map<string, MonorepoPackage>): void {
  const publishNames = new Map<string, string>()
  const packageNames = new Set(packages.keys())

  for (const [packageName, pkg] of packages) {
    if (pkg.publishName) {
      // Check if publish name conflicts with an existing package name
      if (packageNames.has(pkg.publishName)) {
        throw new Error(
          `Package "${packageName}" has publishName "${pkg.publishName}" which conflicts with an existing package name`
        )
      }

      // Check if publish name conflicts with another package's publish name
      const existingPackage = publishNames.get(pkg.publishName)
      if (existingPackage) {
        throw new Error(`Packages "${existingPackage}" and "${packageName}" both have publishName "${pkg.publishName}"`)
      }

      publishNames.set(pkg.publishName, packageName)
    }
  }
}
