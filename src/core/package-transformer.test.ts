import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import {
  extractThirdPartyDeps,
  mergeVersions,
  generatePackageJson,
  removeInRepoDeps,
  transformPackageJson,
  writePackageJson,
} from './package-transformer.js'
import {
  type DependencyNode,
  type DependencyGraph,
  type MonorepoPackage,
  type PackageJson,
  type BundleOptions,
  VersionConflictError,
  MonocrateError,
} from './types.js'

describe('package-transformer', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'monocrate-transformer-')
    )
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  /**
   * Helper to create a dependency node
   */
  function createNode(
    name: string,
    thirdParty: Record<string, string>,
    inRepo: string[] = []
  ): DependencyNode {
    const pkg: MonorepoPackage = {
      path: `/path/to/${name}`,
      packageJson: { name, version: '1.0.0' },
      distPath: `/path/to/${name}/dist`,
      hasDistDirectory: true,
    }
    return {
      package: pkg,
      inRepoDependencies: inRepo,
      thirdPartyDependencies: thirdParty,
    }
  }

  describe('extractThirdPartyDeps', () => {
    it('should collect all third-party dependencies', () => {
      const nodes = [
        createNode('pkg-a', { lodash: '^4.17.0', axios: '^1.0.0' }),
        createNode('pkg-b', { react: '^18.0.0', lodash: '^4.17.0' }),
      ]

      const { dependencies, conflicts } = extractThirdPartyDeps(nodes, {
        versionConflictStrategy: 'warn',
      })

      expect(dependencies.lodash).toBe('^4.17.0')
      expect(dependencies.axios).toBe('^1.0.0')
      expect(dependencies.react).toBe('^18.0.0')
      expect(conflicts).toHaveLength(0) // Same version, no conflict
    })

    it('should detect version conflicts', () => {
      const nodes = [
        createNode('pkg-a', { lodash: '^4.17.0' }),
        createNode('pkg-b', { lodash: '^4.18.0' }),
      ]

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

      const { conflicts } = extractThirdPartyDeps(nodes, {
        versionConflictStrategy: 'warn',
      })

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0]?.dependencyName).toBe('lodash')
      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should throw on conflict when strategy is error', () => {
      const nodes = [
        createNode('pkg-a', { lodash: '^4.17.0' }),
        createNode('pkg-b', { lodash: '^4.18.0' }),
      ]

      expect(() =>
        extractThirdPartyDeps(nodes, {
          versionConflictStrategy: 'error',
        })
      ).toThrow(VersionConflictError)
    })

    it('should resolve to highest version', () => {
      const nodes = [
        createNode('pkg-a', { lodash: '^4.17.0' }),
        createNode('pkg-b', { lodash: '^4.18.0' }),
        createNode('pkg-c', { lodash: '^4.17.21' }),
      ]

      vi.spyOn(console, 'warn').mockImplementation(() => undefined)

      const { dependencies } = extractThirdPartyDeps(nodes, {
        versionConflictStrategy: 'highest',
      })

      // Should pick highest
      expect(dependencies.lodash).toBe('^4.18.0')
    })

    it('should handle empty nodes', () => {
      const { dependencies, conflicts } = extractThirdPartyDeps([], {
        versionConflictStrategy: 'warn',
      })

      expect(Object.keys(dependencies)).toHaveLength(0)
      expect(conflicts).toHaveLength(0)
    })
  })

  describe('mergeVersions', () => {
    it('should merge multiple dependency objects', () => {
      const deps = [
        { lodash: '^4.17.0', axios: '^1.0.0' },
        { lodash: '^4.18.0', react: '^18.0.0' },
        { express: '^4.0.0' },
      ]

      const merged = mergeVersions(deps)

      expect(merged.lodash).toBe('^4.18.0') // Higher version
      expect(merged.axios).toBe('^1.0.0')
      expect(merged.react).toBe('^18.0.0')
      expect(merged.express).toBe('^4.0.0')
    })

    it('should handle empty array', () => {
      const merged = mergeVersions([])
      expect(Object.keys(merged)).toHaveLength(0)
    })

    it('should handle single dependency object', () => {
      const merged = mergeVersions([{ lodash: '^4.17.0' }])
      expect(merged).toEqual({ lodash: '^4.17.0' })
    })

    it('should handle non-semver versions gracefully', () => {
      const deps = [
        { 'some-pkg': 'github:user/repo' },
        { 'some-pkg': 'latest' },
      ]

      // Should not throw
      const merged = mergeVersions(deps)
      expect(merged['some-pkg']).toBeDefined()
    })
  })

  describe('generatePackageJson', () => {
    it('should generate package.json with merged dependencies', () => {
      const original: PackageJson = {
        name: 'my-app',
        version: '2.0.0',
        description: 'My application',
        main: 'dist/index.js',
        types: 'dist/index.d.ts',
        type: 'module',
        dependencies: {
          '@myorg/core': 'workspace:*',
          lodash: '^4.17.0',
        },
        devDependencies: {
          typescript: '^5.0.0',
        },
        license: 'MIT',
      }

      const mergedDeps = {
        lodash: '^4.17.0',
        axios: '^1.0.0',
        react: '^18.0.0',
      }

      const result = generatePackageJson(original, mergedDeps, {
        versionConflictStrategy: 'warn',
      })

      expect(result.name).toBe('my-app')
      expect(result.version).toBe('2.0.0')
      expect(result.dependencies).toEqual(mergedDeps)
      expect(result.devDependencies).toBeUndefined() // Removed by default
      expect(result.license).toBe('MIT')
    })

    it('should preserve devDependencies when option is set', () => {
      const original: PackageJson = {
        name: 'test',
        version: '1.0.0',
        devDependencies: { typescript: '^5.0.0' },
      }

      const result = generatePackageJson(original, {}, {
        versionConflictStrategy: 'warn',
        preserveDevDependencies: true,
      })

      expect(result.devDependencies).toEqual({ typescript: '^5.0.0' })
    })

    it('should remove workspace-specific fields', () => {
      const original: PackageJson = {
        name: 'test',
        version: '1.0.0',
        private: true,
        workspaces: ['packages/*'],
        scripts: { build: 'tsc' },
      }

      const result = generatePackageJson(original, {}, {
        versionConflictStrategy: 'warn',
      })

      expect(result.private).toBeUndefined()
      expect(result.workspaces).toBeUndefined()
      expect(result.scripts).toBeUndefined()
    })

    it('should preserve peer dependencies by default', () => {
      const original: PackageJson = {
        name: 'test',
        version: '1.0.0',
        peerDependencies: { react: '^18.0.0' },
      }

      const result = generatePackageJson(original, {}, {
        versionConflictStrategy: 'warn',
      })

      expect(result.peerDependencies).toEqual({ react: '^18.0.0' })
    })

    it('should throw if name is missing', () => {
      const original = {
        version: '1.0.0',
      } as PackageJson

      expect(() =>
        generatePackageJson(original, {}, {
          versionConflictStrategy: 'warn',
        })
      ).toThrow(MonocrateError)
    })

    it('should throw if version is missing', () => {
      const original = {
        name: 'test',
      } as PackageJson

      expect(() =>
        generatePackageJson(original, {}, {
          versionConflictStrategy: 'warn',
        })
      ).toThrow(MonocrateError)
    })

    it('should preserve custom fields when specified', () => {
      const original: PackageJson = {
        name: 'test',
        version: '1.0.0',
        repository: { type: 'git', url: 'https://github.com/test/test' },
        bugs: { url: 'https://github.com/test/test/issues' },
        homepage: 'https://github.com/test/test',
      }

      const result = generatePackageJson(original, {}, {
        versionConflictStrategy: 'warn',
      })

      expect(result.repository).toEqual(original.repository)
      expect(result.bugs).toEqual(original.bugs)
      expect(result.homepage).toBe(original.homepage)
    })
  })

  describe('removeInRepoDeps', () => {
    it('should remove in-repo dependencies', () => {
      const deps = {
        '@myorg/utils': 'workspace:*',
        '@myorg/core': '^1.0.0',
        lodash: '^4.17.0',
      }
      const inRepo = new Set(['@myorg/utils', '@myorg/core'])

      const result = removeInRepoDeps(deps, inRepo)

      expect(result).toEqual({ lodash: '^4.17.0' })
    })

    it('should return all deps if no in-repo matches', () => {
      const deps = { lodash: '^4.17.0', axios: '^1.0.0' }
      const inRepo = new Set(['@myorg/utils'])

      const result = removeInRepoDeps(deps, inRepo)

      expect(result).toEqual(deps)
    })

    it('should return empty object if all are in-repo', () => {
      const deps = {
        '@myorg/a': 'workspace:*',
        '@myorg/b': 'workspace:*',
      }
      const inRepo = new Set(['@myorg/a', '@myorg/b'])

      const result = removeInRepoDeps(deps, inRepo)

      expect(Object.keys(result)).toHaveLength(0)
    })
  })

  describe('transformPackageJson', () => {
    it('should transform package.json for dependency graph', () => {
      const appPkg: MonorepoPackage = {
        path: '/app',
        packageJson: {
          name: 'my-app',
          version: '1.0.0',
          description: 'My app',
          dependencies: {
            '@myorg/core': 'workspace:*',
            react: '^18.0.0',
          },
        },
        distPath: '/app/dist',
        hasDistDirectory: true,
      }

      const corePkg: MonorepoPackage = {
        path: '/core',
        packageJson: { name: '@myorg/core', version: '1.0.0' },
        distPath: '/core/dist',
        hasDistDirectory: true,
      }

      const graph: DependencyGraph = {
        root: {
          package: appPkg,
          inRepoDependencies: ['@myorg/core'],
          thirdPartyDependencies: { react: '^18.0.0' },
        },
        nodes: new Map([
          [
            'my-app',
            {
              package: appPkg,
              inRepoDependencies: ['@myorg/core'],
              thirdPartyDependencies: { react: '^18.0.0' },
            },
          ],
          [
            '@myorg/core',
            {
              package: corePkg,
              inRepoDependencies: [],
              thirdPartyDependencies: { lodash: '^4.17.0' },
            },
          ],
        ]),
        topologicalOrder: ['@myorg/core', 'my-app'],
      }

      const options: BundleOptions = {
        packagePath: '/app',
        monorepoRoot: '/',
        outputDir: '/output',
        versionConflictStrategy: 'warn',
        includeSourceMaps: true,
        includeDeclarations: true,
        cleanOutputDir: true,
        distDirName: 'dist',
      }

      const { packageJson, conflicts } = transformPackageJson(graph, options)

      expect(packageJson.name).toBe('my-app')
      expect(packageJson.dependencies?.react).toBe('^18.0.0')
      expect(packageJson.dependencies?.lodash).toBe('^4.17.0')
      // In-repo deps should be removed
      expect(packageJson.dependencies?.['@myorg/core']).toBeUndefined()
      expect(packageJson.dependencies?.['my-app']).toBeUndefined()
      expect(conflicts).toHaveLength(0)
    })
  })

  describe('writePackageJson', () => {
    it('should write package.json to disk', async () => {
      const packageJson: PackageJson = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: { lodash: '^4.17.0' },
      }

      const outputPath = path.join(tempDir, 'package.json')

      await writePackageJson(packageJson, outputPath)

      const content = await fs.readFile(outputPath, 'utf-8')
      const parsed = JSON.parse(content) as PackageJson

      expect(parsed.name).toBe('test-package')
      expect(parsed.version).toBe('1.0.0')
      expect(parsed.dependencies).toEqual({ lodash: '^4.17.0' })
    })

    it('should format JSON with 2 spaces', async () => {
      const packageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
      }

      const outputPath = path.join(tempDir, 'package.json')

      await writePackageJson(packageJson, outputPath)

      const content = await fs.readFile(outputPath, 'utf-8')

      // Check indentation
      expect(content).toContain('  "name"')
      // Check trailing newline
      expect(content.endsWith('\n')).toBe(true)
    })
  })
})
