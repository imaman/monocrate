import * as fs from 'node:fs'
import * as path from 'node:path'
import { glob } from 'glob'
import type { PackageJson, MonorepoPackage } from './types.js'

export function findMonorepoRoot(startDir: string): string {
  let dir = path.resolve(startDir)

  while (dir !== path.dirname(dir)) {
    const packageJsonPath = path.join(dir, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      const content = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as Record<string, unknown>
      if (content.workspaces !== undefined) {
        return dir
      }
    }

    const pnpmWorkspacePath = path.join(dir, 'pnpm-workspace.yaml')
    if (fs.existsSync(pnpmWorkspacePath)) {
      return dir
    }

    dir = path.dirname(dir)
  }

  throw new Error(`Could not find monorepo root from ${startDir}`)
}

export function readPackageJson(packageDir: string): PackageJson {
  const packageJsonPath = path.join(packageDir, 'package.json')
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`No package.json found at ${packageDir}`)
  }
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as PackageJson
}

function parseWorkspacePatterns(monorepoRoot: string): string[] {
  const packageJsonPath = path.join(monorepoRoot, 'package.json')
  if (fs.existsSync(packageJsonPath)) {
    const content = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as Record<string, unknown>
    const workspaces = content.workspaces
    if (Array.isArray(workspaces)) {
      return workspaces as string[]
    }
    if (workspaces && typeof workspaces === 'object' && 'packages' in workspaces) {
      return (workspaces as { packages: string[] }).packages
    }
  }

  const pnpmWorkspacePath = path.join(monorepoRoot, 'pnpm-workspace.yaml')
  if (fs.existsSync(pnpmWorkspacePath)) {
    const content = fs.readFileSync(pnpmWorkspacePath, 'utf-8')
    const match = /packages:\s*\n((?:\s+-\s+.+\n?)+)/m.exec(content)
    if (match?.[1]) {
      return match[1]
        .split('\n')
        .map((line) => line.replace(/^\s*-\s*['"]?|['"]?\s*$/g, ''))
        .filter(Boolean)
    }
  }

  return ['packages/*']
}

export async function discoverMonorepoPackages(monorepoRoot: string): Promise<Map<string, MonorepoPackage>> {
  const patterns = parseWorkspacePatterns(monorepoRoot)
  const packages = new Map<string, MonorepoPackage>()

  for (const pattern of patterns) {
    const fullPattern = path.join(monorepoRoot, pattern, 'package.json')
    const matches = await glob(fullPattern, { ignore: '**/node_modules/**' })

    for (const match of matches) {
      const packageDir = path.dirname(match)
      const packageJson = readPackageJson(packageDir)

      if (packageJson.name) {
        packages.set(packageJson.name, {
          name: packageJson.name,
          path: packageDir,
          packageJson,
        })
      }
    }
  }

  return packages
}

export function isInRepoDep(depName: string, monorepoPackages: Map<string, MonorepoPackage>): boolean {
  return monorepoPackages.has(depName)
}
