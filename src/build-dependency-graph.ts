import type { MonorepoPackage } from './monorepo.js'
import { discoverMonorepoPackages } from './monorepo.js'

export interface DependencyGraph {
  packageToBundle: MonorepoPackage
  inRepoDeps: MonorepoPackage[]
  allThirdPartyDeps: Partial<Record<string, string>>
}

export async function buildDependencyGraph(sourceDir: string, monorepoRoot: string): Promise<DependencyGraph> {
  const allPackages = await discoverMonorepoPackages(monorepoRoot)
  const packageToBundle = [...allPackages.values()].find((at) => at.path === sourceDir)
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
      const depPackage = allPackages.get(depName)
      if (depPackage) {
        collectDeps(depPackage)
      } else {
        allThirdPartyDeps[depName] = depVersion
      }
    }
  }

  collectDeps(packageToBundle)

  return {
    packageToBundle,
    inRepoDeps: [...visited.values()],
    allThirdPartyDeps,
  }
}
