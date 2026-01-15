/**
 * Dependency Resolver Module
 *
 * This module handles discovering and resolving dependencies within a monorepo.
 * It can parse package.json files, identify in-repo vs third-party dependencies,
 * and build a complete dependency graph with topological ordering.
 */

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { glob } from 'glob'
import {
  PackageJsonSchema,
  type PackageJson,
  type MonorepoPackage,
  type DependencyGraph,
  type DependencyNode,
  type Dependencies,
  type WorkspaceConfig,
  COMMON_WORKSPACE_PATTERNS,
  PackageJsonError,
  CircularDependencyError,
  MonocrateError,
} from './types.js'

/**
 * Reads and parses a package.json file from the given directory
 *
 * @param dir - Absolute path to the directory containing package.json
 * @returns Parsed and validated PackageJson object
 * @throws PackageJsonError if file cannot be found, read, or parsed
 *
 * @example
 * ```typescript
 * const pkg = await findPackageJson('/path/to/package');
 * console.log(pkg.name, pkg.version);
 * ```
 */
export async function findPackageJson(dir: string): Promise<PackageJson> {
  const packageJsonPath = path.join(dir, 'package.json')

  let content: string
  try {
    content = await fs.readFile(packageJsonPath, 'utf-8')
  } catch (error) {
    const fsError = error as NodeJS.ErrnoException
    if (fsError.code === 'ENOENT') {
      throw new PackageJsonError(
        `package.json not found at ${packageJsonPath}`,
        dir,
        'Ensure the directory contains a valid package.json file.',
        fsError
      )
    }
    throw new PackageJsonError(
      `Failed to read package.json at ${packageJsonPath}`,
      dir,
      `File system error: ${fsError.message}`,
      fsError
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch (error) {
    throw new PackageJsonError(
      `Invalid JSON in package.json at ${packageJsonPath}`,
      dir,
      'Check the file for syntax errors (missing commas, unquoted keys, etc.).',
      error instanceof Error ? error : undefined
    )
  }

  const result = PackageJsonSchema.safeParse(parsed)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new PackageJsonError(
      `Invalid package.json structure at ${packageJsonPath}`,
      dir,
      `Validation errors:\n${issues}`
    )
  }

  return result.data
}

/**
 * Detects workspace configuration from the monorepo root
 *
 * @param monorepoRoot - Absolute path to the monorepo root directory
 * @returns Detected workspace configuration
 *
 * @example
 * ```typescript
 * const config = await detectWorkspaceConfig('/path/to/monorepo');
 * console.log(config.packageManager, config.patterns);
 * ```
 */
export async function detectWorkspaceConfig(
  monorepoRoot: string
): Promise<WorkspaceConfig> {
  // Check for pnpm workspace
  const pnpmWorkspacePath = path.join(monorepoRoot, 'pnpm-workspace.yaml')
  try {
    const pnpmContent = await fs.readFile(pnpmWorkspacePath, 'utf-8')
    // Simple YAML parsing for workspace patterns
    const patterns = extractPnpmWorkspacePatterns(pnpmContent)
    return {
      packageManager: 'pnpm',
      patterns,
      rootPath: monorepoRoot,
    }
  } catch {
    // pnpm-workspace.yaml not found, continue checking
  }

  // Check root package.json for workspaces field
  try {
    const rootPackageJson = await findPackageJson(monorepoRoot)
    if (rootPackageJson.workspaces) {
      const patterns = Array.isArray(rootPackageJson.workspaces)
        ? rootPackageJson.workspaces
        : rootPackageJson.workspaces.packages

      // Detect package manager from lock files
      const packageManager = await detectPackageManagerFromLockFile(
        monorepoRoot
      )

      return {
        packageManager,
        patterns,
        rootPath: monorepoRoot,
      }
    }
  } catch {
    // No root package.json or no workspaces field
  }

  // Fall back to common patterns
  return {
    packageManager: 'unknown',
    patterns: [...COMMON_WORKSPACE_PATTERNS],
    rootPath: monorepoRoot,
  }
}

/**
 * Extracts workspace patterns from pnpm-workspace.yaml content
 */
function extractPnpmWorkspacePatterns(content: string): string[] {
  const patterns: string[] = []
  const lines = content.split('\n')
  let inPackages = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === 'packages:') {
      inPackages = true
      continue
    }
    if (inPackages && trimmed.startsWith('-')) {
      // Extract pattern from "- 'packages/*'" or "- packages/*"
      const pattern = trimmed
        .slice(1)
        .trim()
        .replace(/^['"]|['"]$/g, '')
      if (pattern) {
        patterns.push(pattern)
      }
    } else if (inPackages && !trimmed.startsWith('-') && trimmed !== '') {
      // End of packages section
      inPackages = false
    }
  }

  return patterns.length > 0 ? patterns : [...COMMON_WORKSPACE_PATTERNS]
}

/**
 * Detects package manager from lock file presence
 */
async function detectPackageManagerFromLockFile(
  rootPath: string
): Promise<'npm' | 'yarn' | 'pnpm' | 'unknown'> {
  const lockFiles = [
    { file: 'pnpm-lock.yaml', manager: 'pnpm' as const },
    { file: 'yarn.lock', manager: 'yarn' as const },
    { file: 'package-lock.json', manager: 'npm' as const },
  ]

  for (const { file, manager } of lockFiles) {
    try {
      await fs.access(path.join(rootPath, file))
      return manager
    } catch {
      // Lock file not found, continue
    }
  }

  return 'unknown'
}

/**
 * Discovers all packages in the monorepo based on workspace patterns
 *
 * @param monorepoRoot - Absolute path to the monorepo root
 * @returns Map of package names to their MonorepoPackage info
 */
export async function discoverMonorepoPackages(
  monorepoRoot: string
): Promise<Map<string, MonorepoPackage>> {
  const config = await detectWorkspaceConfig(monorepoRoot)
  const packages = new Map<string, MonorepoPackage>()

  for (const pattern of config.patterns) {
    // Convert workspace pattern to glob pattern for package.json files
    const globPattern = path.join(monorepoRoot, pattern, 'package.json')
    const packageJsonPaths = await glob(globPattern, {
      ignore: ['**/node_modules/**'],
    })

    for (const packageJsonPath of packageJsonPaths) {
      const packageDir = path.dirname(packageJsonPath)
      try {
        const packageJson = await findPackageJson(packageDir)
        const distPath = path.join(packageDir, 'dist')
        const hasDistDirectory = await checkDirectoryExists(distPath)

        packages.set(packageJson.name, {
          path: packageDir,
          packageJson,
          distPath,
          hasDistDirectory,
        })
      } catch (error) {
        // Skip packages that can't be parsed, log warning
        if (error instanceof PackageJsonError) {
          console.warn(
            `Warning: Skipping package at ${packageDir}: ${error.message}`
          )
        }
      }
    }
  }

  return packages
}

/**
 * Checks if a directory exists
 */
async function checkDirectoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath)
    return stat.isDirectory()
  } catch {
    return false
  }
}

/**
 * Checks if a dependency is an in-repo package
 *
 * @param depName - The name of the dependency to check
 * @param monorepoPackages - Map of known monorepo packages
 * @returns True if the dependency is an in-repo package
 *
 * @example
 * ```typescript
 * const packages = await discoverMonorepoPackages('/path/to/monorepo');
 * const isInRepo = isInRepoDependency('@myorg/utils', packages);
 * ```
 */
export function isInRepoDependency(
  depName: string,
  monorepoPackages: Map<string, MonorepoPackage>
): boolean {
  return monorepoPackages.has(depName)
}

/**
 * Extracts in-repo and third-party dependencies from a package.json
 *
 * @param packageJson - The package.json to analyze
 * @param monorepoPackages - Map of known monorepo packages
 * @returns Object containing separated dependencies
 */
export function separateDependencies(
  packageJson: PackageJson,
  monorepoPackages: Map<string, MonorepoPackage>
): { inRepo: string[]; thirdParty: Dependencies } {
  const deps = packageJson.dependencies ?? {}
  const inRepo: string[] = []
  const thirdParty: Dependencies = {}

  for (const [name, version] of Object.entries(deps)) {
    if (isInRepoDependency(name, monorepoPackages)) {
      inRepo.push(name)
    } else {
      thirdParty[name] = version
    }
  }

  return { inRepo, thirdParty }
}

/**
 * Recursively resolves all in-repo dependencies for a package
 *
 * @param packagePath - Absolute path to the package to resolve
 * @param monorepoRoot - Absolute path to the monorepo root
 * @returns Set of all in-repo dependency names (including transitive)
 * @throws CircularDependencyError if a circular dependency is detected
 *
 * @example
 * ```typescript
 * const deps = await resolveInRepoDeps(
 *   '/path/to/monorepo/packages/my-app',
 *   '/path/to/monorepo'
 * );
 * console.log('All in-repo deps:', [...deps]);
 * ```
 */
export async function resolveInRepoDeps(
  packagePath: string,
  monorepoRoot: string
): Promise<Set<string>> {
  const monorepoPackages = await discoverMonorepoPackages(monorepoRoot)
  const packageJson = await findPackageJson(packagePath)

  const visited = new Set<string>()
  const visiting = new Set<string>() // For cycle detection
  const result = new Set<string>()

  async function visit(pkgName: string, chain: string[]): Promise<void> {
    if (visited.has(pkgName)) {
      return
    }

    if (visiting.has(pkgName)) {
      const cycleStart = chain.indexOf(pkgName)
      const cycle = chain.slice(cycleStart).concat(pkgName)
      throw new CircularDependencyError(
        `Circular dependency detected`,
        cycle,
        `Dependency chain: ${cycle.join(' -> ')}\n\n` +
          `To resolve: Remove one direction of the dependency,\n` +
          `or extract shared code into a third package.`
      )
    }

    visiting.add(pkgName)

    const pkg = monorepoPackages.get(pkgName)
    if (pkg) {
      result.add(pkgName)
      const { inRepo } = separateDependencies(pkg.packageJson, monorepoPackages)

      for (const depName of inRepo) {
        await visit(depName, [...chain, pkgName])
      }
    }

    visiting.delete(pkgName)
    visited.add(pkgName)
  }

  // Start from the root package's dependencies
  const { inRepo } = separateDependencies(packageJson, monorepoPackages)
  for (const depName of inRepo) {
    await visit(depName, [packageJson.name])
  }

  return result
}

/**
 * Builds a complete dependency graph for a package
 *
 * @param packagePath - Absolute path to the package to analyze
 * @param monorepoRoot - Absolute path to the monorepo root
 * @returns Complete dependency graph with topological ordering
 * @throws CircularDependencyError if a circular dependency is detected
 * @throws PackageJsonError if package.json cannot be read or is invalid
 *
 * @example
 * ```typescript
 * const graph = await buildDependencyGraph(
 *   '/path/to/monorepo/packages/my-app',
 *   '/path/to/monorepo'
 * );
 *
 * console.log('Root package:', graph.root.package.packageJson.name);
 * console.log('Build order:', graph.topologicalOrder);
 *
 * for (const [name, node] of graph.nodes) {
 *   console.log(`${name}:`, node.inRepoDependencies);
 * }
 * ```
 */
export async function buildDependencyGraph(
  packagePath: string,
  monorepoRoot: string
): Promise<DependencyGraph> {
  const monorepoPackages = await discoverMonorepoPackages(monorepoRoot)
  const rootPackageJson = await findPackageJson(packagePath)

  // Check if the root package exists in monorepo packages map
  // If not, create an entry for it
  const distPath = path.join(packagePath, 'dist')
  const rootPackage: MonorepoPackage = monorepoPackages.get(
    rootPackageJson.name
  ) ?? {
    path: packagePath,
    packageJson: rootPackageJson,
    distPath,
    hasDistDirectory: await checkDirectoryExists(distPath),
  }

  // Build the graph using depth-first traversal with cycle detection
  const nodes = new Map<string, DependencyNode>()
  const visiting = new Set<string>()
  const topologicalOrder: string[] = []

  async function visit(pkgName: string, chain: string[]): Promise<void> {
    if (nodes.has(pkgName)) {
      return
    }

    if (visiting.has(pkgName)) {
      const cycleStart = chain.indexOf(pkgName)
      const cycle = chain.slice(cycleStart).concat(pkgName)
      throw new CircularDependencyError(
        `Circular dependency detected`,
        cycle,
        `Dependency chain: ${cycle.join(' -> ')}\n\n` +
          `To resolve: Remove one direction of the dependency,\n` +
          `or extract shared code into a third package.`
      )
    }

    const pkg = monorepoPackages.get(pkgName)
    if (!pkg) {
      throw new MonocrateError(
        `Package '${pkgName}' not found in monorepo`,
        `Referenced by: ${chain[chain.length - 1] ?? 'root'}\n` +
          `Ensure the package exists and is included in workspace patterns.`
      )
    }

    visiting.add(pkgName)

    const { inRepo, thirdParty } = separateDependencies(
      pkg.packageJson,
      monorepoPackages
    )

    // Visit dependencies first (for topological ordering)
    for (const depName of inRepo) {
      await visit(depName, [...chain, pkgName])
    }

    visiting.delete(pkgName)

    // Add to graph after all dependencies are processed
    nodes.set(pkgName, {
      package: pkg,
      inRepoDependencies: inRepo,
      thirdPartyDependencies: thirdParty,
    })

    topologicalOrder.push(pkgName)
  }

  // Start with the root package
  const { inRepo, thirdParty } = separateDependencies(
    rootPackageJson,
    monorepoPackages
  )

  // Visit all in-repo dependencies first
  for (const depName of inRepo) {
    await visit(depName, [rootPackageJson.name])
  }

  // Add the root package last (it depends on everything else)
  const rootNode: DependencyNode = {
    package: rootPackage,
    inRepoDependencies: inRepo,
    thirdPartyDependencies: thirdParty,
  }

  nodes.set(rootPackageJson.name, rootNode)
  topologicalOrder.push(rootPackageJson.name)

  return {
    root: rootNode,
    nodes,
    topologicalOrder,
  }
}
