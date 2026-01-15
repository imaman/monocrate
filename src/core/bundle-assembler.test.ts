import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import {
  createOutputDir,
  copyDistDirectory,
  copyDependencyDist,
  assembleBundle,
  validateDistDirectories,
} from './bundle-assembler.js'
import {
  FileSystemError,
  type MonorepoPackage,
  type DependencyGraph,
  type DependencyNode,
  type BundleOptions,
} from './types.js'

describe('bundle-assembler', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'monocrate-assembler-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  /**
   * Helper to create a mock package with dist directory
   */
  async function createMockPackage(
    name: string,
    files: Record<string, string>
  ): Promise<MonorepoPackage> {
    const pkgPath = path.join(tempDir, 'packages', name.replace(/\//g, '_'))
    const distPath = path.join(pkgPath, 'dist')
    await fs.mkdir(distPath, { recursive: true })

    for (const [filename, content] of Object.entries(files)) {
      const filePath = path.join(distPath, filename)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, content)
    }

    return {
      path: pkgPath,
      packageJson: { name, version: '1.0.0' },
      distPath,
      hasDistDirectory: true,
    }
  }

  describe('createOutputDir', () => {
    it('should create a new directory', async () => {
      const outputPath = path.join(tempDir, 'output')

      const result = await createOutputDir(outputPath)

      expect(result).toBe(outputPath)
      const stat = await fs.stat(outputPath)
      expect(stat.isDirectory()).toBe(true)
    })

    it('should clean existing directory when clean=true', async () => {
      const outputPath = path.join(tempDir, 'output')
      await fs.mkdir(outputPath, { recursive: true })
      await fs.writeFile(path.join(outputPath, 'existing.txt'), 'old content')

      await createOutputDir(outputPath, true)

      const files = await fs.readdir(outputPath)
      expect(files).toHaveLength(0)
    })

    it('should preserve existing directory when clean=false', async () => {
      const outputPath = path.join(tempDir, 'output')
      await fs.mkdir(outputPath, { recursive: true })
      await fs.writeFile(path.join(outputPath, 'existing.txt'), 'old content')

      await createOutputDir(outputPath, false)

      const files = await fs.readdir(outputPath)
      expect(files).toContain('existing.txt')
    })

    it('should throw FileSystemError for relative paths', async () => {
      await expect(createOutputDir('relative/path')).rejects.toThrow(
        FileSystemError
      )
    })

    it('should normalize paths with .. (resolved by path.normalize)', async () => {
      // Note: path.normalize resolves '..' before our check, so this path becomes valid
      // The path /tmp/xxx/safe/../.. becomes /tmp which is a valid absolute path
      const pathWithDots = path.join(tempDir, 'safe', '..', 'resolved')

      // This should succeed because path.normalize resolves the ..
      const result = await createOutputDir(pathWithDots)
      expect(result).toBe(path.normalize(pathWithDots))
    })

    it('should create nested directories', async () => {
      const outputPath = path.join(tempDir, 'a', 'b', 'c', 'd')

      await createOutputDir(outputPath)

      const stat = await fs.stat(outputPath)
      expect(stat.isDirectory()).toBe(true)
    })
  })

  describe('copyDistDirectory', () => {
    it('should copy all files from dist directory', async () => {
      const pkg = await createMockPackage('my-package', {
        'index.js': 'export const x = 1;',
        'index.d.ts': 'export declare const x: number;',
        'utils/helper.js': 'export function help() {}',
      })
      const outputDir = path.join(tempDir, 'output')
      await fs.mkdir(outputDir, { recursive: true })

      const result = await copyDistDirectory(pkg, outputDir, {
        includeSourceMaps: true,
        includeDeclarations: true,
      })

      expect(result.filesCopied).toBe(3)
      expect(await fs.readFile(path.join(outputDir, 'index.js'), 'utf-8')).toBe(
        'export const x = 1;'
      )
    })

    it('should exclude source maps when includeSourceMaps=false', async () => {
      const pkg = await createMockPackage('my-package', {
        'index.js': 'code',
        'index.js.map': 'sourcemap',
        'index.d.ts.map': 'dts sourcemap',
      })
      const outputDir = path.join(tempDir, 'output')
      await fs.mkdir(outputDir, { recursive: true })

      const result = await copyDistDirectory(pkg, outputDir, {
        includeSourceMaps: false,
        includeDeclarations: true,
      })

      expect(result.filesCopied).toBe(1)
      const files = await fs.readdir(outputDir)
      expect(files).not.toContain('index.js.map')
    })

    it('should exclude declaration files when includeDeclarations=false', async () => {
      const pkg = await createMockPackage('my-package', {
        'index.js': 'code',
        'index.d.ts': 'types',
      })
      const outputDir = path.join(tempDir, 'output')
      await fs.mkdir(outputDir, { recursive: true })

      const result = await copyDistDirectory(pkg, outputDir, {
        includeSourceMaps: true,
        includeDeclarations: false,
      })

      expect(result.filesCopied).toBe(1)
      const files = await fs.readdir(outputDir)
      expect(files).not.toContain('index.d.ts')
    })

    it('should throw FileSystemError if dist directory does not exist', async () => {
      const pkg: MonorepoPackage = {
        path: path.join(tempDir, 'no-dist'),
        packageJson: { name: 'no-dist', version: '1.0.0' },
        distPath: path.join(tempDir, 'no-dist', 'dist'),
        hasDistDirectory: false,
      }
      const outputDir = path.join(tempDir, 'output')
      await fs.mkdir(outputDir, { recursive: true })

      await expect(
        copyDistDirectory(pkg, outputDir, {
          includeSourceMaps: true,
          includeDeclarations: true,
        })
      ).rejects.toThrow(FileSystemError)
    })

    it('should preserve nested directory structure', async () => {
      const pkg = await createMockPackage('my-package', {
        'index.js': 'root',
        'utils/index.js': 'utils',
        'utils/deep/nested.js': 'nested',
      })
      const outputDir = path.join(tempDir, 'output')
      await fs.mkdir(outputDir, { recursive: true })

      await copyDistDirectory(pkg, outputDir, {
        includeSourceMaps: true,
        includeDeclarations: true,
      })

      expect(
        await fs.readFile(path.join(outputDir, 'utils/deep/nested.js'), 'utf-8')
      ).toBe('nested')
    })

    it('should calculate total size correctly', async () => {
      const pkg = await createMockPackage('my-package', {
        'a.js': 'aaaa', // 4 bytes
        'b.js': 'bbbbbb', // 6 bytes
      })
      const outputDir = path.join(tempDir, 'output')
      await fs.mkdir(outputDir, { recursive: true })

      const result = await copyDistDirectory(pkg, outputDir, {
        includeSourceMaps: true,
        includeDeclarations: true,
      })

      expect(result.totalSize).toBe(10)
    })
  })

  describe('copyDependencyDist', () => {
    it('should copy to _deps subdirectory', async () => {
      const pkg = await createMockPackage('dep-package', {
        'index.js': 'dependency code',
      })
      const outputDir = path.join(tempDir, 'output')
      await fs.mkdir(outputDir, { recursive: true })

      await copyDependencyDist(pkg, outputDir, 'dep-package', {
        includeSourceMaps: true,
        includeDeclarations: true,
      })

      const depPath = path.join(outputDir, '_deps', 'dep-package', 'index.js')
      expect(await fs.readFile(depPath, 'utf-8')).toBe('dependency code')
    })

    it('should handle scoped package names', async () => {
      const pkg = await createMockPackage('@myorg/utils', {
        'index.js': 'utils code',
      })
      const outputDir = path.join(tempDir, 'output')
      await fs.mkdir(outputDir, { recursive: true })

      await copyDependencyDist(pkg, outputDir, '@myorg/utils', {
        includeSourceMaps: true,
        includeDeclarations: true,
      })

      // @myorg/utils -> _myorg_utils
      const depPath = path.join(outputDir, '_deps', '_myorg_utils', 'index.js')
      expect(await fs.readFile(depPath, 'utf-8')).toBe('utils code')
    })
  })

  describe('assembleBundle', () => {
    it('should assemble a complete bundle', async () => {
      // Create mock packages
      const utilsPkg = await createMockPackage('@myorg/utils', {
        'index.js': 'utils',
      })
      const corePkg = await createMockPackage('@myorg/core', {
        'index.js': 'core',
      })
      const appPkg = await createMockPackage('@myorg/app', {
        'index.js': 'app',
      })

      const rootNode: DependencyNode = {
        package: appPkg,
        inRepoDependencies: ['@myorg/core'],
        thirdPartyDependencies: {},
      }

      const graph: DependencyGraph = {
        root: rootNode,
        nodes: new Map([
          [
            '@myorg/utils',
            {
              package: utilsPkg,
              inRepoDependencies: [],
              thirdPartyDependencies: { lodash: '^4.17.0' },
            },
          ],
          [
            '@myorg/core',
            {
              package: corePkg,
              inRepoDependencies: ['@myorg/utils'],
              thirdPartyDependencies: {},
            },
          ],
          ['@myorg/app', rootNode],
        ]),
        topologicalOrder: ['@myorg/utils', '@myorg/core', '@myorg/app'],
      }

      const outputDir = path.join(tempDir, 'bundle-output')
      const options: BundleOptions = {
        packagePath: appPkg.path,
        monorepoRoot: tempDir,
        outputDir,
        includeSourceMaps: true,
        includeDeclarations: true,
        versionConflictStrategy: 'warn',
        cleanOutputDir: true,
        distDirName: 'dist',
      }

      const result = await assembleBundle(graph, options)

      expect(result.outputPath).toBe(outputDir)
      expect(result.assembledPackages).toContain('@myorg/app')
      expect(result.assembledPackages).toContain('@myorg/core')
      expect(result.assembledPackages).toContain('@myorg/utils')

      // Root package should be at output root
      expect(
        await fs.readFile(path.join(outputDir, 'index.js'), 'utf-8')
      ).toBe('app')

      // Dependencies should be in _deps
      expect(
        await fs.readFile(
          path.join(outputDir, '_deps', '_myorg_core', 'index.js'),
          'utf-8'
        )
      ).toBe('core')
    })

    it('should respect cleanOutputDir option', async () => {
      const pkg = await createMockPackage('simple', { 'index.js': 'code' })
      const outputDir = path.join(tempDir, 'output')
      await fs.mkdir(outputDir, { recursive: true })
      await fs.writeFile(path.join(outputDir, 'old-file.txt'), 'old')

      const graph: DependencyGraph = {
        root: {
          package: pkg,
          inRepoDependencies: [],
          thirdPartyDependencies: {},
        },
        nodes: new Map([
          [
            'simple',
            {
              package: pkg,
              inRepoDependencies: [],
              thirdPartyDependencies: {},
            },
          ],
        ]),
        topologicalOrder: ['simple'],
      }

      await assembleBundle(graph, {
        packagePath: pkg.path,
        monorepoRoot: tempDir,
        outputDir,
        includeSourceMaps: true,
        includeDeclarations: true,
        versionConflictStrategy: 'warn',
        cleanOutputDir: true,
        distDirName: 'dist',
      })

      const files = await fs.readdir(outputDir)
      expect(files).not.toContain('old-file.txt')
    })
  })

  describe('assembleBundle error paths', () => {
    it('should throw MonocrateError when package not in nodes map', async () => {
      const pkg: MonorepoPackage = {
        path: path.join(tempDir, 'pkg'),
        packageJson: { name: 'test', version: '1.0.0' },
        distPath: path.join(tempDir, 'pkg', 'dist'),
        hasDistDirectory: true,
      }

      // Create an invalid graph where topologicalOrder contains a package not in nodes
      const graph: DependencyGraph = {
        root: {
          package: pkg,
          inRepoDependencies: [],
          thirdPartyDependencies: {},
        },
        nodes: new Map([
          [
            'test',
            {
              package: pkg,
              inRepoDependencies: [],
              thirdPartyDependencies: {},
            },
          ],
        ]),
        // 'missing-package' is in order but not in nodes
        topologicalOrder: ['missing-package', 'test'],
      }

      const outputDir = path.join(tempDir, 'output')

      await expect(
        assembleBundle(graph, {
          packagePath: pkg.path,
          monorepoRoot: tempDir,
          outputDir,
          includeSourceMaps: true,
          includeDeclarations: true,
          versionConflictStrategy: 'warn',
          cleanOutputDir: true,
          distDirName: 'dist',
        })
      ).rejects.toThrow('not found in dependency graph')
    })

    it('should wrap FileSystemError with context', async () => {
      const pkg: MonorepoPackage = {
        path: path.join(tempDir, 'pkg'),
        packageJson: { name: 'test', version: '1.0.0' },
        distPath: path.join(tempDir, 'pkg', 'dist'),
        hasDistDirectory: false, // This will cause FileSystemError
      }

      const graph: DependencyGraph = {
        root: {
          package: pkg,
          inRepoDependencies: [],
          thirdPartyDependencies: {},
        },
        nodes: new Map([
          [
            'test',
            {
              package: pkg,
              inRepoDependencies: [],
              thirdPartyDependencies: {},
            },
          ],
        ]),
        topologicalOrder: ['test'],
      }

      const outputDir = path.join(tempDir, 'output')

      await expect(
        assembleBundle(graph, {
          packagePath: pkg.path,
          monorepoRoot: tempDir,
          outputDir,
          includeSourceMaps: true,
          includeDeclarations: true,
          versionConflictStrategy: 'warn',
          cleanOutputDir: true,
          distDirName: 'dist',
        })
      ).rejects.toThrow("Failed to assemble package 'test'")
    })
  })

  describe('validateDistDirectories', () => {
    it('should return empty array when all packages have dist', () => {
      const pkg: MonorepoPackage = {
        path: '/path',
        packageJson: { name: 'test', version: '1.0.0' },
        distPath: '/path/dist',
        hasDistDirectory: true,
      }

      const graph: DependencyGraph = {
        root: {
          package: pkg,
          inRepoDependencies: [],
          thirdPartyDependencies: {},
        },
        nodes: new Map([
          [
            'test',
            {
              package: pkg,
              inRepoDependencies: [],
              thirdPartyDependencies: {},
            },
          ],
        ]),
        topologicalOrder: ['test'],
      }

      const missing = validateDistDirectories(graph)
      expect(missing).toHaveLength(0)
    })

    it('should return package names missing dist directories', () => {
      const pkgWithDist: MonorepoPackage = {
        path: '/path/a',
        packageJson: { name: 'with-dist', version: '1.0.0' },
        distPath: '/path/a/dist',
        hasDistDirectory: true,
      }

      const pkgWithoutDist: MonorepoPackage = {
        path: '/path/b',
        packageJson: { name: 'without-dist', version: '1.0.0' },
        distPath: '/path/b/dist',
        hasDistDirectory: false,
      }

      const graph: DependencyGraph = {
        root: {
          package: pkgWithDist,
          inRepoDependencies: ['without-dist'],
          thirdPartyDependencies: {},
        },
        nodes: new Map([
          [
            'with-dist',
            {
              package: pkgWithDist,
              inRepoDependencies: ['without-dist'],
              thirdPartyDependencies: {},
            },
          ],
          [
            'without-dist',
            {
              package: pkgWithoutDist,
              inRepoDependencies: [],
              thirdPartyDependencies: {},
            },
          ],
        ]),
        topologicalOrder: ['without-dist', 'with-dist'],
      }

      const missing = validateDistDirectories(graph)
      expect(missing).toEqual(['without-dist'])
    })
  })
})
