import type { MonorepoPackage, DependencyGraph, PackageJson } from './types.js'
import { readPackageJson, discoverMonorepoPackages, isInRepoDep } from './monorepo.js'

function getDependencies(packageJson: PackageJson): Record<string, string> {
  return packageJson.dependencies ?? {}
}

export async function buildDependencyGraph(sourceDir: string, monorepoRoot: string): Promise<DependencyGraph> {
  const monorepoPackages = await discoverMonorepoPackages(monorepoRoot)
  const rootPackageJson = readPackageJson(sourceDir)

  const root: MonorepoPackage = {
    name: rootPackageJson.name,
    path: sourceDir,
    packageJson: rootPackageJson,
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

  collectDeps(root)

  return {
    root,
    inRepoDeps,
    allThirdPartyDeps,
  }
}
