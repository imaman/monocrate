import type { MonorepoPackage } from './monorepo.js'
import { discoverMonorepoPackages } from './monorepo.js'
import type { PackageClosure } from './package-closure.js'

export async function computePackageClosure(sourceDir: string, monorepoRoot: string): Promise<PackageClosure> {
  const allRepoPackages = await discoverMonorepoPackages(monorepoRoot)
  const subjectPackage = [...allRepoPackages.values()].find((at) => at.path === sourceDir)
  if (!subjectPackage) {
    throw new Error(`Could not find a monorepo package at ${sourceDir}`)
  }

  const allThirdPartyDeps: Partial<Record<string, string>> = {}
  const visited = new Map<string, MonorepoPackage>()

  function collectDeps(pkg: MonorepoPackage): void {
    if (visited.has(pkg.name)) {
      return
    }
    visited.set(pkg.name, pkg)

    for (const [depName, depVersion] of Object.entries(pkg.packageJson.dependencies ?? {})) {
      if (!depVersion) {
        throw new Error(`no version for dep ${depName} in ${pkg.name}`)
      }
      const depPackage = allRepoPackages.get(depName)
      if (depPackage) {
        // Is an in-repo dep
        collectDeps(depPackage)
      } else {
        if (!(depName in allThirdPartyDeps)) {
          allThirdPartyDeps[depName] = depVersion
        }
      }
    }
  }

  collectDeps(subjectPackage)

  return {
    subjectPackageName: subjectPackage.name,
    packagesToAssemble: [...visited.values()],
    allThirdPartyDeps,
  }
}
