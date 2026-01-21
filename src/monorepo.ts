import * as fs from 'node:fs'
import * as path from 'node:path'
import { glob } from 'glob'
import { PackageJson } from './package-json.js'
import { AbsolutePath, PathInRepo } from './paths.js'

export interface MonorepoPackage {
  name: string
  path: AbsolutePath
  pathInRepo: PathInRepo
  packageJson: PackageJson
}

export function findMonorepoRoot(startDir: AbsolutePath): AbsolutePath {
  let dir = startDir

  while (dir !== AbsolutePath.dirname(dir)) {
    const packageJsonPath = path.join(dir, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      const parsed = PackageJson.safeParse(JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')))
      if (parsed.success && parsed.data.workspaces !== undefined) {
        return dir
      }
    }

    const pnpmWorkspacePath = path.join(dir, 'pnpm-workspace.yaml')
    if (fs.existsSync(pnpmWorkspacePath)) {
      return dir
    }

    dir = AbsolutePath.dirname(dir)
  }

  throw new Error(`Could not find monorepo root from ${startDir}`)
}

function readPackageJson(packageDir: AbsolutePath): PackageJson {
  const packageJsonPath = path.join(packageDir, 'package.json')
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`No package.json found at ${packageDir}`)
  }
  const content: unknown = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
  const parsed = PackageJson.safeParse(content)
  if (!parsed.success) {
    throw new Error(`Invalid package.json at ${packageDir}: ${parsed.error.message}`)
  }
  return parsed.data
}

function parseWorkspacePatterns(monorepoRoot: AbsolutePath): string[] {
  const packageJsonPath = path.join(monorepoRoot, 'package.json')
  if (fs.existsSync(packageJsonPath)) {
    const parsed = PackageJson.safeParse(JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')))
    if (parsed.success) {
      const workspaces = parsed.data.workspaces
      if (Array.isArray(workspaces)) {
        return workspaces
      }
      if (workspaces && typeof workspaces === 'object' && 'packages' in workspaces) {
        return workspaces.packages
      }
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

export async function discoverMonorepoPackages(monorepoRoot: AbsolutePath): Promise<Map<string, MonorepoPackage>> {
  const patterns = parseWorkspacePatterns(monorepoRoot)
  const packages = new Map<string, MonorepoPackage>()

  for (const pattern of patterns) {
    const fullPattern = path.join(monorepoRoot, pattern, 'package.json')
    const matches = await glob(fullPattern, { ignore: '**/node_modules/**' })

    for (const match of matches) {
      const packageDir = AbsolutePath(path.dirname(match))
      const packageJson = readPackageJson(packageDir)

      if (packageJson.name) {
        packages.set(packageJson.name, {
          name: packageJson.name,
          path: packageDir,
          pathInRepo: PathInRepo(path.relative(monorepoRoot, packageDir)),
          packageJson,
        })
      }
    }
  }

  return packages
}
