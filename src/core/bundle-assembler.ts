/**
 * Bundle Assembler Module
 *
 * This module handles the file system operations for assembling a bundle.
 * It creates output directories, copies compiled code from in-repo dependencies,
 * and handles the physical assembly of the publishable package.
 */

import * as fs from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import * as path from 'node:path'
import {
  type DependencyGraph,
  type MonorepoPackage,
  type BundleOptions,
  FileSystemError,
  MonocrateError,
} from './types.js'

/**
 * Options for copying files
 */
export interface CopyOptions {
  /** Whether to include source map files (.map) */
  includeSourceMaps: boolean
  /** Whether to include declaration files (.d.ts) */
  includeDeclarations: boolean
  /** File patterns to exclude (glob patterns) */
  excludePatterns?: string[]
}

/**
 * Result of a copy operation
 */
export interface CopyResult {
  /** Number of files copied */
  filesCopied: number
  /** Total size of copied files in bytes */
  totalSize: number
  /** List of copied file paths (relative to output) */
  files: string[]
}

/**
 * Result of the bundle assembly operation
 */
export interface AssemblyResult {
  /** Absolute path to the output directory */
  outputPath: string
  /** List of packages that were assembled */
  assembledPackages: string[]
  /** Total number of files copied */
  totalFilesCopied: number
  /** Total size of all copied files in bytes */
  totalSize: number
}

/**
 * Creates and prepares the output directory for the bundle
 *
 * @param outputPath - Absolute path to the output directory
 * @param clean - Whether to clean the directory if it exists (default: true)
 * @returns The absolute path to the created directory
 * @throws FileSystemError if directory cannot be created
 *
 * @example
 * ```typescript
 * const outputDir = await createOutputDir('/tmp/my-bundle', true);
 * console.log('Bundle will be created at:', outputDir);
 * ```
 */
export async function createOutputDir(
  outputPath: string,
  clean = true
): Promise<string> {
  // Validate the output path
  if (!path.isAbsolute(outputPath)) {
    throw new FileSystemError(
      `Output path must be absolute`,
      outputPath,
      `Received relative path: ${outputPath}\nUse path.resolve() to convert to absolute path.`
    )
  }

  // Note: We require absolute paths which eliminates path traversal concerns.
  // The caller is responsible for ensuring the output path is appropriate.

  try {
    if (clean) {
      // Remove existing directory if it exists
      await fs.rm(outputPath, { recursive: true, force: true })
    }

    // Create the directory
    await fs.mkdir(outputPath, { recursive: true })

    return outputPath
  } catch (error) {
    const fsError = error as NodeJS.ErrnoException
    throw new FileSystemError(
      `Failed to create output directory`,
      outputPath,
      `Error: ${fsError.message}\n\nEnsure you have write permissions to the parent directory.`,
      fsError
    )
  }
}

/**
 * Copies a single file with proper error handling
 */
async function copyFile(src: string, dest: string): Promise<void> {
  const destDir = path.dirname(dest)
  await fs.mkdir(destDir, { recursive: true })
  await fs.copyFile(src, dest)
}

/**
 * Recursively copies a directory with filtering options
 */
async function copyDirectoryRecursive(
  srcDir: string,
  destDir: string,
  options: CopyOptions,
  relativePath = ''
): Promise<CopyResult> {
  const result: CopyResult = {
    filesCopied: 0,
    totalSize: 0,
    files: [],
  }

  let entries: Dirent[]
  try {
    entries = await fs.readdir(srcDir, { withFileTypes: true })
  } catch {
    // Directory doesn't exist or can't be read
    return result
  }

  for (const entry of entries) {
    const entryName = entry.name
    const srcPath = path.join(srcDir, entryName)
    const destPath = path.join(destDir, entryName)
    const currentRelativePath = path.join(relativePath, entryName)

    // Handle symlinks safely - don't follow them
    if (entry.isSymbolicLink()) {
      // Skip symlinks for security
      continue
    }

    if (entry.isDirectory()) {
      // Skip node_modules and other excluded directories
      if (entryName === 'node_modules' || entryName === '.git') {
        continue
      }

      const subResult = await copyDirectoryRecursive(
        srcPath,
        destPath,
        options,
        currentRelativePath
      )
      result.filesCopied += subResult.filesCopied
      result.totalSize += subResult.totalSize
      result.files.push(...subResult.files)
    } else if (entry.isFile()) {
      // Apply file filters
      if (!shouldIncludeFile(entryName, options)) {
        continue
      }

      try {
        const stats = await fs.stat(srcPath)
        await copyFile(srcPath, destPath)
        result.filesCopied++
        result.totalSize += stats.size
        result.files.push(currentRelativePath)
      } catch {
        // Log warning but continue with other files
        console.warn(`Warning: Could not copy file ${srcPath}`)
      }
    }
  }

  return result
}

/**
 * Determines if a file should be included based on copy options
 */
function shouldIncludeFile(filename: string, options: CopyOptions): boolean {
  // Handle source maps
  if (filename.endsWith('.map') || filename.endsWith('.js.map')) {
    return options.includeSourceMaps
  }

  // Handle declaration files
  if (filename.endsWith('.d.ts') || filename.endsWith('.d.ts.map')) {
    return options.includeDeclarations
  }

  // Include all other files (JS, JSON, etc.)
  return true
}

/**
 * Copies the dist directory from a source package to the output directory
 *
 * @param srcPkg - The source monorepo package to copy from
 * @param outputDir - The output directory to copy to
 * @param options - Copy options for filtering files
 * @returns Result of the copy operation
 * @throws FileSystemError if the dist directory cannot be accessed
 *
 * @example
 * ```typescript
 * const result = await copyDistDirectory(
 *   myPackage,
 *   '/tmp/bundle',
 *   { includeSourceMaps: true, includeDeclarations: true }
 * );
 * console.log(`Copied ${result.filesCopied} files`);
 * ```
 */
export async function copyDistDirectory(
  srcPkg: MonorepoPackage,
  outputDir: string,
  options: CopyOptions
): Promise<CopyResult> {
  if (!srcPkg.hasDistDirectory) {
    throw new FileSystemError(
      `Dist directory not found for package '${srcPkg.packageJson.name}'`,
      srcPkg.distPath,
      `Expected dist directory at: ${srcPkg.distPath}\n\n` +
        `To resolve:\n` +
        `  1. Run the build command for this package\n` +
        `  2. Ensure the build output is in the 'dist' directory\n` +
        `  3. Or configure a custom dist directory in bundle options`
    )
  }

  // Determine the destination path for this package's dist
  // For the root package, copy to the root of output
  // For dependencies, copy to a subdirectory
  const destPath = outputDir

  return copyDirectoryRecursive(srcPkg.distPath, destPath, options)
}

/**
 * Copies a dependency package's dist to a nested location in the output
 *
 * @param srcPkg - The source dependency package
 * @param outputDir - The output directory base
 * @param packageName - The dependency package name (used for subdirectory)
 * @param options - Copy options
 * @returns Result of the copy operation
 */
export async function copyDependencyDist(
  srcPkg: MonorepoPackage,
  outputDir: string,
  packageName: string,
  options: CopyOptions
): Promise<CopyResult> {
  if (!srcPkg.hasDistDirectory) {
    throw new FileSystemError(
      `Dist directory not found for dependency '${packageName}'`,
      srcPkg.distPath,
      `Expected dist directory at: ${srcPkg.distPath}\n\n` +
        `To resolve:\n` +
        `  1. Run the build command for this package\n` +
        `  2. Ensure the build output is in the 'dist' directory`
    )
  }

  // Create a safe directory name from the package name
  // e.g., @myorg/utils -> _myorg_utils
  const safeDirName = packageName.replace(/^@/, '_').replace(/\//g, '_')
  const destPath = path.join(outputDir, '_deps', safeDirName)

  return copyDirectoryRecursive(srcPkg.distPath, destPath, options)
}

/**
 * Assembles the complete bundle by copying all required dist directories
 *
 * @param graph - The dependency graph to assemble
 * @param options - Bundle options
 * @returns Result of the assembly operation
 * @throws MonocrateError if assembly fails
 *
 * @example
 * ```typescript
 * const graph = await buildDependencyGraph(packagePath, monorepoRoot);
 * const result = await assembleBundle(graph, {
 *   packagePath,
 *   monorepoRoot,
 *   outputDir: '/tmp/bundle',
 *   includeSourceMaps: true,
 *   includeDeclarations: true,
 * });
 * console.log('Assembled packages:', result.assembledPackages);
 * ```
 */
export async function assembleBundle(
  graph: DependencyGraph,
  options: BundleOptions
): Promise<AssemblyResult> {
  const copyOptions: CopyOptions = {
    includeSourceMaps: options.includeSourceMaps,
    includeDeclarations: options.includeDeclarations,
  }

  // Create or clean the output directory
  await createOutputDir(options.outputDir, options.cleanOutputDir)

  const assembledPackages: string[] = []
  let totalFilesCopied = 0
  let totalSize = 0

  // Process packages in topological order (dependencies first)
  for (const packageName of graph.topologicalOrder) {
    const node = graph.nodes.get(packageName)
    if (!node) {
      throw new MonocrateError(
        `Package '${packageName}' not found in dependency graph`,
        `This is an internal error. The topological order contains a package ` +
          `that is not in the nodes map.`
      )
    }

    const isRootPackage = packageName === graph.root.package.packageJson.name

    try {
      let result: CopyResult

      if (isRootPackage) {
        // Copy root package's dist to the root of output
        result = await copyDistDirectory(
          node.package,
          options.outputDir,
          copyOptions
        )
      } else {
        // Copy dependency's dist to a subdirectory
        result = await copyDependencyDist(
          node.package,
          options.outputDir,
          packageName,
          copyOptions
        )
      }

      assembledPackages.push(packageName)
      totalFilesCopied += result.filesCopied
      totalSize += result.totalSize
    } catch (error) {
      if (error instanceof FileSystemError) {
        // Re-throw with additional context
        throw new MonocrateError(
          `Failed to assemble package '${packageName}'`,
          error.details,
          error
        )
      }
      throw error
    }
  }

  return {
    outputPath: options.outputDir,
    assembledPackages,
    totalFilesCopied,
    totalSize,
  }
}

/**
 * Validates that all packages in the graph have dist directories
 *
 * @param graph - The dependency graph to validate
 * @returns List of packages missing dist directories
 */
export function validateDistDirectories(graph: DependencyGraph): string[] {
  const missing: string[] = []

  for (const [packageName, node] of graph.nodes) {
    if (!node.package.hasDistDirectory) {
      missing.push(packageName)
    }
  }

  return missing
}
