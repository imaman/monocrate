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
import { bundle, VERSION, type BundleResult, type VersionConflict } from '../index.js'
import {
  print,
  printError,
  printWarning,
  Spinner,
  formatError,
  formatHelp,
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
 * Parsed CLI arguments.
 */
interface CliArgs {
  packagePath: string
  outputDir: string
  monorepoRoot: string | null
  clean: boolean
  includeDev: boolean
  dryRun: boolean
  verbose: boolean
  quiet: boolean
  help: boolean
  version: boolean
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
// Argument Parsing
// ============================================================================

/**
 * Parse command-line arguments.
 * Uses a lightweight manual parser for fast startup.
 */
function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    packagePath: process.cwd(),
    outputDir: path.join(process.cwd(), 'monocrate-out'),
    monorepoRoot: null,
    clean: false,
    includeDev: false,
    dryRun: false,
    verbose: false,
    quiet: false,
    help: false,
    version: false,
  }

  // Skip node and script path
  const cliArgs = argv.slice(2)
  let positionalIndex = 0

  for (let i = 0; i < cliArgs.length; i++) {
    const arg = cliArgs[i]
    if (!arg) continue

    // Handle options
    if (arg.startsWith('-')) {
      switch (arg) {
        case '-h':
        case '--help':
          args.help = true
          break

        case '-V':
        case '--version':
          args.version = true
          break

        case '-o':
        case '--output': {
          const nextArg = cliArgs[++i]
          if (!nextArg || nextArg.startsWith('-')) {
            throw new Error('--output requires a directory path')
          }
          args.outputDir = path.resolve(nextArg)
          break
        }

        case '-r':
        case '--root': {
          const nextArg = cliArgs[++i]
          if (!nextArg || nextArg.startsWith('-')) {
            throw new Error('--root requires a directory path')
          }
          args.monorepoRoot = path.resolve(nextArg)
          break
        }

        case '-c':
        case '--clean':
          args.clean = true
          break

        case '--include-dev':
          args.includeDev = true
          break

        case '--dry-run':
          args.dryRun = true
          break

        case '-v':
        case '--verbose':
          args.verbose = true
          break

        case '-q':
        case '--quiet':
          args.quiet = true
          break

        default:
          // Check for combined short options or = syntax
          if (arg.startsWith('--') && arg.includes('=')) {
            const [key, value] = arg.split('=')
            if (key === '--output' || key === '-o') {
              args.outputDir = path.resolve(value ?? '')
            } else if (key === '--root' || key === '-r') {
              args.monorepoRoot = path.resolve(value ?? '')
            } else {
              throw new Error(`Unknown option: ${key ?? arg}`)
            }
          } else {
            throw new Error(`Unknown option: ${arg}`)
          }
      }
    } else {
      // Positional argument
      if (positionalIndex === 0) {
        args.packagePath = path.resolve(arg)
        positionalIndex++
      } else {
        throw new Error(`Unexpected argument: ${arg}`)
      }
    }
  }

  return args
}

// ============================================================================
// Help Text
// ============================================================================

/**
 * Display help text.
 */
function showHelp(): void {
  const helpText = formatHelp(
    'monocrate [package-path] [options]',
    'Bundle a monorepo package for npm publishing.\n\n' +
      'Monocrate collects your package and all its in-repo dependencies,\n' +
      'copies their compiled output, and generates a publish-ready package.json\n' +
      'with merged third-party dependencies.',
    [
      {
        title: 'Arguments',
        items: [
          {
            name: 'package-path',
            description: 'Path to the package to bundle (default: current directory)',
          },
        ],
      },
      {
        title: 'Options',
        items: [
          {
            name: '--output <dir>',
            alias: '-o',
            description: 'Output directory (default: ./monocrate-out)',
          },
          {
            name: '--root <dir>',
            alias: '-r',
            description: 'Monorepo root directory (default: auto-detect)',
          },
          {
            name: '--clean',
            alias: '-c',
            description: 'Clean output directory before bundling',
          },
          {
            name: '--include-dev',
            description: 'Include devDependencies in bundle',
          },
          {
            name: '--dry-run',
            description: 'Show what would be done without doing it',
          },
          {
            name: '--verbose',
            alias: '-v',
            description: 'Show detailed output',
          },
          {
            name: '--quiet',
            alias: '-q',
            description: 'Suppress non-error output',
          },
          {
            name: '--help',
            alias: '-h',
            description: 'Show this help message',
          },
          {
            name: '--version',
            alias: '-V',
            description: 'Show version number',
          },
        ],
      },
    ],
    [
      'monocrate',
      'monocrate ./packages/my-lib -o dist',
      'monocrate --dry-run',
      'monocrate -c -v',
    ]
  )

  print(helpText)
}

/**
 * Display version.
 */
function showVersion(): void {
  print(`monocrate v${VERSION}`)
}

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
async function validateArgs(args: CliArgs): Promise<string | null> {
  // Validate package path exists
  try {
    const stats = await fs.stat(args.packagePath)
    if (!stats.isDirectory()) {
      return `Package path is not a directory: ${args.packagePath}`
    }
  } catch {
    return `Package path does not exist: ${args.packagePath}`
  }

  // Check for package.json in package path
  try {
    await fs.access(path.join(args.packagePath, 'package.json'))
  } catch {
    return `No package.json found in: ${args.packagePath}`
  }

  // If monorepo root is specified, validate it
  if (args.monorepoRoot) {
    try {
      const stats = await fs.stat(args.monorepoRoot)
      if (!stats.isDirectory()) {
        return `Monorepo root is not a directory: ${args.monorepoRoot}`
      }
    } catch {
      return `Monorepo root does not exist: ${args.monorepoRoot}`
    }
  }

  // Validate output path is not inside package path (could cause issues)
  const resolvedOutput = path.resolve(args.outputDir)
  const resolvedPackage = path.resolve(args.packagePath)
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
async function performDryRun(
  args: CliArgs,
  monorepoRoot: string
): Promise<void> {
  print('')
  print(bold('Dry run - no changes will be made'))
  print('')

  // Read package.json to show info
  const pkgPath = path.join(args.packagePath, 'package.json')
  const pkgContent = await fs.readFile(pkgPath, 'utf-8')
  const pkg = JSON.parse(pkgContent) as { name?: string; version?: string; dependencies?: Record<string, string> }

  print(dim('Package:'))
  print(`  Name:    ${cyan(pkg.name ?? 'unknown')}`)
  print(`  Version: ${pkg.version ?? 'unknown'}`)
  print(`  Path:    ${args.packagePath}`)
  print('')

  print(dim('Monorepo:'))
  print(`  Root:    ${monorepoRoot}`)
  print('')

  print(dim('Output:'))
  print(`  Path:    ${args.outputDir}`)
  print(`  Clean:   ${args.clean ? 'yes' : 'no'}`)
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
async function executeBundle(
  args: CliArgs,
  monorepoRoot: string
): Promise<BundleResult> {
  const spinner = new Spinner('Resolving dependencies...')

  if (!args.quiet) {
    spinner.start()
  }

  try {
    // Execute the bundle
    const result = await bundle({
      packagePath: args.packagePath,
      monorepoRoot,
      outputDir: args.outputDir,
      cleanOutputDir: args.clean,
      includeSourceMaps: true,
      includeDeclarations: true,
      versionConflictStrategy: 'warn',
    })

    if (!args.quiet) {
      spinner.stop()
    }

    return result
  } catch (error) {
    if (!args.quiet) {
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
    const packages = [...conflict.versions.entries()]
      .map(([pkg, ver]) => `${pkg}: ${ver}`)
      .join(', ')
    rows.push([conflict.dependencyName, conflict.resolvedVersion, packages])
  }

  return formatTable(rows, {
    headers: ['Dependency', 'Resolved', 'Requested by'],
  })
}

/**
 * Display bundle results.
 */
function displayResults(
  result: BundleResult,
  args: CliArgs
): void {
  if (!result.success) {
    print(
      formatError(result.error, result.details)
    )
    return
  }

  if (args.quiet) {
    // In quiet mode, just print the output path
    print(result.outputPath)
    return
  }

  print('')

  // Show warnings for version conflicts
  if (result.versionConflicts.length > 0) {
    printWarning(`${String(result.versionConflicts.length)} version conflict${result.versionConflicts.length !== 1 ? 's' : ''} were auto-resolved`)
    print('')
    if (args.verbose) {
      print(formatConflicts(result.versionConflicts))
      print('')
    }
  }

  // Show included packages in verbose mode
  if (args.verbose && result.includedPackages.length > 1) {
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
// Main Entry Point
// ============================================================================

/**
 * Main CLI function.
 */
async function main(): Promise<number> {
  let args: CliArgs

  try {
    args = parseArgs(process.argv)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    printError(message)
    print('')
    print(`Run ${cyan('monocrate --help')} for usage information.`)
    return EXIT_CODES.INVALID_ARGS
  }

  // Handle help flag
  if (args.help) {
    showHelp()
    return EXIT_CODES.SUCCESS
  }

  // Handle version flag
  if (args.version) {
    showVersion()
    return EXIT_CODES.SUCCESS
  }

  // Validate arguments
  const validationError = await validateArgs(args)
  if (validationError) {
    printError(validationError)
    return EXIT_CODES.INVALID_ARGS
  }

  // Find monorepo root
  let monorepoRoot = args.monorepoRoot
  if (!monorepoRoot) {
    monorepoRoot = await findMonorepoRoot(args.packagePath)
    if (!monorepoRoot) {
      printError('Could not detect monorepo root')
      print('')
      print('  Try specifying the root explicitly:')
      print(`    ${cyan('monocrate --root /path/to/monorepo')}`)
      print('')
      return EXIT_CODES.GENERAL_ERROR
    }
  }

  if (args.verbose && !args.quiet) {
    print('')
    print(dim(`Using monorepo root: ${monorepoRoot}`))
  }

  // Handle dry run
  if (args.dryRun) {
    await performDryRun(args, monorepoRoot)
    return EXIT_CODES.SUCCESS
  }

  // Execute bundle
  try {
    const result = await executeBundle(args, monorepoRoot)
    displayResults(result, args)

    return result.success ? EXIT_CODES.SUCCESS : EXIT_CODES.GENERAL_ERROR
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    printError(message)

    if (args.verbose && error instanceof Error && error.stack) {
      print('')
      print(dim('Stack trace:'))
      print(gray(error.stack))
    }

    return EXIT_CODES.GENERAL_ERROR
  }
}

// Run the CLI
main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((error: unknown) => {
    console.error('Fatal error:', error)
    process.exitCode = 1
  })

// Export for testing
export { parseArgs, validateArgs, findMonorepoRoot, type CliArgs }
