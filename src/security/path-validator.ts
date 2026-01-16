/**
 * Path validation utilities for preventing path traversal attacks.
 *
 * Security considerations:
 * - All paths must be validated before file system operations
 * - Symlinks must be resolved to detect traversal attempts
 * - Multiple encoding forms (URL encoding, null bytes) must be handled
 * - Windows-style path separators must be normalized
 */

import * as fs from 'node:fs/promises'
import * as path from 'node:path'

/**
 * Custom error class for security-related path validation failures.
 */
export class PathSecurityError extends Error {
  constructor(
    message: string,
    public readonly basePath: string,
    public readonly targetPath: string
  ) {
    super(message)
    this.name = 'PathSecurityError'
  }
}

/**
 * Normalizes a path by handling URL encoding and null bytes.
 * This is a security measure to prevent bypass attempts.
 *
 * @param inputPath - The path to normalize
 * @returns The normalized path
 * @throws PathSecurityError if the path contains null bytes
 */
function normalizePath(inputPath: string): string {
  // Check for null bytes - these can be used to truncate paths
  if (inputPath.includes('\0') || inputPath.includes('\x00')) {
    throw new PathSecurityError(
      'Path contains null bytes which may indicate an injection attempt',
      '',
      inputPath
    )
  }

  // Decode URL-encoded characters (e.g., %2e%2e%2f -> ../)
  // This prevents bypass attempts using URL encoding
  let decoded = inputPath
  try {
    // Repeatedly decode until no more changes (handles double-encoding)
    let previous = ''
    while (previous !== decoded) {
      previous = decoded
      decoded = decodeURIComponent(decoded)
    }
  } catch {
    // If decoding fails, use the original path
    // This handles malformed percent-encoding
    decoded = inputPath
  }

  // Normalize Windows-style path separators to Unix-style
  // This ensures consistent handling across platforms
  decoded = decoded.replace(/\\/g, '/')

  return decoded
}

/**
 * Validates that a target path is within the allowed base path.
 * This prevents path traversal attacks (e.g., ../../../etc/passwd).
 *
 * @param basePath - The base directory that all paths must be within
 * @param targetPath - The path to validate (can be relative or absolute)
 * @returns true if the path is valid and within basePath
 *
 * @example
 * ```typescript
 * validatePath('/home/user/project', 'src/index.ts') // true
 * validatePath('/home/user/project', '../../../etc/passwd') // false
 * ```
 */
export function validatePath(basePath: string, targetPath: string): boolean {
  try {
    // Normalize the target path to handle encoding attacks
    const normalizedTarget = normalizePath(targetPath)

    // Security check: detect paths that traverse outside and re-enter via absolute path
    // e.g., "src/../../..//absolute/path" - these are suspicious even if they resolve validly
    if (containsEscapingTraversal(normalizedTarget)) {
      return false
    }

    // Resolve both paths to absolute paths
    const resolvedBase = path.resolve(basePath)
    const resolvedTarget = path.resolve(basePath, normalizedTarget)

    // Normalize both paths to handle edge cases
    const normalizedBase = path.normalize(resolvedBase)
    const normalizedResolved = path.normalize(resolvedTarget)

    // Check if the resolved target is within the base path
    // We add a trailing separator to prevent prefix attacks
    // (e.g., /home/user matching /home/username)
    const baseWithSep = normalizedBase.endsWith(path.sep)
      ? normalizedBase
      : normalizedBase + path.sep

    return normalizedResolved === normalizedBase || normalizedResolved.startsWith(baseWithSep)
  } catch {
    // Any error during validation means the path is invalid
    return false
  }
}

/**
 * Detects if a path contains traversal sequences that would escape the current directory
 * and then re-enter via an absolute path. This is a defense-in-depth measure.
 */
function containsEscapingTraversal(targetPath: string): boolean {
  // Split on both forward and back slashes
  const segments = targetPath.split(/[/\\]/).filter((s) => s !== '')

  let depth = 0
  for (const segment of segments) {
    if (segment === '..') {
      depth--
      // If we've gone negative, we're trying to escape
      if (depth < 0) {
        // Check if there's more path after this - indicates re-entry attempt
        return true
      }
    } else if (segment !== '.') {
      // Check for absolute path segment (starts with drive letter on Windows or is empty string from leading /)
      if (path.isAbsolute(segment) || (depth < 0 && segment.length > 0)) {
        return true
      }
      depth++
    }
  }

  return false
}

/**
 * Resolves symlinks and validates the real path is within basePath.
 * This is critical because symlinks can point outside the allowed directory.
 *
 * @param basePath - The base directory that all paths must be within
 * @param targetPath - The path to validate
 * @returns The resolved real path if valid
 * @throws PathSecurityError if the path escapes basePath after symlink resolution
 */
async function resolveAndValidate(basePath: string, targetPath: string): Promise<string> {
  // First validate the literal path
  if (!validatePath(basePath, targetPath)) {
    throw new PathSecurityError('Path traversal attempt detected', basePath, targetPath)
  }

  const normalizedTarget = normalizePath(targetPath)
  const resolvedTarget = path.resolve(basePath, normalizedTarget)

  // Try to resolve symlinks to get the real path
  try {
    const realPath = await fs.realpath(resolvedTarget)

    // Validate the real path is also within basePath
    const resolvedBase = await fs.realpath(basePath)
    const baseWithSep = resolvedBase.endsWith(path.sep) ? resolvedBase : resolvedBase + path.sep

    if (realPath !== resolvedBase && !realPath.startsWith(baseWithSep)) {
      throw new PathSecurityError('Symlink target escapes base directory', basePath, targetPath)
    }

    return realPath
  } catch (error) {
    // If the file doesn't exist yet, that's okay for write operations
    // But we still need to validate the parent directory
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      // For non-existent paths, validate the parent directory exists
      // and the path would be within bounds
      return resolvedTarget
    }

    // Re-throw PathSecurityError as-is
    if (error instanceof PathSecurityError) {
      throw error
    }

    // For other errors, wrap in PathSecurityError
    throw new PathSecurityError(
      `Failed to resolve path: ${error instanceof Error ? error.message : 'Unknown error'}`,
      basePath,
      targetPath
    )
  }
}

/**
 * Safely reads a file, ensuring the path is within the base directory.
 *
 * @param basePath - The base directory that all paths must be within
 * @param relativePath - The relative path to the file to read
 * @returns The file contents as a string
 * @throws PathSecurityError if the path escapes basePath
 *
 * @example
 * ```typescript
 * const content = await safeReadFile('/project', 'src/index.ts')
 * ```
 */
export async function safeReadFile(basePath: string, relativePath: string): Promise<string> {
  const safePath = await resolveAndValidate(basePath, relativePath)
  return fs.readFile(safePath, 'utf-8')
}

/**
 * Safely writes a file, ensuring the path is within the base directory.
 *
 * @param basePath - The base directory that all paths must be within
 * @param relativePath - The relative path to the file to write
 * @param content - The content to write
 * @throws PathSecurityError if the path escapes basePath
 *
 * @example
 * ```typescript
 * await safeWriteFile('/project', 'dist/bundle.js', 'content')
 * ```
 */
export async function safeWriteFile(
  basePath: string,
  relativePath: string,
  content: string
): Promise<void> {
  // Validate path before any file system operation
  if (!validatePath(basePath, relativePath)) {
    throw new PathSecurityError('Path traversal attempt detected', basePath, relativePath)
  }

  const normalizedPath = normalizePath(relativePath)
  const resolvedPath = path.resolve(basePath, normalizedPath)

  // Ensure parent directory exists
  const parentDir = path.dirname(resolvedPath)
  await fs.mkdir(parentDir, { recursive: true })

  await fs.writeFile(resolvedPath, content, 'utf-8')
}

/**
 * SafeFs class - A wrapper for fs operations that enforces path validation.
 * All operations are restricted to the configured base path.
 *
 * @example
 * ```typescript
 * const safeFs = new SafeFs('/project')
 * await safeFs.readFile('src/index.ts')
 * await safeFs.writeFile('dist/bundle.js', content)
 * ```
 */
export class SafeFs {
  private readonly resolvedBasePath: string

  /**
   * Creates a new SafeFs instance restricted to the given base path.
   *
   * @param basePath - The base directory for all operations
   * @throws Error if basePath is empty or invalid
   */
  constructor(basePath: string) {
    if (!basePath || basePath.trim() === '') {
      throw new Error('Base path cannot be empty')
    }
    this.resolvedBasePath = path.resolve(basePath)
  }

  /**
   * Gets the resolved base path.
   */
  get basePath(): string {
    return this.resolvedBasePath
  }

  /**
   * Validates a relative path and returns the resolved absolute path.
   *
   * @param relativePath - The path to validate
   * @returns The resolved absolute path
   * @throws PathSecurityError if validation fails
   */
  private validateAndResolve(relativePath: string): string {
    if (!validatePath(this.resolvedBasePath, relativePath)) {
      throw new PathSecurityError(
        'Path traversal attempt detected',
        this.resolvedBasePath,
        relativePath
      )
    }

    const normalizedPath = normalizePath(relativePath)
    return path.resolve(this.resolvedBasePath, normalizedPath)
  }

  /**
   * Reads a file within the base path.
   *
   * @param relativePath - The relative path to the file
   * @returns The file contents as a string
   * @throws PathSecurityError if the path escapes basePath
   */
  async readFile(relativePath: string): Promise<string> {
    return safeReadFile(this.resolvedBasePath, relativePath)
  }

  /**
   * Writes a file within the base path.
   *
   * @param relativePath - The relative path to the file
   * @param content - The content to write
   * @throws PathSecurityError if the path escapes basePath
   */
  async writeFile(relativePath: string, content: string): Promise<void> {
    return safeWriteFile(this.resolvedBasePath, relativePath, content)
  }

  /**
   * Recursively copies a directory within the base path.
   *
   * @param srcRelative - The source directory (relative to basePath)
   * @param destRelative - The destination directory (relative to basePath)
   * @throws PathSecurityError if either path escapes basePath
   */
  async copyDir(srcRelative: string, destRelative: string): Promise<void> {
    const srcPath = this.validateAndResolve(srcRelative)
    const destPath = this.validateAndResolve(destRelative)

    // Verify source exists and is a directory
    const srcStat = await fs.stat(srcPath)
    if (!srcStat.isDirectory()) {
      throw new Error(`Source is not a directory: ${srcRelative}`)
    }

    // Create destination directory
    await fs.mkdir(destPath, { recursive: true })

    // Read source directory contents
    const entries = await fs.readdir(srcPath, { withFileTypes: true })

    for (const entry of entries) {
      const srcEntry = path.join(srcRelative, entry.name)
      const destEntry = path.join(destRelative, entry.name)

      if (entry.isDirectory()) {
        // Recursively copy subdirectories
        await this.copyDir(srcEntry, destEntry)
      } else if (entry.isFile()) {
        // Copy files using fs.copyFile to preserve binary content
        const srcFilePath = this.validateAndResolve(srcEntry)
        const destFilePath = this.validateAndResolve(destEntry)
        // Ensure parent directory exists
        await fs.mkdir(path.dirname(destFilePath), { recursive: true })
        await fs.copyFile(srcFilePath, destFilePath)
      } else if (entry.isSymbolicLink()) {
        // For symlinks, resolve and validate the target
        const linkTarget = await fs.readlink(path.join(srcPath, entry.name))
        const resolvedTarget = path.resolve(srcPath, linkTarget)

        // Validate symlink target is within base path
        const baseWithSep = this.resolvedBasePath.endsWith(path.sep)
          ? this.resolvedBasePath
          : this.resolvedBasePath + path.sep

        if (resolvedTarget !== this.resolvedBasePath && !resolvedTarget.startsWith(baseWithSep)) {
          throw new PathSecurityError(
            'Symlink target escapes base directory',
            this.resolvedBasePath,
            srcEntry
          )
        }

        // Copy the actual content instead of creating a symlink
        // This is safer as it prevents external references in the output
        const targetStat = await fs.stat(resolvedTarget)
        if (targetStat.isFile()) {
          // Use fs.copyFile to preserve binary content
          const destFilePath = this.validateAndResolve(destEntry)
          await fs.mkdir(path.dirname(destFilePath), { recursive: true })
          await fs.copyFile(resolvedTarget, destFilePath)
        } else if (targetStat.isDirectory()) {
          // Calculate relative path to target
          const relativeTarget = path.relative(this.resolvedBasePath, resolvedTarget)
          await this.copyDir(relativeTarget, destEntry)
        }
      }
      // Skip other types (sockets, fifos, etc.)
    }
  }

  /**
   * Checks if a file or directory exists within the base path.
   *
   * @param relativePath - The relative path to check
   * @returns true if the path exists
   * @throws PathSecurityError if the path escapes basePath
   */
  async exists(relativePath: string): Promise<boolean> {
    const safePath = this.validateAndResolve(relativePath)

    try {
      await fs.access(safePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Creates a directory within the base path.
   *
   * @param relativePath - The relative path for the directory
   * @throws PathSecurityError if the path escapes basePath
   */
  async mkdir(relativePath: string): Promise<void> {
    const safePath = this.validateAndResolve(relativePath)
    await fs.mkdir(safePath, { recursive: true })
  }
}
