import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { bundle, VERSION } from './index.js'
import type { PackageJson } from './index.js'

describe('monocrate', () => {
  describe('VERSION', () => {
    it('should export a version string', () => {
      expect(VERSION).toBe('1.0.0')
      expect(typeof VERSION).toBe('string')
    })
  })

  describe('bundle', () => {
    let tempDir: string

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'monocrate-bundle-'))
    })

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true })
    })

    async function createPackage(
      relativePath: string,
      packageJson: Partial<PackageJson> & { name: string; version: string },
      distFiles: Record<string, string> = {}
    ): Promise<string> {
      const pkgDir = path.join(tempDir, relativePath)
      await fs.mkdir(pkgDir, { recursive: true })
      await fs.writeFile(
        path.join(pkgDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      )

      if (Object.keys(distFiles).length > 0) {
        const distDir = path.join(pkgDir, 'dist')
        await fs.mkdir(distDir, { recursive: true })
        for (const [filename, content] of Object.entries(distFiles)) {
          const filePath = path.join(distDir, filename)
          await fs.mkdir(path.dirname(filePath), { recursive: true })
          await fs.writeFile(filePath, content)
        }
      }

      return pkgDir
    }

    it('should return error for invalid output path (not absolute)', async () => {
      await createPackage('.', {
        name: 'root',
        version: '1.0.0',
        workspaces: ['packages/*'],
      })

      await createPackage(
        'packages/test-pkg',
        { name: 'test-pkg', version: '1.0.0' },
        { 'index.js': 'code' }
      )

      const result = await bundle({
        packagePath: path.join(tempDir, 'packages', 'test-pkg'),
        monorepoRoot: tempDir,
        outputDir: 'relative/path', // Invalid - not absolute
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Output path must be absolute')
      }
    })

    it('should return error when package.json not found', async () => {
      const result = await bundle({
        packagePath: path.join(tempDir, 'nonexistent'),
        monorepoRoot: tempDir,
        outputDir: path.join(tempDir, 'output'),
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('package.json not found')
      }
    })

    it('should return error when dist directory is missing', async () => {
      await createPackage('.', {
        name: 'root',
        version: '1.0.0',
        workspaces: ['packages/*'],
      })

      // Create package without dist
      await createPackage('packages/no-dist', {
        name: 'no-dist',
        version: '1.0.0',
      })

      const result = await bundle({
        packagePath: path.join(tempDir, 'packages', 'no-dist'),
        monorepoRoot: tempDir,
        outputDir: path.join(tempDir, 'output'),
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('not been built')
      }
    })

    it('should successfully bundle a simple package', async () => {
      await createPackage('.', {
        name: 'root',
        version: '1.0.0',
        workspaces: ['packages/*'],
      })

      await createPackage(
        'packages/simple',
        {
          name: 'simple-pkg',
          version: '1.0.0',
          description: 'A simple package',
          dependencies: {
            lodash: '^4.17.0',
          },
        },
        { 'index.js': 'module.exports = {}' }
      )

      const outputDir = path.join(tempDir, 'output')
      const result = await bundle({
        packagePath: path.join(tempDir, 'packages', 'simple'),
        monorepoRoot: tempDir,
        outputDir,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.outputPath).toBe(outputDir)
        expect(result.includedPackages).toContain('simple-pkg')
        expect(result.mergedDependencies.lodash).toBe('^4.17.0')

        // Check package.json was written
        const pkgJson = JSON.parse(
          await fs.readFile(path.join(outputDir, 'package.json'), 'utf-8')
        ) as PackageJson
        expect(pkgJson.name).toBe('simple-pkg')
        expect(pkgJson.dependencies?.lodash).toBe('^4.17.0')

        // Check dist files were copied
        const indexContent = await fs.readFile(
          path.join(outputDir, 'index.js'),
          'utf-8'
        )
        expect(indexContent).toBe('module.exports = {}')
      }
    })

    it('should bundle package with in-repo dependencies', async () => {
      await createPackage('.', {
        name: 'root',
        version: '1.0.0',
        workspaces: ['packages/*'],
      })

      await createPackage(
        'packages/utils',
        {
          name: '@myorg/utils',
          version: '1.0.0',
          dependencies: {
            lodash: '^4.17.0',
          },
        },
        { 'index.js': 'export const utils = {}' }
      )

      await createPackage(
        'packages/app',
        {
          name: '@myorg/app',
          version: '2.0.0',
          dependencies: {
            '@myorg/utils': 'workspace:*',
            axios: '^1.0.0',
          },
        },
        { 'index.js': 'export const app = {}' }
      )

      const outputDir = path.join(tempDir, 'output')
      const result = await bundle({
        packagePath: path.join(tempDir, 'packages', 'app'),
        monorepoRoot: tempDir,
        outputDir,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.includedPackages).toContain('@myorg/app')
        expect(result.includedPackages).toContain('@myorg/utils')

        // Merged deps should include both packages' third-party deps
        expect(result.mergedDependencies.lodash).toBe('^4.17.0')
        expect(result.mergedDependencies.axios).toBe('^1.0.0')

        // In-repo deps should be removed
        expect(result.mergedDependencies['@myorg/utils']).toBeUndefined()

        // Check deps were copied to _deps
        const depsContent = await fs.readFile(
          path.join(outputDir, '_deps', '_myorg_utils', 'index.js'),
          'utf-8'
        )
        expect(depsContent).toBe('export const utils = {}')
      }
    })

    it('should handle version conflicts with warn strategy', async () => {
      await createPackage('.', {
        name: 'root',
        version: '1.0.0',
        workspaces: ['packages/*'],
      })

      await createPackage(
        'packages/a',
        {
          name: 'pkg-a',
          version: '1.0.0',
          dependencies: {
            lodash: '^4.17.0',
          },
        },
        { 'index.js': 'a' }
      )

      await createPackage(
        'packages/b',
        {
          name: 'pkg-b',
          version: '1.0.0',
          dependencies: {
            'pkg-a': 'workspace:*',
            lodash: '^4.18.0',
          },
        },
        { 'index.js': 'b' }
      )

      const outputDir = path.join(tempDir, 'output')
      const result = await bundle({
        packagePath: path.join(tempDir, 'packages', 'b'),
        monorepoRoot: tempDir,
        outputDir,
        versionConflictStrategy: 'warn',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.versionConflicts.length).toBeGreaterThan(0)
        expect(result.versionConflicts[0]?.dependencyName).toBe('lodash')
      }
    })

    it('should respect includeSourceMaps option', async () => {
      await createPackage('.', {
        name: 'root',
        version: '1.0.0',
        workspaces: ['packages/*'],
      })

      await createPackage(
        'packages/with-maps',
        {
          name: 'with-maps',
          version: '1.0.0',
        },
        {
          'index.js': 'code',
          'index.js.map': 'sourcemap',
        }
      )

      // With source maps
      const outputWithMaps = path.join(tempDir, 'output-with-maps')
      const resultWith = await bundle({
        packagePath: path.join(tempDir, 'packages', 'with-maps'),
        monorepoRoot: tempDir,
        outputDir: outputWithMaps,
        includeSourceMaps: true,
      })

      expect(resultWith.success).toBe(true)
      const filesWithMaps = await fs.readdir(outputWithMaps)
      expect(filesWithMaps).toContain('index.js.map')

      // Without source maps
      const outputWithoutMaps = path.join(tempDir, 'output-without-maps')
      const resultWithout = await bundle({
        packagePath: path.join(tempDir, 'packages', 'with-maps'),
        monorepoRoot: tempDir,
        outputDir: outputWithoutMaps,
        includeSourceMaps: false,
      })

      expect(resultWithout.success).toBe(true)
      const filesWithoutMaps = await fs.readdir(outputWithoutMaps)
      expect(filesWithoutMaps).not.toContain('index.js.map')
    })

    it('should respect includeDeclarations option', async () => {
      await createPackage('.', {
        name: 'root',
        version: '1.0.0',
        workspaces: ['packages/*'],
      })

      await createPackage(
        'packages/with-dts',
        {
          name: 'with-dts',
          version: '1.0.0',
        },
        {
          'index.js': 'code',
          'index.d.ts': 'declare const x: number;',
        }
      )

      // Without declarations
      const outputWithoutDts = path.join(tempDir, 'output-without-dts')
      const resultWithout = await bundle({
        packagePath: path.join(tempDir, 'packages', 'with-dts'),
        monorepoRoot: tempDir,
        outputDir: outputWithoutDts,
        includeDeclarations: false,
      })

      expect(resultWithout.success).toBe(true)
      const filesWithoutDts = await fs.readdir(outputWithoutDts)
      expect(filesWithoutDts).not.toContain('index.d.ts')
    })
  })

  // Note: bundlePackage tests are skipped because they require process.chdir
  // which is not supported in vitest workers. The functionality is covered
  // by integration tests when running in a real environment.
  // The bundlePackage function is a thin wrapper around bundle() which
  // is thoroughly tested above.

  describe('bundle edge cases', () => {
    let tempDir: string

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'monocrate-edge-'))
    })

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true })
    })

    async function createPackage(
      relativePath: string,
      packageJson: Partial<PackageJson> & { name: string; version: string },
      distFiles: Record<string, string> = {}
    ): Promise<string> {
      const pkgDir = path.join(tempDir, relativePath)
      await fs.mkdir(pkgDir, { recursive: true })
      await fs.writeFile(
        path.join(pkgDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      )

      if (Object.keys(distFiles).length > 0) {
        const distDir = path.join(pkgDir, 'dist')
        await fs.mkdir(distDir, { recursive: true })
        for (const [filename, content] of Object.entries(distFiles)) {
          const filePath = path.join(distDir, filename)
          await fs.mkdir(path.dirname(filePath), { recursive: true })
          await fs.writeFile(filePath, content)
        }
      }

      return pkgDir
    }

    it('should handle package with no dependencies', async () => {
      await createPackage('.', {
        name: 'root',
        version: '1.0.0',
        workspaces: ['packages/*'],
      })

      await createPackage(
        'packages/standalone',
        {
          name: 'standalone',
          version: '1.0.0',
          description: 'No deps',
        },
        { 'index.js': 'standalone' }
      )

      const outputDir = path.join(tempDir, 'output')
      const result = await bundle({
        packagePath: path.join(tempDir, 'packages', 'standalone'),
        monorepoRoot: tempDir,
        outputDir,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.mergedDependencies).toEqual({})
        expect(result.versionConflicts).toHaveLength(0)
      }
    })

    it('should handle circular dependency error gracefully', async () => {
      await createPackage('.', {
        name: 'root',
        version: '1.0.0',
        workspaces: ['packages/*'],
      })

      // Create circular dependency: a -> b -> a
      await createPackage(
        'packages/a',
        {
          name: 'pkg-a',
          version: '1.0.0',
          dependencies: { 'pkg-b': 'workspace:*' },
        },
        { 'index.js': 'a' }
      )

      await createPackage(
        'packages/b',
        {
          name: 'pkg-b',
          version: '1.0.0',
          dependencies: { 'pkg-a': 'workspace:*' },
        },
        { 'index.js': 'b' }
      )

      const outputDir = path.join(tempDir, 'output')
      const result = await bundle({
        packagePath: path.join(tempDir, 'packages', 'a'),
        monorepoRoot: tempDir,
        outputDir,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Circular dependency')
      }
    })
  })
})
