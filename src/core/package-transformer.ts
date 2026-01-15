/**
 * Package Transformer Module
 *
 * This module handles transforming package.json for publishing.
 * It extracts third-party dependencies from all in-repo packages,
 * merges version specifications, and generates a publish-ready package.json.
 */

import * as semver from 'semver'
import {
  type PackageJson,
  type DependencyGraph,
  type DependencyNode,
  type Dependencies,
  type VersionConflict,
  type BundleOptions,
  VersionConflictError,
  MonocrateError,
} from './types.js'

/**
 * Options for package transformation
 */
export interface TransformOptions {
  /** Strategy for handling version conflicts */
  versionConflictStrategy: 'highest' | 'error' | 'warn'
  /** Whether to preserve dev dependencies in output */
  preserveDevDependencies?: boolean
  /** Whether to preserve peer dependencies in output */
  preservePeerDependencies?: boolean
  /** Additional fields to remove from package.json */
  removeFields?: string[]
  /** Additional fields to preserve in package.json */
  preserveFields?: string[]
}

/**
 * Result of extracting third-party dependencies
 */
export interface ExtractedDependencies {
  /** All third-party dependencies collected from all packages */
  dependencies: Dependencies
  /** Version conflicts encountered during extraction */
  conflicts: VersionConflict[]
}

/**
 * Fields that should be removed from package.json when publishing
 * These are typically workspace-specific or local development fields
 */
const WORKSPACE_FIELDS_TO_REMOVE = [
  'workspaces',
  'private',
  'devDependencies', // Usually removed unless explicitly preserved
  'scripts', // Build scripts are typically not needed in published package
] as const

/**
 * Fields that should be preserved in the published package.json
 */
const FIELDS_TO_PRESERVE = [
  'name',
  'version',
  'description',
  'main',
  'module',
  'types',
  'type',
  'exports',
  'files',
  'bin',
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
  'engines',
  'repository',
  'keywords',
  'author',
  'license',
  'bugs',
  'homepage',
  'publishConfig',
] as const

/**
 * Extracts all third-party dependencies from a collection of packages
 *
 * @param packages - Iterator of dependency nodes to extract from
 * @param options - Transform options including conflict strategy
 * @returns Extracted dependencies and any conflicts encountered
 *
 * @example
 * ```typescript
 * const graph = await buildDependencyGraph(packagePath, monorepoRoot);
 * const { dependencies, conflicts } = extractThirdPartyDeps(
 *   graph.nodes.values(),
 *   { versionConflictStrategy: 'warn' }
 * );
 * ```
 */
export function extractThirdPartyDeps(
  packages: Iterable<DependencyNode>,
  options: TransformOptions
): ExtractedDependencies {
  // Map of dependency name to map of package name to version
  const depsVersionMap = new Map<string, Map<string, string>>()

  // Collect all third-party dependencies from all packages
  for (const node of packages) {
    for (const [depName, version] of Object.entries(
      node.thirdPartyDependencies
    )) {
      let versions = depsVersionMap.get(depName)
      if (!versions) {
        versions = new Map()
        depsVersionMap.set(depName, versions)
      }
      versions.set(node.package.packageJson.name, version)
    }
  }

  // Merge dependencies and detect conflicts
  const dependencies: Dependencies = {}
  const conflicts: VersionConflict[] = []

  for (const [depName, versions] of depsVersionMap) {
    const uniqueVersions = new Set(versions.values())

    if (uniqueVersions.size === 1) {
      // No conflict - all packages use the same version
      // Safe to access first element since we checked size === 1
      dependencies[depName] = [...uniqueVersions][0] ?? ''
    } else {
      // Version conflict detected
      const resolvedVersion = resolveVersionConflict(
        depName,
        versions,
        options.versionConflictStrategy
      )

      conflicts.push({
        dependencyName: depName,
        versions,
        resolvedVersion,
      })

      dependencies[depName] = resolvedVersion
    }
  }

  return { dependencies, conflicts }
}

/**
 * Resolves a version conflict between multiple packages
 *
 * @param depName - Name of the conflicting dependency
 * @param versions - Map of package names to their required versions
 * @param strategy - Strategy for resolving the conflict
 * @returns The resolved version string
 * @throws VersionConflictError if strategy is 'error'
 */
function resolveVersionConflict(
  depName: string,
  versions: Map<string, string>,
  strategy: 'highest' | 'error' | 'warn'
): string {
  const versionList = [...versions.entries()]

  if (strategy === 'error') {
    const details = versionList
      .map(([pkg, ver]) => `  - ${pkg}: ${ver}`)
      .join('\n')
    throw new VersionConflictError(
      `Version conflict for dependency '${depName}'`,
      [
        {
          dependencyName: depName,
          versions,
          resolvedVersion: '',
        },
      ],
      `Multiple packages require different versions:\n${details}\n\n` +
        `To resolve:\n` +
        `  1. Align all packages to use the same version\n` +
        `  2. Use 'warn' or 'highest' conflict strategy`
    )
  }

  // Find the highest version using semver
  const highestVersion = findHighestVersion(versions)

  if (strategy === 'warn') {
    const details = versionList
      .map(([pkg, ver]) => `  - ${pkg}: ${ver}`)
      .join('\n')
    console.warn(
      `Warning: Version conflict for '${depName}':\n${details}\n` +
        `  Resolved to: ${highestVersion}`
    )
  }

  return highestVersion
}

/**
 * Finds the highest semver version from a map of versions
 *
 * @param versions - Map of package names to version specifiers
 * @returns The highest valid semver version, or the first version if none are valid
 */
function findHighestVersion(versions: Map<string, string>): string {
  const versionStrings = [...versions.values()]

  // Try to parse each version and find the highest
  let highest: string | null = null
  let highestParsed: semver.SemVer | null = null

  for (const ver of versionStrings) {
    // Clean the version string (remove ^, ~, etc.)
    const cleanVer = semver.coerce(ver)

    if (cleanVer) {
      if (!highestParsed || semver.gt(cleanVer, highestParsed)) {
        highestParsed = cleanVer
        // Preserve the original specifier format if possible
        highest = ver
      }
    }
  }

  // If we found a valid highest, return it
  // Otherwise return the first version
  return highest ?? versionStrings[0] ?? '*'
}

/**
 * Merges version specifications for the same dependency
 * Prefers the highest semver-compatible version
 *
 * @param deps - Array of dependency objects to merge
 * @returns Merged dependencies object
 *
 * @example
 * ```typescript
 * const merged = mergeVersions([
 *   { lodash: '^4.17.0' },
 *   { lodash: '^4.17.21', axios: '^1.0.0' }
 * ]);
 * // Result: { lodash: '^4.17.21', axios: '^1.0.0' }
 * ```
 */
export function mergeVersions(deps: Dependencies[]): Dependencies {
  const versionMap = new Map<string, Map<string, string>>()

  // Collect all versions for each dependency
  for (let i = 0; i < deps.length; i++) {
    const depObj = deps[i]
    if (!depObj) continue

    for (const [name, version] of Object.entries(depObj)) {
      let versions = versionMap.get(name)
      if (!versions) {
        versions = new Map()
        versionMap.set(name, versions)
      }
      versions.set(`package-${String(i)}`, version)
    }
  }

  // Merge to highest version
  const result: Dependencies = {}
  for (const [name, versions] of versionMap) {
    result[name] = findHighestVersion(versions)
  }

  return result
}

/**
 * Generates a publish-ready package.json
 *
 * @param originalPkg - The original package.json of the root package
 * @param mergedDeps - The merged third-party dependencies
 * @param options - Transform options
 * @returns Transformed package.json ready for publishing
 *
 * @example
 * ```typescript
 * const publishPkg = generatePackageJson(
 *   originalPackageJson,
 *   mergedDependencies,
 *   { versionConflictStrategy: 'warn' }
 * );
 * ```
 */
export function generatePackageJson(
  originalPkg: PackageJson,
  mergedDeps: Dependencies,
  options: TransformOptions
): PackageJson {
  // Start with preserved fields from original
  const result: Record<string, unknown> = {}

  // Copy preserved fields
  const fieldsToPreserve = new Set([
    ...FIELDS_TO_PRESERVE,
    ...(options.preserveFields ?? []),
  ])

  const fieldsToRemove = new Set([
    ...WORKSPACE_FIELDS_TO_REMOVE,
    ...(options.removeFields ?? []),
  ])

  // Handle dev dependencies based on options
  if (options.preserveDevDependencies) {
    // Remove from fieldsToRemove and add to preserve
    fieldsToRemove.delete('devDependencies')
    fieldsToPreserve.add('devDependencies')
  }

  // Handle peer dependencies
  if (options.preservePeerDependencies !== false) {
    fieldsToPreserve.add('peerDependencies')
  }

  // Copy all preserved fields that aren't being removed
  for (const field of fieldsToPreserve) {
    if (
      !fieldsToRemove.has(field) &&
      field in originalPkg &&
      originalPkg[field as keyof PackageJson] !== undefined
    ) {
      result[field] = originalPkg[field as keyof PackageJson]
    }
  }

  // Replace dependencies with merged version
  result.dependencies = mergedDeps

  // Ensure required fields are present
  if (!result.name) {
    throw new MonocrateError(
      'Package name is required',
      'The original package.json must have a "name" field.'
    )
  }

  if (!result.version) {
    throw new MonocrateError(
      'Package version is required',
      'The original package.json must have a "version" field.'
    )
  }

  return result as PackageJson
}

/**
 * Removes in-repo dependencies from a dependencies object
 *
 * @param deps - The dependencies object to filter
 * @param inRepoPackageNames - Set of in-repo package names to remove
 * @returns Filtered dependencies without in-repo packages
 */
export function removeInRepoDeps(
  deps: Dependencies,
  inRepoPackageNames: Set<string>
): Dependencies {
  const result: Dependencies = {}

  for (const [name, version] of Object.entries(deps)) {
    if (!inRepoPackageNames.has(name)) {
      result[name] = version
    }
  }

  return result
}

/**
 * Transforms a package.json for the complete dependency graph
 *
 * @param graph - The dependency graph
 * @param options - Bundle options
 * @returns Object containing transformed package.json and conflicts
 *
 * @example
 * ```typescript
 * const graph = await buildDependencyGraph(packagePath, monorepoRoot);
 * const { packageJson, conflicts } = transformPackageJson(graph, bundleOptions);
 *
 * if (conflicts.length > 0) {
 *   console.warn('Version conflicts detected:', conflicts);
 * }
 * ```
 */
export function transformPackageJson(
  graph: DependencyGraph,
  options: BundleOptions
): { packageJson: PackageJson; conflicts: VersionConflict[] } {
  const transformOptions: TransformOptions = {
    versionConflictStrategy: options.versionConflictStrategy,
    preserveDevDependencies: false,
    preservePeerDependencies: true,
  }

  // Extract all third-party dependencies
  const { dependencies, conflicts } = extractThirdPartyDeps(
    graph.nodes.values(),
    transformOptions
  )

  // Remove any in-repo dependencies that might have been included
  const inRepoNames = new Set(graph.nodes.keys())
  const filteredDeps = removeInRepoDeps(dependencies, inRepoNames)

  // Generate the final package.json
  const packageJson = generatePackageJson(
    graph.root.package.packageJson,
    filteredDeps,
    transformOptions
  )

  return { packageJson, conflicts }
}

/**
 * Writes a package.json to disk
 *
 * @param packageJson - The package.json to write
 * @param outputPath - The path to write to
 */
export async function writePackageJson(
  packageJson: PackageJson,
  outputPath: string
): Promise<void> {
  const { writeFile } = await import('node:fs/promises')
  const content = JSON.stringify(packageJson, null, 2) + '\n'
  await writeFile(outputPath, content, 'utf-8')
}
