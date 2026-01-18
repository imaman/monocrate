import type { MonorepoPackage } from './monorepo.js'
import { discoverMonorepoPackages } from './monorepo.js'

export interface DependencyGraph {
  packageToBundle: MonorepoPackage
  inRepoDeps: MonorepoPackage[]
  allThirdPartyDeps: Partial<Record<string, string>>
}

export async function buildDependencyGraph(sourceDir: string, monorepoRoot: string): Promise<DependencyGraph> {
  const allRepoPackages = await discoverMonorepoPackages(monorepoRoot)
  const packageToBundle = [...allRepoPackages.values()].find((at) => at.path === sourceDir)
  if (!packageToBundle) {
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

  collectDeps(packageToBundle)

  return {
    packageToBundle,
    inRepoDeps: [...visited.values()].filter((at) => at !== packageToBundle),
    allThirdPartyDeps,
  }
}
