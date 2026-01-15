/**
 * Monocrate - From monorepo to npm in one command
 *
 * This is the main entry point for the monocrate package bundler.
 * It provides both a programmatic API and exports all core modules
 * for advanced usage.
 *
 * @packageDocumentation
 */

import * as path from 'node:path'

// Re-export all types
export {
  type PackageJson,
  type MonorepoPackage,
  type DependencyGraph,
  type DependencyNode,
  type Dependencies,
  type BundleOptions,
  type BundleOptionsInput,
  type BundleResult,
  type BundleSuccess,
  type BundleFailure,
  type VersionConflict,
  type WorkspaceConfig,
  PackageJsonSchema,
  BundleOptionsSchema,
  MonocrateError,
  PackageJsonError,
  CircularDependencyError,
  VersionConflictError,
  FileSystemError,
} from './core/types.js'

// Re-export dependency resolver functions
export {
  findPackageJson,
  detectWorkspaceConfig,
  discoverMonorepoPackages,
  isInRepoDependency,
  separateDependencies,
  resolveInRepoDeps,
  buildDependencyGraph,
} from './core/dependency-resolver.js'

// Re-export bundle assembler functions
export {
  createOutputDir,
  copyDistDirectory,
  copyDependencyDist,
  assembleBundle,
  validateDistDirectories,
  type CopyOptions,
  type CopyResult,
  type AssemblyResult,
} from './core/bundle-assembler.js'

// Re-export package transformer functions
export {
  extractThirdPartyDeps,
  mergeVersions,
  generatePackageJson,
  removeInRepoDeps,
  transformPackageJson,
  writePackageJson,
  type TransformOptions,
  type ExtractedDependencies,
} from './core/package-transformer.js'

import { buildDependencyGraph } from './core/dependency-resolver.js'
import { assembleBundle, validateDistDirectories } from './core/bundle-assembler.js'
import {
  transformPackageJson,
  writePackageJson,
} from './core/package-transformer.js'
import {
  type BundleOptions,
  type BundleOptionsInput,
  type BundleResult,
  BundleOptionsSchema,
  MonocrateError,
} from './core/types.js'

/**
 * Current version of monocrate
 */
export const VERSION = '1.0.0'

/**
 * Main entry point for bundling a monorepo package for npm publishing.
 *
 * This function orchestrates the complete bundling process:
 * 1. Builds the dependency graph for the target package
 * 2. Validates that all packages have been built (dist directories exist)
 * 3. Assembles the bundle by copying all compiled code
 * 4. Transforms and writes the package.json with merged dependencies
 *
 * @param options - Configuration options for the bundle operation
 * @returns A promise that resolves to the bundle result
 *
 * @example
 * ```typescript
 * import { bundle } from 'monocrate';
 *
 * const result = await bundle({
 *   packagePath: '/path/to/monorepo/packages/my-app',
 *   monorepoRoot: '/path/to/monorepo',
 *   outputDir: '/tmp/my-app-bundle',
 * });
 *
 * if (result.success) {
 *   console.log('Bundle created at:', result.outputPath);
 *   console.log('Included packages:', result.includedPackages);
 * } else {
 *   console.error('Bundle failed:', result.error);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // With all options
 * const result = await bundle({
 *   packagePath: '/path/to/package',
 *   monorepoRoot: '/path/to/monorepo',
 *   outputDir: '/tmp/bundle',
 *   includeSourceMaps: true,
 *   includeDeclarations: true,
 *   versionConflictStrategy: 'warn', // or 'error' or 'highest'
 *   cleanOutputDir: true,
 *   distDirName: 'dist',
 * });
 * ```
 */
export async function bundle(
  options: BundleOptionsInput
): Promise<BundleResult> {
  try {
    // Validate and apply defaults to options
    const parseResult = BundleOptionsSchema.safeParse(options)
    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
        .join('\n')
      return {
        success: false,
        error: 'Invalid bundle options',
        details: `Validation errors:\n${issues}`,
      }
    }

    const validatedOptions: BundleOptions = parseResult.data

    // Step 1: Build the dependency graph
    const graph = await buildDependencyGraph(
      validatedOptions.packagePath,
      validatedOptions.monorepoRoot
    )

    // Step 2: Validate that all packages have dist directories
    const missingDist = validateDistDirectories(graph)
    if (missingDist.length > 0) {
      return {
        success: false,
        error: 'Some packages have not been built',
        details:
          `The following packages are missing dist directories:\n` +
          missingDist.map((p) => `  - ${p}`).join('\n') +
          `\n\nTo resolve: Run the build command for these packages first.`,
      }
    }

    // Step 3: Assemble the bundle
    const assemblyResult = await assembleBundle(graph, validatedOptions)

    // Step 4: Transform and write package.json
    const { packageJson, conflicts } = transformPackageJson(
      graph,
      validatedOptions
    )

    // Write the package.json to the output directory
    const packageJsonPath = path.join(validatedOptions.outputDir, 'package.json')
    await writePackageJson(packageJson, packageJsonPath)

    return {
      success: true,
      outputPath: assemblyResult.outputPath,
      packageJson,
      mergedDependencies: packageJson.dependencies ?? {},
      includedPackages: assemblyResult.assembledPackages,
      versionConflicts: conflicts,
    }
  } catch (error) {
    if (error instanceof MonocrateError) {
      return {
        success: false,
        error: error.message,
        details: error.details,
        cause: error.cause,
      }
    }

    // Unexpected error
    const err = error instanceof Error ? error : new Error(String(error))
    return {
      success: false,
      error: 'Unexpected error during bundling',
      details: err.message,
      cause: err,
    }
  }
}

/**
 * Convenience function to bundle a package using the current working directory
 * as the monorepo root.
 *
 * @param packageName - Name of the package to bundle (relative to workspace)
 * @param outputDir - Output directory for the bundle
 * @returns A promise that resolves to the bundle result
 *
 * @example
 * ```typescript
 * import { bundlePackage } from 'monocrate';
 *
 * // When running from monorepo root
 * const result = await bundlePackage('my-app', '/tmp/bundle');
 * ```
 */
export async function bundlePackage(
  packageName: string,
  outputDir: string
): Promise<BundleResult> {
  const { discoverMonorepoPackages } = await import(
    './core/dependency-resolver.js'
  )

  const monorepoRoot = process.cwd()
  const packages = await discoverMonorepoPackages(monorepoRoot)
  const pkg = packages.get(packageName)

  if (!pkg) {
    return {
      success: false,
      error: `Package '${packageName}' not found in monorepo`,
      details:
        `Could not find package with name '${packageName}'.\n\n` +
        `Available packages:\n` +
        [...packages.keys()].map((n) => `  - ${n}`).join('\n'),
    }
  }

  return bundle({
    packagePath: pkg.path,
    monorepoRoot,
    outputDir,
  })
}
