import * as fs from 'node:fs'
import * as path from 'node:path'
import { glob } from 'glob'
import { PackageJson } from './package-json.js'
import { AbsolutePath, RelativePath } from './paths.js'
import { validatePublishNames } from './validate-publish-names.js'

export interface MonorepoPackage {
  name: string
  publishAs: string
  fromDir: AbsolutePath
  pathInRepo: RelativePath
  packageJson: PackageJson
}

export class RepoExplorer {
  constructor(
    readonly repoRootDir: AbsolutePath,
    private readonly map: Map<string, MonorepoPackage>
  ) {}

  static async create(monorepoRoot: AbsolutePath) {
    const map = await this.discover(monorepoRoot)

    // Validate all package directories are under the monorepo root
    // Use realpath to resolve symlinks and catch cases where a symlink points outside
    const realMonorepoRoot = AbsolutePath(fs.realpathSync(monorepoRoot))
    for (const pkg of map.values()) {
      const realPkgPath = AbsolutePath(fs.realpathSync(pkg.fromDir))
      if (!AbsolutePath.contains(realMonorepoRoot, realPkgPath)) {
        throw new Error(
          `Package "${pkg.name}" is located at "${realPkgPath}" which is outside the monorepo root "${realMonorepoRoot}"`
        )
      }
    }

    validatePublishNames(map)

    return new RepoExplorer(monorepoRoot, map)
  }

  listNames() {
    return [...this.map.keys()]
  }
  listPackages() {
    return [...this.map.values()]
  }

  getPackage(pkgName: string) {
    const ret = this.lookupPackage(pkgName)
    if (!ret) {
      throw new Error(`Unrecognized package name: "${pkgName}"`)
    }
    return ret
  }

  lookupPackage(pkgName: string) {
    return this.map.get(pkgName)
  }

  static findMonorepoRoot(startDir: AbsolutePath): AbsolutePath {
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

  private static readPackageJson(packageDir: AbsolutePath): PackageJson {
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

  private static parseWorkspacePatterns(monorepoRoot: AbsolutePath): string[] {
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

  static async discover(monorepoRoot: AbsolutePath): Promise<Map<string, MonorepoPackage>> {
    const patterns = this.parseWorkspacePatterns(monorepoRoot)
    const packages = new Map<string, MonorepoPackage>()

    for (const pattern of patterns) {
      const fullPattern = path.join(monorepoRoot, pattern, 'package.json')
      const matches = await glob(fullPattern, { ignore: '**/node_modules/**' })

      for (const match of matches) {
        const packageDir = AbsolutePath(path.dirname(match))
        const packageJson = this.readPackageJson(packageDir)

        if (packageJson.name) {
          packages.set(packageJson.name, {
            name: packageJson.name,
            // publishName: packageJson.monocrate?.publishName,
            publishAs: packageJson.monocrate?.publishName ?? packageJson.name,
            fromDir: packageDir,
            pathInRepo: RelativePath(path.relative(monorepoRoot, packageDir)),
            packageJson,
          })
        }
      }
    }

    return packages
  }
}
