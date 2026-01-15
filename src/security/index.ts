/**
 * Security utilities for monocrate.
 *
 * This module provides security primitives for:
 * - Path validation (preventing path traversal attacks)
 * - Input validation (validating npm package names and package.json)
 *
 * @module security
 */

// Path validation utilities
export {
  validatePath,
  safeReadFile,
  safeWriteFile,
  SafeFs,
  PathSecurityError,
} from './path-validator.js'

// Input validation utilities
export {
  validatePackageName,
  validatePackageJson,
  safeValidatePackageJson,
  PackageJsonSchema,
} from './input-validator.js'

// Types
export type { PackageNameValidationResult, PackageJson } from './input-validator.js'
