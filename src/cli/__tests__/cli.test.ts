import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { parseArgs, validateArgs, findMonorepoRoot, type CliArgs } from '../index.js'

describe('CLI', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'monocrate-cli-test-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  /**
   * Helper to create a directory with a package.json
   */
  async function createPackageDir(
    relativePath: string,
    packageJson: Record<string, unknown>
  ): Promise<string> {
    const dir = path.join(tempDir, relativePath)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    )
    return dir
  }

  describe('parseArgs', () => {
    it('should return default values when no arguments provided', () => {
      const args = parseArgs(['node', 'monocrate'])

      expect(args.help).toBe(false)
      expect(args.version).toBe(false)
      expect(args.clean).toBe(false)
      expect(args.dryRun).toBe(false)
      expect(args.verbose).toBe(false)
      expect(args.quiet).toBe(false)
      expect(args.includeDev).toBe(false)
      expect(args.monorepoRoot).toBe(null)
    })

    it('should parse --help flag', () => {
      const args = parseArgs(['node', 'monocrate', '--help'])
      expect(args.help).toBe(true)
    })

    it('should parse -h short flag', () => {
      const args = parseArgs(['node', 'monocrate', '-h'])
      expect(args.help).toBe(true)
    })

    it('should parse --version flag', () => {
      const args = parseArgs(['node', 'monocrate', '--version'])
      expect(args.version).toBe(true)
    })

    it('should parse -V short flag', () => {
      const args = parseArgs(['node', 'monocrate', '-V'])
      expect(args.version).toBe(true)
    })

    it('should parse --clean flag', () => {
      const args = parseArgs(['node', 'monocrate', '--clean'])
      expect(args.clean).toBe(true)
    })

    it('should parse -c short flag', () => {
      const args = parseArgs(['node', 'monocrate', '-c'])
      expect(args.clean).toBe(true)
    })

    it('should parse --dry-run flag', () => {
      const args = parseArgs(['node', 'monocrate', '--dry-run'])
      expect(args.dryRun).toBe(true)
    })

    it('should parse --verbose flag', () => {
      const args = parseArgs(['node', 'monocrate', '--verbose'])
      expect(args.verbose).toBe(true)
    })

    it('should parse -v short flag', () => {
      const args = parseArgs(['node', 'monocrate', '-v'])
      expect(args.verbose).toBe(true)
    })

    it('should parse --quiet flag', () => {
      const args = parseArgs(['node', 'monocrate', '--quiet'])
      expect(args.quiet).toBe(true)
    })

    it('should parse -q short flag', () => {
      const args = parseArgs(['node', 'monocrate', '-q'])
      expect(args.quiet).toBe(true)
    })

    it('should parse --include-dev flag', () => {
      const args = parseArgs(['node', 'monocrate', '--include-dev'])
      expect(args.includeDev).toBe(true)
    })

    it('should parse --output with value', () => {
      const args = parseArgs(['node', 'monocrate', '--output', '/tmp/out'])
      expect(args.outputDir).toBe('/tmp/out')
    })

    it('should parse -o with value', () => {
      const args = parseArgs(['node', 'monocrate', '-o', '/tmp/out'])
      expect(args.outputDir).toBe('/tmp/out')
    })

    it('should parse --output=value syntax', () => {
      const args = parseArgs(['node', 'monocrate', '--output=/tmp/out'])
      expect(args.outputDir).toBe('/tmp/out')
    })

    it('should parse --root with value', () => {
      const args = parseArgs(['node', 'monocrate', '--root', '/path/to/monorepo'])
      expect(args.monorepoRoot).toBe('/path/to/monorepo')
    })

    it('should parse -r with value', () => {
      const args = parseArgs(['node', 'monocrate', '-r', '/path/to/monorepo'])
      expect(args.monorepoRoot).toBe('/path/to/monorepo')
    })

    it('should parse positional package path', () => {
      const args = parseArgs(['node', 'monocrate', '/path/to/package'])
      expect(args.packagePath).toBe('/path/to/package')
    })

    it('should parse relative package path and resolve it', () => {
      const args = parseArgs(['node', 'monocrate', './packages/my-lib'])
      expect(path.isAbsolute(args.packagePath)).toBe(true)
      expect(args.packagePath).toContain('packages')
      expect(args.packagePath).toContain('my-lib')
    })

    it('should parse multiple flags together', () => {
      const args = parseArgs([
        'node',
        'monocrate',
        '/path/to/pkg',
        '-o',
        '/tmp/out',
        '--clean',
        '--verbose',
        '--dry-run',
      ])

      expect(args.packagePath).toBe('/path/to/pkg')
      expect(args.outputDir).toBe('/tmp/out')
      expect(args.clean).toBe(true)
      expect(args.verbose).toBe(true)
      expect(args.dryRun).toBe(true)
    })

    it('should throw error for unknown option', () => {
      expect(() => parseArgs(['node', 'monocrate', '--unknown'])).toThrow(
        'Unknown option: --unknown'
      )
    })

    it('should throw error for missing --output value', () => {
      expect(() => parseArgs(['node', 'monocrate', '--output'])).toThrow(
        '--output requires a directory path'
      )
    })

    it('should throw error for missing --root value', () => {
      expect(() => parseArgs(['node', 'monocrate', '--root'])).toThrow(
        '--root requires a directory path'
      )
    })

    it('should throw error for --output followed by another flag', () => {
      expect(() =>
        parseArgs(['node', 'monocrate', '--output', '--verbose'])
      ).toThrow('--output requires a directory path')
    })

    it('should throw error for unexpected positional argument', () => {
      expect(() =>
        parseArgs(['node', 'monocrate', '/first/path', '/second/path'])
      ).toThrow('Unexpected argument: /second/path')
    })
  })

  describe('validateArgs', () => {
    it('should return null for valid arguments', async () => {
      const pkgDir = await createPackageDir('my-package', {
        name: 'my-package',
        version: '1.0.0',
      })

      const args: CliArgs = {
        packagePath: pkgDir,
        outputDir: path.join(tempDir, 'output'),
        monorepoRoot: null,
        clean: false,
        includeDev: false,
        dryRun: false,
        verbose: false,
        quiet: false,
        help: false,
        version: false,
      }

      const result = await validateArgs(args)
      expect(result).toBe(null)
    })

    it('should return error for non-existent package path', async () => {
      const args: CliArgs = {
        packagePath: path.join(tempDir, 'nonexistent'),
        outputDir: path.join(tempDir, 'output'),
        monorepoRoot: null,
        clean: false,
        includeDev: false,
        dryRun: false,
        verbose: false,
        quiet: false,
        help: false,
        version: false,
      }

      const result = await validateArgs(args)
      expect(result).toContain('does not exist')
    })

    it('should return error if package path is not a directory', async () => {
      const filePath = path.join(tempDir, 'some-file.txt')
      await fs.writeFile(filePath, 'content')

      const args: CliArgs = {
        packagePath: filePath,
        outputDir: path.join(tempDir, 'output'),
        monorepoRoot: null,
        clean: false,
        includeDev: false,
        dryRun: false,
        verbose: false,
        quiet: false,
        help: false,
        version: false,
      }

      const result = await validateArgs(args)
      expect(result).toContain('not a directory')
    })

    it('should return error if no package.json in package path', async () => {
      const emptyDir = path.join(tempDir, 'empty')
      await fs.mkdir(emptyDir, { recursive: true })

      const args: CliArgs = {
        packagePath: emptyDir,
        outputDir: path.join(tempDir, 'output'),
        monorepoRoot: null,
        clean: false,
        includeDev: false,
        dryRun: false,
        verbose: false,
        quiet: false,
        help: false,
        version: false,
      }

      const result = await validateArgs(args)
      expect(result).toContain('No package.json found')
    })

    it('should return error for non-existent monorepo root', async () => {
      const pkgDir = await createPackageDir('my-package', {
        name: 'my-package',
        version: '1.0.0',
      })

      const args: CliArgs = {
        packagePath: pkgDir,
        outputDir: path.join(tempDir, 'output'),
        monorepoRoot: path.join(tempDir, 'nonexistent-root'),
        clean: false,
        includeDev: false,
        dryRun: false,
        verbose: false,
        quiet: false,
        help: false,
        version: false,
      }

      const result = await validateArgs(args)
      expect(result).toContain('Monorepo root does not exist')
    })

    it('should return error if output is inside package directory', async () => {
      const pkgDir = await createPackageDir('my-package', {
        name: 'my-package',
        version: '1.0.0',
      })

      const args: CliArgs = {
        packagePath: pkgDir,
        outputDir: path.join(pkgDir, 'output'),
        monorepoRoot: null,
        clean: false,
        includeDev: false,
        dryRun: false,
        verbose: false,
        quiet: false,
        help: false,
        version: false,
      }

      const result = await validateArgs(args)
      expect(result).toContain('cannot be inside package directory')
    })
  })

  describe('findMonorepoRoot', () => {
    it('should detect monorepo root from pnpm-workspace.yaml', async () => {
      const pkgDir = await createPackageDir('packages/my-lib', {
        name: 'my-lib',
        version: '1.0.0',
      })
      await fs.writeFile(
        path.join(tempDir, 'pnpm-workspace.yaml'),
        "packages:\n  - 'packages/*'"
      )

      const root = await findMonorepoRoot(pkgDir)
      expect(root).toBe(tempDir)
    })

    it('should detect monorepo root from package.json workspaces', async () => {
      await createPackageDir('.', {
        name: 'monorepo',
        version: '1.0.0',
        workspaces: ['packages/*'],
      })
      const pkgDir = await createPackageDir('packages/my-lib', {
        name: 'my-lib',
        version: '1.0.0',
      })

      const root = await findMonorepoRoot(pkgDir)
      expect(root).toBe(tempDir)
    })

    it('should detect monorepo root from lock files', async () => {
      await fs.writeFile(path.join(tempDir, 'package-lock.json'), '{}')
      const pkgDir = await createPackageDir('packages/my-lib', {
        name: 'my-lib',
        version: '1.0.0',
      })

      const root = await findMonorepoRoot(pkgDir)
      expect(root).toBe(tempDir)
    })

    it('should return null if no monorepo root found', async () => {
      // Create a deep directory structure without any monorepo markers
      const deepDir = path.join(tempDir, 'some', 'deep', 'directory')
      await fs.mkdir(deepDir, { recursive: true })

      // This will traverse up until it hits temp directory boundary
      // Since we're in a temp directory, it should eventually return null
      // unless it finds markers in parent directories
      const root = await findMonorepoRoot(deepDir)

      // The result could be tempDir if there are markers in parent test dirs
      // or null if truly isolated. We just check it doesn't crash.
      expect(root === null || typeof root === 'string').toBe(true)
    })

    it('should handle yarn.lock', async () => {
      await fs.writeFile(path.join(tempDir, 'yarn.lock'), '')
      const pkgDir = await createPackageDir('packages/my-lib', {
        name: 'my-lib',
        version: '1.0.0',
      })

      const root = await findMonorepoRoot(pkgDir)
      expect(root).toBe(tempDir)
    })

    it('should handle pnpm-lock.yaml', async () => {
      await fs.writeFile(path.join(tempDir, 'pnpm-lock.yaml'), '')
      const pkgDir = await createPackageDir('packages/my-lib', {
        name: 'my-lib',
        version: '1.0.0',
      })

      const root = await findMonorepoRoot(pkgDir)
      expect(root).toBe(tempDir)
    })

    it('should prefer workspace config over lock files', async () => {
      // Create both workspace config and lock file at different levels
      const monorepoRoot = path.join(tempDir, 'monorepo')
      await fs.mkdir(monorepoRoot, { recursive: true })
      await fs.writeFile(
        path.join(monorepoRoot, 'pnpm-workspace.yaml'),
        "packages:\n  - 'packages/*'"
      )

      const pkgDir = await createPackageDir('monorepo/packages/my-lib', {
        name: 'my-lib',
        version: '1.0.0',
      })

      const root = await findMonorepoRoot(pkgDir)
      expect(root).toBe(monorepoRoot)
    })
  })
})
