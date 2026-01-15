/**
 * Input validation utilities for npm package names and package.json structures.
 *
 * Security considerations:
 * - Package names must follow npm naming rules to prevent confusion attacks
 * - package.json structure must be validated to prevent malformed data processing
 * - All user input should be validated before use
 */

import { z } from 'zod'

/**
 * Validation result for package name validation.
 */
export interface PackageNameValidationResult {
  valid: boolean
  error?: string
}

/**
 * Maximum length for an npm package name.
 * npm enforces a 214 character limit.
 */
const MAX_PACKAGE_NAME_LENGTH = 214

/**
 * Regular expression for validating npm package names.
 *
 * npm package naming rules:
 * - Can only contain lowercase letters, numbers, hyphens, underscores, and periods
 * - Cannot start with a dot or underscore
 * - Cannot contain leading/trailing spaces
 * - Scoped packages start with @ and contain a single /
 *
 * @see https://docs.npmjs.com/cli/v10/configuring-npm/package-json#name
 */
const SCOPED_PACKAGE_REGEX =
  /^@[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?\/[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/
const UNSCOPED_PACKAGE_REGEX = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/

/**
 * List of reserved npm package names that cannot be used.
 * These are Node.js built-in module names.
 */
const RESERVED_NAMES = new Set(['node_modules', 'favicon.ico'])

/**
 * List of Node.js built-in module names.
 * These should trigger warnings but are technically allowed by npm.
 */
const BUILTIN_MODULES = new Set([
  'assert',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'https',
  'module',
  'net',
  'os',
  'path',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'sys',
  'timers',
  'tls',
  'tty',
  'url',
  'util',
  'vm',
  'zlib',
])

/**
 * Validates an npm package name according to npm naming rules.
 *
 * @param name - The package name to validate
 * @returns Validation result with valid flag and optional error message
 *
 * @example
 * ```typescript
 * validatePackageName('my-package') // { valid: true }
 * validatePackageName('My Package') // { valid: false, error: '...' }
 * validatePackageName('@scope/pkg') // { valid: true }
 * ```
 */
export function validatePackageName(name: string): PackageNameValidationResult {
  // Check for empty or whitespace-only names
  if (!name || name.trim() === '') {
    return {
      valid: false,
      error: 'Package name cannot be empty',
    }
  }

  // Check for leading/trailing whitespace
  if (name !== name.trim()) {
    return {
      valid: false,
      error: 'Package name cannot have leading or trailing whitespace',
    }
  }

  // Check length limit
  if (name.length > MAX_PACKAGE_NAME_LENGTH) {
    return {
      valid: false,
      error: `Package name cannot exceed ${String(MAX_PACKAGE_NAME_LENGTH)} characters`,
    }
  }

  // Check for uppercase letters (npm names must be lowercase)
  if (name !== name.toLowerCase()) {
    return {
      valid: false,
      error: 'Package name must be lowercase',
    }
  }

  // Check for reserved names
  if (RESERVED_NAMES.has(name)) {
    return {
      valid: false,
      error: `"${name}" is a reserved name and cannot be used`,
    }
  }

  // Check for null bytes or other control characters
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(name)) {
    return {
      valid: false,
      error: 'Package name cannot contain control characters',
    }
  }

  // Check for URL-unsafe characters
  if (/[~'!()*]/.test(name)) {
    return {
      valid: false,
      error: "Package name cannot contain special characters: ~ ' ! ( ) *",
    }
  }

  // Validate against regex patterns
  const isScoped = name.startsWith('@')

  if (isScoped) {
    // Validate scoped package name
    if (!name.includes('/')) {
      return {
        valid: false,
        error: 'Scoped package name must contain a "/" separator',
      }
    }

    // Check for multiple slashes
    if ((name.match(/\//g) ?? []).length > 1) {
      return {
        valid: false,
        error: 'Scoped package name can only contain one "/" separator',
      }
    }

    // Check for empty scope or name
    const [scope, packageName] = name.split('/')
    if (scope === '@' || !scope) {
      return {
        valid: false,
        error: 'Scope name cannot be empty',
      }
    }

    if (!packageName) {
      return {
        valid: false,
        error: 'Package name after scope cannot be empty',
      }
    }

    if (!SCOPED_PACKAGE_REGEX.test(name)) {
      return {
        valid: false,
        error:
          'Package name can only contain lowercase letters, numbers, hyphens, underscores, and periods',
      }
    }
  } else {
    // Validate unscoped package name

    // Check for names starting with . or _
    if (name.startsWith('.')) {
      return {
        valid: false,
        error: 'Package name cannot start with a period',
      }
    }

    if (name.startsWith('_')) {
      return {
        valid: false,
        error: 'Package name cannot start with an underscore',
      }
    }

    // Single character names need special handling
    if (name.length === 1) {
      if (!/^[a-z0-9]$/.test(name)) {
        return {
          valid: false,
          error:
            'Package name can only contain lowercase letters, numbers, hyphens, underscores, and periods',
        }
      }
    } else if (!UNSCOPED_PACKAGE_REGEX.test(name)) {
      return {
        valid: false,
        error:
          'Package name can only contain lowercase letters, numbers, hyphens, underscores, and periods',
      }
    }
  }

  // Warn about built-in module name collision (but still valid)
  if (BUILTIN_MODULES.has(name)) {
    return {
      valid: true,
      error: `Warning: "${name}" is a Node.js built-in module name`,
    }
  }

  return { valid: true }
}

/**
 * Zod schema for person field (author, contributors).
 */
const PersonSchema = z.union([
  z.string(),
  z.object({
    name: z.string(),
    email: z.string().email().optional(),
    url: z.string().url().optional(),
  }),
])

/**
 * Zod schema for repository field.
 */
const RepositorySchema = z.union([
  z.string(),
  z.object({
    type: z.string().optional(),
    url: z.string(),
    directory: z.string().optional(),
  }),
])

/**
 * Zod schema for bugs field.
 */
const BugsSchema = z.union([
  z.string().url(),
  z.object({
    url: z.string().url().optional(),
    email: z.string().email().optional(),
  }),
])

/**
 * Zod schema for dependency maps.
 */
const DependencyMapSchema = z.record(z.string(), z.string())

/**
 * Zod schema for bin field.
 */
const BinSchema = z.union([z.string(), z.record(z.string(), z.string())])

/**
 * Zod schema for funding field.
 */
const FundingSchema = z.union([
  z.string().url(),
  z.object({
    type: z.string().optional(),
    url: z.string().url(),
  }),
  z.array(
    z.union([
      z.string().url(),
      z.object({
        type: z.string().optional(),
        url: z.string().url(),
      }),
    ])
  ),
])

/**
 * Zod schema for exports field (simplified).
 */
const ExportsSchema = z.union([
  z.string(),
  z.null(),
  z.record(
    z.string(),
    z.union([z.string(), z.null(), z.record(z.string(), z.union([z.string(), z.null()]))])
  ),
])

/**
 * Zod schema for package.json validation.
 * This validates the structure of a package.json file according to npm specifications.
 *
 * @see https://docs.npmjs.com/cli/v10/configuring-npm/package-json
 */
export const PackageJsonSchema = z
  .object({
    // Required fields
    name: z.string().refine(
      (name) => validatePackageName(name).valid,
      (name) => ({ message: validatePackageName(name).error ?? 'Invalid package name' })
    ),
    version: z
      .string()
      .regex(/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/, 'Version must be a valid semver string'),

    // Optional metadata fields
    description: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    homepage: z.string().url().optional(),
    bugs: BugsSchema.optional(),
    license: z.string().optional(),
    author: PersonSchema.optional(),
    contributors: z.array(PersonSchema).optional(),
    funding: FundingSchema.optional(),
    files: z.array(z.string()).optional(),
    main: z.string().optional(),
    browser: z
      .union([z.string(), z.record(z.string(), z.union([z.string(), z.literal(false)]))])
      .optional(),
    bin: BinSchema.optional(),
    man: z.union([z.string(), z.array(z.string())]).optional(),
    directories: z
      .object({
        lib: z.string().optional(),
        bin: z.string().optional(),
        man: z.string().optional(),
        doc: z.string().optional(),
        example: z.string().optional(),
        test: z.string().optional(),
      })
      .optional(),
    repository: RepositorySchema.optional(),

    // Module system fields
    type: z.enum(['module', 'commonjs']).optional(),
    types: z.string().optional(),
    typings: z.string().optional(),
    exports: ExportsSchema.optional(),
    imports: z
      .record(z.string(), z.union([z.string(), z.record(z.string(), z.string())]))
      .optional(),
    module: z.string().optional(),

    // Scripts
    scripts: z.record(z.string(), z.string()).optional(),

    // Dependency fields
    dependencies: DependencyMapSchema.optional(),
    devDependencies: DependencyMapSchema.optional(),
    peerDependencies: DependencyMapSchema.optional(),
    peerDependenciesMeta: z
      .record(
        z.string(),
        z.object({
          optional: z.boolean().optional(),
        })
      )
      .optional(),
    bundleDependencies: z.union([z.boolean(), z.array(z.string())]).optional(),
    bundledDependencies: z.union([z.boolean(), z.array(z.string())]).optional(),
    optionalDependencies: DependencyMapSchema.optional(),
    overrides: z
      .record(z.string(), z.union([z.string(), z.record(z.string(), z.unknown())]))
      .optional(),

    // Engine and platform fields
    engines: z.record(z.string(), z.string()).optional(),
    os: z.array(z.string()).optional(),
    cpu: z.array(z.string()).optional(),

    // Publishing fields
    private: z.boolean().optional(),
    publishConfig: z
      .object({
        access: z.enum(['public', 'restricted']).optional(),
        registry: z.string().url().optional(),
        tag: z.string().optional(),
      })
      .passthrough()
      .optional(),

    // Workspaces
    workspaces: z
      .union([
        z.array(z.string()),
        z.object({
          packages: z.array(z.string()).optional(),
          nohoist: z.array(z.string()).optional(),
        }),
      ])
      .optional(),

    // Allow additional fields (npm is permissive)
  })
  .passthrough()

/**
 * TypeScript type inferred from the PackageJsonSchema.
 */
export type PackageJson = z.infer<typeof PackageJsonSchema>

/**
 * Validates a package.json object against the schema.
 *
 * @param data - The data to validate
 * @returns The validated PackageJson object
 * @throws ZodError if validation fails
 *
 * @example
 * ```typescript
 * const pkg = validatePackageJson({
 *   name: 'my-package',
 *   version: '1.0.0'
 * })
 * ```
 */
export function validatePackageJson(data: unknown): PackageJson {
  return PackageJsonSchema.parse(data)
}

/**
 * Safely validates a package.json without throwing.
 *
 * @param data - The data to validate
 * @returns A result object with success flag and either data or error
 *
 * @example
 * ```typescript
 * const result = safeValidatePackageJson(data)
 * if (result.success) {
 *   console.log(result.data.name)
 * } else {
 *   console.error(result.error)
 * }
 * ```
 */
export function safeValidatePackageJson(
  data: unknown
): z.SafeParseReturnType<unknown, PackageJson> {
  return PackageJsonSchema.safeParse(data)
}
