import { describe, it, expect } from 'vitest'
import {
  PackageJsonSchema,
  BundleOptionsSchema,
  MonocrateError,
  PackageJsonError,
  CircularDependencyError,
  VersionConflictError,
  FileSystemError,
  COMMON_WORKSPACE_PATTERNS,
} from './types.js'

describe('types', () => {
  describe('PackageJsonSchema', () => {
    it('should validate a minimal package.json', () => {
      const minimal = {
        name: 'test-package',
        version: '1.0.0',
      }

      const result = PackageJsonSchema.safeParse(minimal)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('test-package')
        expect(result.data.version).toBe('1.0.0')
      }
    })

    it('should validate a full package.json', () => {
      const full = {
        name: '@myorg/my-package',
        version: '2.3.4',
        description: 'A test package',
        main: 'dist/index.js',
        module: 'dist/index.mjs',
        types: 'dist/index.d.ts',
        type: 'module',
        exports: {
          '.': {
            types: './dist/index.d.ts',
            import: './dist/index.js',
          },
        },
        files: ['dist'],
        bin: { mycli: './dist/cli.js' },
        scripts: { build: 'tsc', test: 'vitest' },
        dependencies: { lodash: '^4.17.0' },
        devDependencies: { typescript: '^5.0.0' },
        peerDependencies: { react: '^18.0.0' },
        optionalDependencies: { fsevents: '^2.0.0' },
        engines: { node: '>=18.0.0' },
        repository: { type: 'git', url: 'https://github.com/test/test.git' },
        keywords: ['test', 'package'],
        author: { name: 'Test Author', email: 'test@test.com' },
        license: 'MIT',
        bugs: { url: 'https://github.com/test/test/issues' },
        homepage: 'https://github.com/test/test#readme',
        private: false,
        workspaces: ['packages/*'],
        publishConfig: { access: 'public' },
      }

      const result = PackageJsonSchema.safeParse(full)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('@myorg/my-package')
        expect(result.data.dependencies).toEqual({ lodash: '^4.17.0' })
      }
    })

    it('should accept workspaces as object format', () => {
      const pkg = {
        name: 'root',
        version: '1.0.0',
        workspaces: { packages: ['packages/*', 'libs/*'] },
      }

      const result = PackageJsonSchema.safeParse(pkg)
      expect(result.success).toBe(true)
    })

    it('should accept author as string', () => {
      const pkg = {
        name: 'test',
        version: '1.0.0',
        author: 'Test Author <test@test.com>',
      }

      const result = PackageJsonSchema.safeParse(pkg)
      expect(result.success).toBe(true)
    })

    it('should accept repository as string', () => {
      const pkg = {
        name: 'test',
        version: '1.0.0',
        repository: 'github:user/repo',
      }

      const result = PackageJsonSchema.safeParse(pkg)
      expect(result.success).toBe(true)
    })

    it('should accept bin as string', () => {
      const pkg = {
        name: 'test',
        version: '1.0.0',
        bin: './dist/cli.js',
      }

      const result = PackageJsonSchema.safeParse(pkg)
      expect(result.success).toBe(true)
    })

    it('should reject invalid package.json (missing name)', () => {
      const invalid = {
        version: '1.0.0',
      }

      const result = PackageJsonSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should reject invalid package.json (missing version)', () => {
      const invalid = {
        name: 'test',
      }

      const result = PackageJsonSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should reject invalid type field', () => {
      const invalid = {
        name: 'test',
        version: '1.0.0',
        type: 'invalid',
      }

      const result = PackageJsonSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('BundleOptionsSchema', () => {
    it('should validate minimal options with defaults', () => {
      const options = {
        packagePath: '/path/to/package',
        monorepoRoot: '/path/to/monorepo',
        outputDir: '/tmp/output',
      }

      const result = BundleOptionsSchema.safeParse(options)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.includeSourceMaps).toBe(true)
        expect(result.data.includeDeclarations).toBe(true)
        expect(result.data.versionConflictStrategy).toBe('warn')
        expect(result.data.cleanOutputDir).toBe(true)
        expect(result.data.distDirName).toBe('dist')
      }
    })

    it('should validate full options', () => {
      const options = {
        packagePath: '/path/to/package',
        monorepoRoot: '/path/to/monorepo',
        outputDir: '/tmp/output',
        includeSourceMaps: false,
        includeDeclarations: false,
        versionConflictStrategy: 'error' as const,
        cleanOutputDir: false,
        distDirName: 'build',
      }

      const result = BundleOptionsSchema.safeParse(options)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.includeSourceMaps).toBe(false)
        expect(result.data.versionConflictStrategy).toBe('error')
      }
    })

    it('should reject invalid versionConflictStrategy', () => {
      const options = {
        packagePath: '/path/to/package',
        monorepoRoot: '/path/to/monorepo',
        outputDir: '/tmp/output',
        versionConflictStrategy: 'invalid',
      }

      const result = BundleOptionsSchema.safeParse(options)
      expect(result.success).toBe(false)
    })

    it('should reject missing required fields', () => {
      const options = {
        packagePath: '/path/to/package',
      }

      const result = BundleOptionsSchema.safeParse(options)
      expect(result.success).toBe(false)
    })
  })

  describe('Error classes', () => {
    describe('MonocrateError', () => {
      it('should create error with message only', () => {
        const error = new MonocrateError('Test error')
        expect(error.message).toBe('Test error')
        expect(error.name).toBe('MonocrateError')
        expect(error.details).toBeUndefined()
        expect(error.cause).toBeUndefined()
      })

      it('should create error with details', () => {
        const error = new MonocrateError('Test error', 'Some details')
        expect(error.message).toBe('Test error')
        expect(error.details).toBe('Some details')
      })

      it('should create error with cause', () => {
        const cause = new Error('Original error')
        const error = new MonocrateError('Wrapped error', 'Details', cause)
        expect(error.cause).toBe(cause)
      })
    })

    describe('PackageJsonError', () => {
      it('should include packagePath', () => {
        const error = new PackageJsonError(
          'Package.json not found',
          '/path/to/package'
        )
        expect(error.name).toBe('PackageJsonError')
        expect(error.packagePath).toBe('/path/to/package')
      })
    })

    describe('CircularDependencyError', () => {
      it('should include cycle information', () => {
        const cycle = ['pkg-a', 'pkg-b', 'pkg-a']
        const error = new CircularDependencyError(
          'Circular dependency detected',
          cycle,
          'Details about the cycle'
        )
        expect(error.name).toBe('CircularDependencyError')
        expect(error.cycle).toEqual(cycle)
      })
    })

    describe('VersionConflictError', () => {
      it('should include conflicts information', () => {
        const conflicts = [
          {
            dependencyName: 'lodash',
            versions: new Map([
              ['pkg-a', '^4.17.0'],
              ['pkg-b', '^4.18.0'],
            ]),
            resolvedVersion: '^4.18.0',
          },
        ]
        const error = new VersionConflictError(
          'Version conflict',
          conflicts,
          'Details'
        )
        expect(error.name).toBe('VersionConflictError')
        expect(error.conflicts).toEqual(conflicts)
      })
    })

    describe('FileSystemError', () => {
      it('should include path information', () => {
        const error = new FileSystemError(
          'File not found',
          '/path/to/file',
          'Details',
          new Error('ENOENT')
        )
        expect(error.name).toBe('FileSystemError')
        expect(error.path).toBe('/path/to/file')
      })
    })
  })

  describe('COMMON_WORKSPACE_PATTERNS', () => {
    it('should contain expected patterns', () => {
      expect(COMMON_WORKSPACE_PATTERNS).toContain('packages/*')
      expect(COMMON_WORKSPACE_PATTERNS).toContain('libs/*')
      expect(COMMON_WORKSPACE_PATTERNS).toContain('apps/*')
    })
  })
})
