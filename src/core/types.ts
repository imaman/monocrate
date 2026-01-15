/**
 * Core type definitions for Monocrate
 *
 * This module contains all shared type definitions used throughout the
 * monocrate bundler, including package.json structures, dependency graphs,
 * and bundle configuration options.
 */

import { z } from 'zod'

// ============================================================================
// Package.json Types
// ============================================================================

/**
 * Schema for validating package.json dependencies object
 */
export const DependenciesSchema = z.record(z.string(), z.string())

/**
 * A record of package names to version specifiers
 */
export type Dependencies = z.infer<typeof DependenciesSchema>

/**
 * Schema for validating package.json structure
 */
export const PackageJsonSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  main: z.string().optional(),
  module: z.string().optional(),
  types: z.string().optional(),
  type: z.enum(['module', 'commonjs']).optional(),
  exports: z.record(z.string(), z.unknown()).optional(),
  files: z.array(z.string()).optional(),
  bin: z.union([z.string(), z.record(z.string(), z.string())]).optional(),
  scripts: z.record(z.string(), z.string()).optional(),
  dependencies: DependenciesSchema.optional(),
  devDependencies: DependenciesSchema.optional(),
  peerDependencies: DependenciesSchema.optional(),
  optionalDependencies: DependenciesSchema.optional(),
  engines: z.record(z.string(), z.string()).optional(),
  repository: z
    .union([
      z.string(),
      z.object({
        type: z.string(),
        url: z.string(),
        directory: z.string().optional(),
      }),
    ])
    .optional(),
  keywords: z.array(z.string()).optional(),
  author: z
    .union([
      z.string(),
      z.object({
        name: z.string(),
        email: z.string().optional(),
        url: z.string().optional(),
      }),
    ])
    .optional(),
  license: z.string().optional(),
  bugs: z
    .union([
      z.string(),
      z.object({
        url: z.string().optional(),
        email: z.string().optional(),
      }),
    ])
    .optional(),
  homepage: z.string().optional(),
  private: z.boolean().optional(),
  workspaces: z
    .union([z.array(z.string()), z.object({ packages: z.array(z.string()) })])
    .optional(),
  publishConfig: z.record(z.string(), z.unknown()).optional(),
})

/**
 * Validated package.json structure
 */
export type PackageJson = z.infer<typeof PackageJsonSchema>

// ============================================================================
// Monorepo Package Types
// ============================================================================

/**
 * Represents a package within the monorepo
 */
export interface MonorepoPackage {
  /** Absolute path to the package directory */
  readonly path: string
  /** Parsed and validated package.json contents */
  readonly packageJson: PackageJson
  /** Absolute path to the dist/compiled output directory */
  readonly distPath: string
  /** Whether the dist directory exists */
  readonly hasDistDirectory: boolean
}

// ============================================================================
// Dependency Graph Types
// ============================================================================

/**
 * A node in the dependency graph representing a single package
 */
export interface DependencyNode {
  /** The monorepo package this node represents */
  readonly package: MonorepoPackage
  /** Names of packages this package depends on (in-repo only) */
  readonly inRepoDependencies: readonly string[]
  /** Names of third-party (external) dependencies */
  readonly thirdPartyDependencies: Readonly<Dependencies>
}

/**
 * Complete dependency graph for a package and all its in-repo dependencies
 */
export interface DependencyGraph {
  /** The root package being bundled */
  readonly root: DependencyNode
  /** Map of package names to their dependency nodes */
  readonly nodes: ReadonlyMap<string, DependencyNode>
  /** Topologically sorted list of package names (dependencies before dependents) */
  readonly topologicalOrder: readonly string[]
}

// ============================================================================
// Bundle Configuration Types
// ============================================================================

/**
 * Schema for bundle options validation
 */
export const BundleOptionsSchema = z.object({
  /** Absolute path to the package to bundle */
  packagePath: z.string(),
  /** Absolute path to the monorepo root directory */
  monorepoRoot: z.string(),
  /** Absolute path to the output directory for the bundle */
  outputDir: z.string(),
  /** Whether to include source maps in the bundle */
  includeSourceMaps: z.boolean().optional().default(true),
  /** Whether to include declaration files (.d.ts) in the bundle */
  includeDeclarations: z.boolean().optional().default(true),
  /** Strategy for handling version conflicts between dependencies */
  versionConflictStrategy: z
    .enum(['highest', 'error', 'warn'])
    .optional()
    .default('warn'),
  /** Whether to clean the output directory before bundling */
  cleanOutputDir: z.boolean().optional().default(true),
  /** Custom dist directory name (defaults to 'dist') */
  distDirName: z.string().optional().default('dist'),
})

/**
 * Configuration options for the bundle operation
 */
export type BundleOptions = z.infer<typeof BundleOptionsSchema>

/**
 * Input options before defaults are applied
 */
export type BundleOptionsInput = z.input<typeof BundleOptionsSchema>

// ============================================================================
// Bundle Result Types
// ============================================================================

/**
 * Information about a version conflict detected during bundling
 */
export interface VersionConflict {
  /** Name of the conflicting dependency */
  readonly dependencyName: string
  /** Map of package names to their required versions */
  readonly versions: ReadonlyMap<string, string>
  /** The version that was selected for the merged package.json */
  readonly resolvedVersion: string
}

/**
 * Result of a successful bundle operation
 */
export interface BundleSuccess {
  readonly success: true
  /** Absolute path to the output directory */
  readonly outputPath: string
  /** The generated package.json for publishing */
  readonly packageJson: PackageJson
  /** All merged third-party dependencies */
  readonly mergedDependencies: Readonly<Dependencies>
  /** List of packages that were included in the bundle */
  readonly includedPackages: readonly string[]
  /** Any version conflicts that were encountered and resolved */
  readonly versionConflicts: readonly VersionConflict[]
}

/**
 * Result of a failed bundle operation
 */
export interface BundleFailure {
  readonly success: false
  /** Error message describing what went wrong */
  readonly error: string
  /** Additional context or suggestions for fixing the error */
  readonly details?: string | undefined
  /** The underlying error if available */
  readonly cause?: Error | undefined
}

/**
 * Result of a bundle operation (success or failure)
 */
export type BundleResult = BundleSuccess | BundleFailure

// ============================================================================
// Workspace Configuration Types
// ============================================================================

/**
 * Common workspace patterns used by package managers
 */
export const COMMON_WORKSPACE_PATTERNS = [
  'packages/*',
  'libs/*',
  'apps/*',
  'modules/*',
  'services/*',
] as const

/**
 * Detected workspace configuration from a monorepo
 */
export interface WorkspaceConfig {
  /** The package manager detected (npm, yarn, pnpm) */
  readonly packageManager: 'npm' | 'yarn' | 'pnpm' | 'unknown'
  /** Glob patterns for workspace package locations */
  readonly patterns: readonly string[]
  /** Absolute path to the monorepo root */
  readonly rootPath: string
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Base class for all Monocrate errors
 */
export class MonocrateError extends Error {
  constructor(
    message: string,
    public readonly details?: string,
    public override readonly cause?: Error
  ) {
    super(message)
    this.name = 'MonocrateError'
  }
}

/**
 * Error thrown when a package.json cannot be found or parsed
 */
export class PackageJsonError extends MonocrateError {
  constructor(
    message: string,
    public readonly packagePath: string,
    details?: string,
    cause?: Error
  ) {
    super(message, details, cause)
    this.name = 'PackageJsonError'
  }
}

/**
 * Error thrown when a circular dependency is detected
 */
export class CircularDependencyError extends MonocrateError {
  constructor(
    message: string,
    public readonly cycle: readonly string[],
    details?: string
  ) {
    super(message, details)
    this.name = 'CircularDependencyError'
  }
}

/**
 * Error thrown when there's a version conflict that cannot be resolved
 */
export class VersionConflictError extends MonocrateError {
  constructor(
    message: string,
    public readonly conflicts: readonly VersionConflict[],
    details?: string
  ) {
    super(message, details)
    this.name = 'VersionConflictError'
  }
}

/**
 * Error thrown when file system operations fail
 */
export class FileSystemError extends MonocrateError {
  constructor(
    message: string,
    public readonly path: string,
    details?: string,
    cause?: Error
  ) {
    super(message, details, cause)
    this.name = 'FileSystemError'
  }
}
