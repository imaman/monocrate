#!/usr/bin/env node
/**
 * Monocrate CLI - From monorepo to npm in one command
 *
 * Main entry point for the command-line interface.
 *
 * Security considerations:
 * - All user input is validated before use
 * - Error messages are sanitized to avoid leaking sensitive information
 * - File paths in output are sanitized when appropriate
 */

import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { Command } from 'commander'
import { bundle, VERSION, type BundleResult, type VersionConflict } from '../index.js'
import {
  print,
  printError,
  printWarning,
  Spinner,
  formatError,
  formatBundleSummary,
  formatTable,
  bold,
  cyan,
  gray,
  dim,
  bullet,
} from './output.js'

// ============================================================================
// Types
// ============================================================================

/**
 * Parsed CLI options from commander.
 */
interface CliOptions {
  output: string
  root: string | undefined
  clean: boolean
  includeDev: boolean
  dryRun: boolean
  verbose: boolean
  quiet: boolean
}

/**
 * Exit codes for the CLI.
 */
const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  INVALID_ARGS: 2,
} as const

// ============================================================================
// Commander Setup
// ============================================================================

const program = new Command()

program
  .name('monocrate')
  .description(
    'Bundle a monorepo package for npm publishing.\n\n' +
      'Monocrate collects your package and all its in-repo dependencies,\n' +
      'copies their compiled output, and generates a publish-ready package.json\n' +
      'with merged third-party dependencies.'
  )
  .version(VERSION, '-V, --version', 'Show version number')
  .argument('[package-path]', 'Path to the package to bundle', process.cwd())
  .option('-o, --output <dir>', 'Output directory', path.join(process.cwd(), 'monocrate-out'))
  .option('-r, --root <dir>', 'Monorepo root directory (default: auto-detect)')
  .option('-c, --clean', 'Clean output directory before bundling', false)
  .option('--include-dev', 'Include devDependencies in bundle', false)
  .option('--dry-run', 'Show what would be done without doing it', false)
  .option('-v, --verbose', 'Show detailed output', false)
  .option('-q, --quiet', 'Suppress non-error output', false)
  .addHelpText(
    'after',
    `
Examples:
  $ monocrate                           Bundle current package
  $ monocrate ./packages/my-lib -o dist Bundle specific package to dist/
  $ monocrate --dry-run                 Preview bundle operation
  $ monocrate -c -v                     Clean and verbose mode`
  )
  .action(runBundle)

// ============================================================================
// Monorepo Root Detection
// ============================================================================

/**
 * Find the monorepo root by searching for workspace configuration.
 * Looks for pnpm-workspace.yaml, package.json with workspaces, or lock files.
 */
async function findMonorepoRoot(startDir: string): Promise<string | null> {
  let currentDir = startDir

  // Safety limit to prevent infinite loops
  const maxDepth = 20
  let depth = 0

  while (depth < maxDepth) {
    // Check for pnpm workspace
    try {
      await fs.access(path.join(currentDir, 'pnpm-workspace.yaml'))
      return currentDir
    } catch {
      // Not found, continue
    }

    // Check for package.json with workspaces field
    try {
      const pkgPath = path.join(currentDir, 'package.json')
      const content = await fs.readFile(pkgPath, 'utf-8')
      const pkg = JSON.parse(content) as { workspaces?: unknown }
      if (pkg.workspaces) {
        return currentDir
      }
    } catch {
      // Not found or invalid, continue
    }

    // Check for lock files (indicating project root)
    for (const lockFile of ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock']) {
      try {
        await fs.access(path.join(currentDir, lockFile))
        // Found a lock file - this might be the root
        // But continue checking for workspace config above
        return currentDir
      } catch {
        // Not found, continue
      }
    }

    // Move up one directory
    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      // Reached filesystem root
      break
    }
    currentDir = parentDir
    depth++
  }

  return null
}

// ============================================================================
// Input Validation
// ============================================================================

/**
 * Validate CLI arguments.
 * Returns error message if invalid, null if valid.
 */
async function validateInputs(packagePath: string, options: CliOptions): Promise<string | null> {
  // Validate package path exists
  try {
    const stats = await fs.stat(packagePath)
    if (!stats.isDirectory()) {
      return `Package path is not a directory: ${packagePath}`
    }
  } catch {
    return `Package path does not exist: ${packagePath}`
  }

  // Check for package.json in package path
  try {
    await fs.access(path.join(packagePath, 'package.json'))
  } catch {
    return `No package.json found in: ${packagePath}`
  }

  // If monorepo root is specified, validate it
  if (options.root) {
    try {
      const stats = await fs.stat(options.root)
      if (!stats.isDirectory()) {
        return `Monorepo root is not a directory: ${options.root}`
      }
    } catch {
      return `Monorepo root does not exist: ${options.root}`
    }
  }

  // Validate output path is not inside package path (could cause issues)
  const resolvedOutput = path.resolve(options.output)
  const resolvedPackage = path.resolve(packagePath)
  if (resolvedOutput.startsWith(resolvedPackage + path.sep)) {
    return `Output directory cannot be inside package directory`
  }

  return null
}

// ============================================================================
// Dry Run
// ============================================================================

/**
 * Perform a dry run, showing what would be done.
 */
async function performDryRun(packagePath: string, options: CliOptions, monorepoRoot: string): Promise<void> {
  print('')
  print(bold('Dry run - no changes will be made'))
  print('')

  // Read package.json to show info
  const pkgPath = path.join(packagePath, 'package.json')
  const pkgContent = await fs.readFile(pkgPath, 'utf-8')
  const pkg = JSON.parse(pkgContent) as {
    name?: string
    version?: string
    dependencies?: Record<string, string>
  }

  print(dim('Package:'))
  print(`  Name:    ${cyan(pkg.name ?? 'unknown')}`)
  print(`  Version: ${pkg.version ?? 'unknown'}`)
  print(`  Path:    ${packagePath}`)
  print('')

  print(dim('Monorepo:'))
  print(`  Root:    ${monorepoRoot}`)
  print('')

  print(dim('Output:'))
  print(`  Path:    ${options.output}`)
  print(`  Clean:   ${options.clean ? 'yes' : 'no'}`)
  print('')

  print(dim('Operations that would be performed:'))
  print(bullet('Resolve in-repo dependencies'))
  print(bullet('Validate all packages are built (dist directories exist)'))
  print(bullet('Copy compiled output from all packages'))
  print(bullet('Merge third-party dependencies'))
  print(bullet('Generate publish-ready package.json'))
  print('')
}

// ============================================================================
// Bundle Execution
// ============================================================================

/**
 * Execute the bundle operation.
 */
async function executeBundle(packagePath: string, options: CliOptions, monorepoRoot: string): Promise<BundleResult> {
  const spinner = new Spinner('Resolving dependencies...')

  if (!options.quiet) {
    spinner.start()
  }

  try {
    // Execute the bundle
    const result = await bundle({
      packagePath,
      monorepoRoot,
      outputDir: options.output,
      cleanOutputDir: options.clean,
      includeSourceMaps: true,
      includeDeclarations: true,
      versionConflictStrategy: 'warn',
    })

    if (!options.quiet) {
      spinner.stop()
    }

    return result
  } catch (error) {
    if (!options.quiet) {
      spinner.fail('Bundle failed')
    }
    throw error
  }
}

/**
 * Format version conflicts for display.
 */
function formatConflicts(conflicts: readonly VersionConflict[]): string {
  if (conflicts.length === 0) {
    return ''
  }

  const rows: string[][] = []
  for (const conflict of conflicts) {
    const packages = [...conflict.versions.entries()].map(([pkg, ver]) => `${pkg}: ${ver}`).join(', ')
    rows.push([conflict.dependencyName, conflict.resolvedVersion, packages])
  }

  return formatTable(rows, {
    headers: ['Dependency', 'Resolved', 'Requested by'],
  })
}

/**
 * Display bundle results.
 */
function displayResults(result: BundleResult, options: CliOptions): void {
  if (!result.success) {
    print(formatError(result.error, result.details))
    return
  }

  if (options.quiet) {
    // In quiet mode, just print the output path
    print(result.outputPath)
    return
  }

  print('')

  // Show warnings for version conflicts
  if (result.versionConflicts.length > 0) {
    printWarning(
      `${String(result.versionConflicts.length)} version conflict${result.versionConflicts.length !== 1 ? 's' : ''} were auto-resolved`
    )
    print('')
    if (options.verbose) {
      print(formatConflicts(result.versionConflicts))
      print('')
    }
  }

  // Show included packages in verbose mode
  if (options.verbose && result.includedPackages.length > 1) {
    print(dim('Bundled packages:'))
    for (const pkg of result.includedPackages) {
      print(bullet(pkg))
    }
    print('')
  }

  // Show summary
  const depsCount = Object.keys(result.mergedDependencies).length
  print(
    formatBundleSummary(
      result.outputPath,
      result.packageJson.name,
      result.packageJson.version,
      result.includedPackages,
      depsCount
    )
  )
  print('')

  // Show next steps
  print(dim('Next steps:'))
  print(bullet(`cd ${path.relative(process.cwd(), result.outputPath) || '.'}`))
  print(bullet('npm publish'))
  print('')
}

// ============================================================================
// Main Action Handler
// ============================================================================

/**
 * Main bundle action handler.
 */
async function runBundle(packagePathArg: string, options: CliOptions): Promise<void> {
  const packagePath = path.resolve(packagePathArg)
  const resolvedOptions: CliOptions = {
    ...options,
    output: path.resolve(options.output),
    root: options.root ? path.resolve(options.root) : undefined,
  }

  // Validate inputs
  const validationError = await validateInputs(packagePath, resolvedOptions)
  if (validationError) {
    printError(validationError)
    process.exitCode = EXIT_CODES.INVALID_ARGS
    return
  }

  // Find monorepo root
  let monorepoRoot: string | undefined = resolvedOptions.root
  if (!monorepoRoot) {
    monorepoRoot = (await findMonorepoRoot(packagePath)) ?? undefined
    if (!monorepoRoot) {
      printError('Could not detect monorepo root')
      print('')
      print('  Try specifying the root explicitly:')
      print(`    ${cyan('monocrate --root /path/to/monorepo')}`)
      print('')
      process.exitCode = EXIT_CODES.GENERAL_ERROR
      return
    }
  }

  if (resolvedOptions.verbose && !resolvedOptions.quiet) {
    print('')
    print(dim(`Using monorepo root: ${monorepoRoot}`))
  }

  // Handle dry run
  if (resolvedOptions.dryRun) {
    await performDryRun(packagePath, resolvedOptions, monorepoRoot)
    process.exitCode = EXIT_CODES.SUCCESS
    return
  }

  // Execute bundle
  try {
    const result = await executeBundle(packagePath, resolvedOptions, monorepoRoot)
    displayResults(result, resolvedOptions)

    process.exitCode = result.success ? EXIT_CODES.SUCCESS : EXIT_CODES.GENERAL_ERROR
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    printError(message)

    if (resolvedOptions.verbose && error instanceof Error && error.stack) {
      print('')
      print(dim('Stack trace:'))
      print(gray(error.stack))
    }

    process.exitCode = EXIT_CODES.GENERAL_ERROR
  }
}

// ============================================================================
// Run CLI
// ============================================================================

program.parse()

// Export for testing
export { findMonorepoRoot, program }
