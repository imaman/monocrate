import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import {
  findPackageJson,
  detectWorkspaceConfig,
  discoverMonorepoPackages,
  isInRepoDependency,
  separateDependencies,
  resolveInRepoDeps,
  buildDependencyGraph,
} from './dependency-resolver.js'
import {
  PackageJsonError,
  CircularDependencyError,
  type MonorepoPackage,
  type PackageJson,
} from './types.js'

describe('dependency-resolver', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'monocrate-test-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  /**
   * Helper to create a package in the temp directory
   */
  async function createPackage(
    relativePath: string,
    packageJson: Partial<PackageJson> & { name: string; version: string },
    hasDist = false
  ): Promise<string> {
    const pkgDir = path.join(tempDir, relativePath)
    await fs.mkdir(pkgDir, { recursive: true })
    await fs.writeFile(
      path.join(pkgDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    )

    if (hasDist) {
      const distDir = path.join(pkgDir, 'dist')
      await fs.mkdir(distDir, { recursive: true })
      await fs.writeFile(path.join(distDir, 'index.js'), '// compiled code')
    }

    return pkgDir
  }

  describe('findPackageJson', () => {
    it('should read and parse a valid package.json', async () => {
      await createPackage('my-package', {
        name: 'my-package',
        version: '1.0.0',
        description: 'Test package',
      })

      const result = await findPackageJson(path.join(tempDir, 'my-package'))
      expect(result.name).toBe('my-package')
      expect(result.version).toBe('1.0.0')
      expect(result.description).toBe('Test package')
    })

    it('should throw PackageJsonError if file not found', async () => {
      await expect(
        findPackageJson(path.join(tempDir, 'nonexistent'))
      ).rejects.toThrow(PackageJsonError)
    })

    it('should throw PackageJsonError for invalid JSON', async () => {
      const pkgDir = path.join(tempDir, 'invalid-json')
      await fs.mkdir(pkgDir, { recursive: true })
      await fs.writeFile(
        path.join(pkgDir, 'package.json'),
        '{ invalid json content }'
      )

      await expect(findPackageJson(pkgDir)).rejects.toThrow(PackageJsonError)
    })

    it('should throw PackageJsonError for invalid schema', async () => {
      const pkgDir = path.join(tempDir, 'invalid-schema')
      await fs.mkdir(pkgDir, { recursive: true })
      await fs.writeFile(
        path.join(pkgDir, 'package.json'),
        JSON.stringify({ notName: 'test' })
      )

      await expect(findPackageJson(pkgDir)).rejects.toThrow(PackageJsonError)
    })

    it('should parse package.json with dependencies', async () => {
      await createPackage('with-deps', {
        name: 'with-deps',
        version: '1.0.0',
        dependencies: {
          lodash: '^4.17.0',
          axios: '^1.0.0',
        },
        devDependencies: {
          typescript: '^5.0.0',
        },
      })

      const result = await findPackageJson(path.join(tempDir, 'with-deps'))
      expect(result.dependencies).toEqual({
        lodash: '^4.17.0',
        axios: '^1.0.0',
      })
      expect(result.devDependencies).toEqual({ typescript: '^5.0.0' })
    })
  })

  describe('detectWorkspaceConfig', () => {
    it('should detect pnpm workspace from pnpm-workspace.yaml', async () => {
      await fs.writeFile(
        path.join(tempDir, 'pnpm-workspace.yaml'),
        `packages:\n  - 'packages/*'\n  - 'libs/*'`
      )
      await createPackage('.', { name: 'root', version: '1.0.0' })

      const config = await detectWorkspaceConfig(tempDir)
      expect(config.packageManager).toBe('pnpm')
      expect(config.patterns).toContain('packages/*')
      expect(config.patterns).toContain('libs/*')
      expect(config.rootPath).toBe(tempDir)
    })

    it('should detect npm workspaces from package.json', async () => {
      await createPackage('.', {
        name: 'root',
        version: '1.0.0',
        workspaces: ['packages/*', 'apps/*'],
      })
      await fs.writeFile(path.join(tempDir, 'package-lock.json'), '{}')

      const config = await detectWorkspaceConfig(tempDir)
      expect(config.packageManager).toBe('npm')
      expect(config.patterns).toContain('packages/*')
      expect(config.patterns).toContain('apps/*')
    })

    it('should detect yarn from yarn.lock', async () => {
      await createPackage('.', {
        name: 'root',
        version: '1.0.0',
        workspaces: ['packages/*'],
      })
      await fs.writeFile(path.join(tempDir, 'yarn.lock'), '')

      const config = await detectWorkspaceConfig(tempDir)
      expect(config.packageManager).toBe('yarn')
    })

    it('should fall back to common patterns if no workspace config', async () => {
      const config = await detectWorkspaceConfig(tempDir)
      expect(config.packageManager).toBe('unknown')
      expect(config.patterns).toContain('packages/*')
      expect(config.patterns).toContain('libs/*')
    })

    it('should handle workspaces as object format', async () => {
      await createPackage('.', {
        name: 'root',
        version: '1.0.0',
        workspaces: { packages: ['packages/*', 'libs/*'] },
      } as PackageJson)

      const config = await detectWorkspaceConfig(tempDir)
      expect(config.patterns).toContain('packages/*')
      expect(config.patterns).toContain('libs/*')
    })
  })

  describe('discoverMonorepoPackages', () => {
    it('should discover packages in workspace directories', async () => {
      await createPackage('.', {
        name: 'root',
        version: '1.0.0',
        workspaces: ['packages/*'],
      })
      await createPackage('packages/pkg-a', {
        name: '@myorg/pkg-a',
        version: '1.0.0',
      })
      await createPackage('packages/pkg-b', {
        name: '@myorg/pkg-b',
        version: '2.0.0',
      })

      const packages = await discoverMonorepoPackages(tempDir)
      expect(packages.size).toBe(2)
      expect(packages.has('@myorg/pkg-a')).toBe(true)
      expect(packages.has('@myorg/pkg-b')).toBe(true)
    })

    it('should track dist directory existence', async () => {
      await createPackage('.', {
        name: 'root',
        version: '1.0.0',
        workspaces: ['packages/*'],
      })
      await createPackage(
        'packages/built',
        { name: 'built', version: '1.0.0' },
        true
      )
      await createPackage(
        'packages/unbuilt',
        { name: 'unbuilt', version: '1.0.0' },
        false
      )

      const packages = await discoverMonorepoPackages(tempDir)
      expect(packages.get('built')?.hasDistDirectory).toBe(true)
      expect(packages.get('unbuilt')?.hasDistDirectory).toBe(false)
    })

    it('should skip packages with invalid package.json', async () => {
      await createPackage('.', {
        name: 'root',
        version: '1.0.0',
        workspaces: ['packages/*'],
      })
      await createPackage('packages/valid', { name: 'valid', version: '1.0.0' })

      // Create invalid package
      const invalidDir = path.join(tempDir, 'packages', 'invalid')
      await fs.mkdir(invalidDir, { recursive: true })
      await fs.writeFile(
        path.join(invalidDir, 'package.json'),
        '{ invalid json }'
      )

      const packages = await discoverMonorepoPackages(tempDir)
      expect(packages.size).toBe(1)
      expect(packages.has('valid')).toBe(true)
    })
  })

  describe('isInRepoDependency', () => {
    it('should return true for in-repo packages', () => {
      const packages = new Map<string, MonorepoPackage>([
        [
          '@myorg/utils',
          {
            path: '/path/to/utils',
            packageJson: { name: '@myorg/utils', version: '1.0.0' },
            distPath: '/path/to/utils/dist',
            hasDistDirectory: true,
          },
        ],
      ])

      expect(isInRepoDependency('@myorg/utils', packages)).toBe(true)
    })

    it('should return false for third-party packages', () => {
      const packages = new Map<string, MonorepoPackage>()

      expect(isInRepoDependency('lodash', packages)).toBe(false)
    })
  })

  describe('separateDependencies', () => {
    it('should separate in-repo and third-party dependencies', () => {
      const packages = new Map<string, MonorepoPackage>([
        [
          '@myorg/utils',
          {
            path: '/path/to/utils',
            packageJson: { name: '@myorg/utils', version: '1.0.0' },
            distPath: '/path/to/utils/dist',
            hasDistDirectory: true,
          },
        ],
        [
          '@myorg/core',
          {
            path: '/path/to/core',
            packageJson: { name: '@myorg/core', version: '1.0.0' },
            distPath: '/path/to/core/dist',
            hasDistDirectory: true,
          },
        ],
      ])

      const packageJson: PackageJson = {
        name: 'my-app',
        version: '1.0.0',
        dependencies: {
          '@myorg/utils': 'workspace:*',
          '@myorg/core': 'workspace:*',
          lodash: '^4.17.0',
          axios: '^1.0.0',
        },
      }

      const { inRepo, thirdParty } = separateDependencies(packageJson, packages)

      expect(inRepo).toContain('@myorg/utils')
      expect(inRepo).toContain('@myorg/core')
      expect(inRepo).not.toContain('lodash')
      expect(thirdParty.lodash).toBe('^4.17.0')
      expect(thirdParty.axios).toBe('^1.0.0')
    })

    it('should handle empty dependencies', () => {
      const packages = new Map<string, MonorepoPackage>()
      const packageJson: PackageJson = { name: 'test', version: '1.0.0' }

      const { inRepo, thirdParty } = separateDependencies(packageJson, packages)

      expect(inRepo).toHaveLength(0)
      expect(Object.keys(thirdParty)).toHaveLength(0)
    })
  })

  describe('resolveInRepoDeps', () => {
    it('should resolve all transitive in-repo dependencies', async () => {
      // Setup: app -> core -> utils
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
        },
        true
      )
      await createPackage(
        'packages/core',
        {
          name: '@myorg/core',
          version: '1.0.0',
          dependencies: { '@myorg/utils': 'workspace:*' },
        },
        true
      )
      await createPackage(
        'packages/app',
        {
          name: '@myorg/app',
          version: '1.0.0',
          dependencies: { '@myorg/core': 'workspace:*' },
        },
        true
      )

      const deps = await resolveInRepoDeps(
        path.join(tempDir, 'packages', 'app'),
        tempDir
      )

      expect(deps.has('@myorg/core')).toBe(true)
      expect(deps.has('@myorg/utils')).toBe(true)
    })

    it('should detect circular dependencies', async () => {
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
          dependencies: { 'pkg-b': 'workspace:*' },
        },
        true
      )
      await createPackage(
        'packages/b',
        {
          name: 'pkg-b',
          version: '1.0.0',
          dependencies: { 'pkg-a': 'workspace:*' },
        },
        true
      )
      await createPackage(
        'packages/app',
        {
          name: 'app',
          version: '1.0.0',
          dependencies: { 'pkg-a': 'workspace:*' },
        },
        true
      )

      await expect(
        resolveInRepoDeps(path.join(tempDir, 'packages', 'app'), tempDir)
      ).rejects.toThrow(CircularDependencyError)
    })

    it('should return empty set for package with no in-repo deps', async () => {
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
          dependencies: { lodash: '^4.17.0' },
        },
        true
      )

      const deps = await resolveInRepoDeps(
        path.join(tempDir, 'packages', 'standalone'),
        tempDir
      )

      expect(deps.size).toBe(0)
    })
  })

  describe('buildDependencyGraph', () => {
    it('should build a complete dependency graph', async () => {
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
          dependencies: { lodash: '^4.17.0' },
        },
        true
      )
      await createPackage(
        'packages/core',
        {
          name: '@myorg/core',
          version: '1.0.0',
          dependencies: {
            '@myorg/utils': 'workspace:*',
            axios: '^1.0.0',
          },
        },
        true
      )
      await createPackage(
        'packages/app',
        {
          name: '@myorg/app',
          version: '1.0.0',
          dependencies: {
            '@myorg/core': 'workspace:*',
            react: '^18.0.0',
          },
        },
        true
      )

      const graph = await buildDependencyGraph(
        path.join(tempDir, 'packages', 'app'),
        tempDir
      )

      // Check root
      expect(graph.root.package.packageJson.name).toBe('@myorg/app')

      // Check nodes
      expect(graph.nodes.size).toBe(3)
      expect(graph.nodes.has('@myorg/app')).toBe(true)
      expect(graph.nodes.has('@myorg/core')).toBe(true)
      expect(graph.nodes.has('@myorg/utils')).toBe(true)

      // Check topological order (dependencies before dependents)
      const order = graph.topologicalOrder
      expect(order.indexOf('@myorg/utils')).toBeLessThan(
        order.indexOf('@myorg/core')
      )
      expect(order.indexOf('@myorg/core')).toBeLessThan(
        order.indexOf('@myorg/app')
      )

      // Check third-party dependencies
      const appNode = graph.nodes.get('@myorg/app')
      expect(appNode?.thirdPartyDependencies.react).toBe('^18.0.0')

      const coreNode = graph.nodes.get('@myorg/core')
      expect(coreNode?.thirdPartyDependencies.axios).toBe('^1.0.0')

      const utilsNode = graph.nodes.get('@myorg/utils')
      expect(utilsNode?.thirdPartyDependencies.lodash).toBe('^4.17.0')
    })

    it('should throw CircularDependencyError for cycles', async () => {
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
          dependencies: { 'pkg-b': 'workspace:*' },
        },
        true
      )
      await createPackage(
        'packages/b',
        {
          name: 'pkg-b',
          version: '1.0.0',
          dependencies: { 'pkg-a': 'workspace:*' },
        },
        true
      )
      await createPackage(
        'packages/app',
        {
          name: 'app',
          version: '1.0.0',
          dependencies: { 'pkg-a': 'workspace:*' },
        },
        true
      )

      await expect(
        buildDependencyGraph(path.join(tempDir, 'packages', 'app'), tempDir)
      ).rejects.toThrow(CircularDependencyError)
    })

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
        },
        true
      )

      const graph = await buildDependencyGraph(
        path.join(tempDir, 'packages', 'standalone'),
        tempDir
      )

      expect(graph.nodes.size).toBe(1)
      expect(graph.root.inRepoDependencies).toHaveLength(0)
    })

    it('should include root package even if not in workspace discovery', async () => {
      // Root package not in workspaces pattern
      await createPackage('.', {
        name: 'root',
        version: '1.0.0',
        workspaces: ['packages/*'],
      })
      await createPackage(
        'standalone-package',
        {
          name: 'standalone',
          version: '1.0.0',
        },
        true
      )

      const graph = await buildDependencyGraph(
        path.join(tempDir, 'standalone-package'),
        tempDir
      )

      expect(graph.root.package.packageJson.name).toBe('standalone')
      expect(graph.nodes.has('standalone')).toBe(true)
    })
  })
})
