import type { MonorepoPackage } from './monorepo.js'
import { discoverMonorepoPackages } from './monorepo.js'
import type { PackageClosure } from './package-closure.js'
import type { AbsolutePath } from './paths.js'

interface VersionInfo {
  version: string
  requiredBy: string
}

function detectVersionConflicts(
  versionsByDep: Map<string, VersionInfo[]>
): Partial<Record<string, string[]>> {
  const conflicts: Partial<Record<string, string[]>> = {}

  for (const [depName, versionInfos] of versionsByDep.entries()) {
    const uniqueVersions = [...new Set(versionInfos.map((v) => v.version))]
    if (uniqueVersions.length > 1) {
      conflicts[depName] = versionInfos.map((v) => `${v.version} (required by ${v.requiredBy})`)
    }
  }

  return conflicts
}

function formatConflictError(conflicts: Partial<Record<string, string[]>>): string {
  const lines = ['Third-party dependency version conflicts detected:']

  for (const [depName, versions] of Object.entries(conflicts)) {
    if (versions) {
      lines.push(`  ${depName}:`)
      for (const version of versions) {
        lines.push(`    - ${version}`)
      }
    }
  }

  return lines.join('\n')
}

export async function computePackageClosure(sourceDir: AbsolutePath, monorepoRoot: AbsolutePath): Promise<PackageClosure> {
  const allRepoPackages = await discoverMonorepoPackages(monorepoRoot)
  const subjectPackage = [...allRepoPackages.values()].find((at) => at.path === sourceDir)
  if (!subjectPackage) {
    throw new Error(`Could not find a monorepo package at ${sourceDir}`)
  }

  const versionsByDep = new Map<string, VersionInfo[]>()
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
        const existing = versionsByDep.get(depName) ?? []
        existing.push({ version: depVersion, requiredBy: pkg.name })
        versionsByDep.set(depName, existing)
      }
    }
  }

  collectDeps(subjectPackage)

  const conflicts = detectVersionConflicts(versionsByDep)
  if (Object.keys(conflicts).length > 0) {
    throw new Error(formatConflictError(conflicts))
  }

  const allThirdPartyDeps: Partial<Record<string, string>> = {}
  for (const [depName, versionInfos] of versionsByDep.entries()) {
    const first = versionInfos[0]
    if (first) {
      allThirdPartyDeps[depName] = first.version
    }
  }

  return {
    subjectPackageName: subjectPackage.name,
    members: [...visited.values()],
    allThirdPartyDeps,
  }
}
