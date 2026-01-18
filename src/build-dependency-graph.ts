import type { MonorepoPackage } from './types.js'
import { readPackageJson, discoverMonorepoPackages, isInRepoDep } from './monorepo.js'
import type { PackageJson } from './package-json.js'

export interface DependencyGraph {
  packageToBundle: MonorepoPackage
  inRepoDeps: MonorepoPackage[]
  allThirdPartyDeps: Record<string, string>
}

function getDependencies(packageJson: PackageJson): Record<string, string> {
  return packageJson.dependencies ?? {}
}

export async function buildDependencyGraph(sourceDir: string, monorepoRoot: string): Promise<DependencyGraph> {
  const monorepoPackages = await discoverMonorepoPackages(monorepoRoot)
  const packageToBundleJson = readPackageJson(sourceDir)

  const packageToBundle: MonorepoPackage = {
    name: packageToBundleJson.name,
    path: sourceDir,
    packageJson: packageToBundleJson,
  }

  const inRepoDeps: MonorepoPackage[] = []
  const allThirdPartyDeps: Record<string, string> = {}
  const visited = new Set<string>()

  function collectDeps(pkg: MonorepoPackage): void {
    if (visited.has(pkg.name)) {
      return
    }
    visited.add(pkg.name)

    const deps = getDependencies(pkg.packageJson)

    for (const [depName, depVersion] of Object.entries(deps)) {
      if (isInRepoDep(depName, monorepoPackages)) {
        const depPackage = monorepoPackages.get(depName)
        if (depPackage && !visited.has(depName)) {
          inRepoDeps.push(depPackage)
          collectDeps(depPackage)
        }
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
    inRepoDeps,
    allThirdPartyDeps,
  }
}
