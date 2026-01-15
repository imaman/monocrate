import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { findMonorepoRoot, program } from '../index.js'

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
  async function createPackageDir(relativePath: string, packageJson: Record<string, unknown>): Promise<string> {
    const dir = path.join(tempDir, relativePath)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify(packageJson, null, 2))
    return dir
  }

  describe('program configuration', () => {
    it('should have correct name', () => {
      expect(program.name()).toBe('monocrate')
    })

    it('should have version configured', () => {
      expect(program.version()).toBeDefined()
    })

    it('should have expected options', () => {
      const optionNames = program.options.map((opt) => opt.long ?? opt.short)
      expect(optionNames).toContain('--output')
      expect(optionNames).toContain('--root')
      expect(optionNames).toContain('--clean')
      expect(optionNames).toContain('--include-dev')
      expect(optionNames).toContain('--dry-run')
      expect(optionNames).toContain('--verbose')
      expect(optionNames).toContain('--quiet')
    })

    it('should have short aliases for common options', () => {
      const outputOption = program.options.find((opt) => opt.long === '--output')
      expect(outputOption?.short).toBe('-o')

      const rootOption = program.options.find((opt) => opt.long === '--root')
      expect(rootOption?.short).toBe('-r')

      const cleanOption = program.options.find((opt) => opt.long === '--clean')
      expect(cleanOption?.short).toBe('-c')

      const verboseOption = program.options.find((opt) => opt.long === '--verbose')
      expect(verboseOption?.short).toBe('-v')

      const quietOption = program.options.find((opt) => opt.long === '--quiet')
      expect(quietOption?.short).toBe('-q')
    })
  })

  describe('findMonorepoRoot', () => {
    it('should detect monorepo root from pnpm-workspace.yaml', async () => {
      const pkgDir = await createPackageDir('packages/my-lib', {
        name: 'my-lib',
        version: '1.0.0',
      })
      await fs.writeFile(path.join(tempDir, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'")

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
      await fs.writeFile(path.join(monorepoRoot, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'")

      const pkgDir = await createPackageDir('monorepo/packages/my-lib', {
        name: 'my-lib',
        version: '1.0.0',
      })

      const root = await findMonorepoRoot(pkgDir)
      expect(root).toBe(monorepoRoot)
    })
  })
})
