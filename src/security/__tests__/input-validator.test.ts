import { describe, it, expect } from 'vitest'
import { ZodError } from 'zod'
import {
  validatePackageName,
  validatePackageJson,
  safeValidatePackageJson,
  PackageJsonSchema,
} from '../input-validator.js'

// Also test the barrel export
import * as securityModule from '../index.js'

describe('input-validator', () => {
  describe('validatePackageName', () => {
    describe('valid package names', () => {
      it('should accept simple lowercase names', () => {
        expect(validatePackageName('my-package')).toEqual({ valid: true })
        expect(validatePackageName('package123')).toEqual({ valid: true })
        expect(validatePackageName('a-b-c')).toEqual({ valid: true })
      })

      it('should accept names with underscores', () => {
        expect(validatePackageName('my_package')).toEqual({ valid: true })
        expect(validatePackageName('pkg_123')).toEqual({ valid: true })
      })

      it('should accept names with periods', () => {
        expect(validatePackageName('my.package')).toEqual({ valid: true })
        expect(validatePackageName('pkg.name.here')).toEqual({ valid: true })
      })

      it('should accept names with mixed valid characters', () => {
        expect(validatePackageName('my-pkg_123.test')).toEqual({ valid: true })
        expect(validatePackageName('a1b2c3')).toEqual({ valid: true })
      })

      it('should accept single character names', () => {
        expect(validatePackageName('a')).toEqual({ valid: true })
        expect(validatePackageName('x')).toEqual({ valid: true })
        expect(validatePackageName('1')).toEqual({ valid: true })
      })

      it('should accept scoped package names', () => {
        expect(validatePackageName('@scope/package')).toEqual({ valid: true })
        expect(validatePackageName('@my-org/my-package')).toEqual({ valid: true })
        expect(validatePackageName('@123/456')).toEqual({ valid: true })
      })

      it('should accept scoped names with all valid characters', () => {
        expect(validatePackageName('@my-scope/pkg_123.test')).toEqual({
          valid: true,
        })
        expect(validatePackageName('@a1/b2')).toEqual({ valid: true })
      })

      it('should warn about Node.js built-in module names but accept them', () => {
        const result = validatePackageName('fs')
        expect(result.valid).toBe(true)
        expect(result.error).toContain('Warning')
        expect(result.error).toContain('built-in')
      })

      it('should accept names at the length limit', () => {
        const maxName = 'a'.repeat(214)
        expect(validatePackageName(maxName)).toEqual({ valid: true })
      })
    })

    describe('invalid package names', () => {
      describe('empty and whitespace', () => {
        it('should reject empty string', () => {
          const result = validatePackageName('')
          expect(result.valid).toBe(false)
          expect(result.error).toContain('empty')
        })

        it('should reject whitespace-only string', () => {
          const result = validatePackageName('   ')
          expect(result.valid).toBe(false)
          expect(result.error).toContain('empty')
        })

        it('should reject names with leading whitespace', () => {
          const result = validatePackageName(' my-package')
          expect(result.valid).toBe(false)
          expect(result.error).toContain('whitespace')
        })

        it('should reject names with trailing whitespace', () => {
          const result = validatePackageName('my-package ')
          expect(result.valid).toBe(false)
          expect(result.error).toContain('whitespace')
        })
      })

      describe('length violations', () => {
        it('should reject names exceeding 214 characters', () => {
          const tooLong = 'a'.repeat(215)
          const result = validatePackageName(tooLong)
          expect(result.valid).toBe(false)
          expect(result.error).toContain('214')
        })
      })

      describe('case violations', () => {
        it('should reject uppercase letters', () => {
          const result = validatePackageName('MyPackage')
          expect(result.valid).toBe(false)
          expect(result.error).toContain('lowercase')
        })

        it('should reject mixed case', () => {
          const result = validatePackageName('my-Package')
          expect(result.valid).toBe(false)
          expect(result.error).toContain('lowercase')
        })

        it('should reject all uppercase', () => {
          const result = validatePackageName('MYPACKAGE')
          expect(result.valid).toBe(false)
          expect(result.error).toContain('lowercase')
        })
      })

      describe('reserved names', () => {
        it('should reject node_modules', () => {
          const result = validatePackageName('node_modules')
          expect(result.valid).toBe(false)
          expect(result.error).toContain('reserved')
        })

        it('should reject favicon.ico', () => {
          const result = validatePackageName('favicon.ico')
          expect(result.valid).toBe(false)
          expect(result.error).toContain('reserved')
        })
      })

      describe('control characters', () => {
        it('should reject null bytes', () => {
          const result = validatePackageName('my\x00package')
          expect(result.valid).toBe(false)
          expect(result.error).toContain('control characters')
        })

        it('should reject newlines', () => {
          const result = validatePackageName('my\npackage')
          expect(result.valid).toBe(false)
          expect(result.error).toContain('control characters')
        })

        it('should reject tabs', () => {
          const result = validatePackageName('my\tpackage')
          expect(result.valid).toBe(false)
          expect(result.error).toContain('control characters')
        })

        it('should reject carriage return', () => {
          const result = validatePackageName('my\rpackage')
          expect(result.valid).toBe(false)
          expect(result.error).toContain('control characters')
        })
      })

      describe('special characters', () => {
        it('should reject tilde', () => {
          const result = validatePackageName('my~package')
          expect(result.valid).toBe(false)
          expect(result.error).toContain('special characters')
        })

        it('should reject single quote', () => {
          const result = validatePackageName("my'package")
          expect(result.valid).toBe(false)
          expect(result.error).toContain('special characters')
        })

        it('should reject exclamation mark', () => {
          const result = validatePackageName('my!package')
          expect(result.valid).toBe(false)
          expect(result.error).toContain('special characters')
        })

        it('should reject parentheses', () => {
          expect(validatePackageName('my(package)').valid).toBe(false)
        })

        it('should reject asterisk', () => {
          const result = validatePackageName('my*package')
          expect(result.valid).toBe(false)
          expect(result.error).toContain('special characters')
        })
      })

      describe('invalid start characters', () => {
        it('should reject names starting with period', () => {
          const result = validatePackageName('.my-package')
          expect(result.valid).toBe(false)
          expect(result.error).toContain('period')
        })

        it('should reject names starting with underscore', () => {
          const result = validatePackageName('_my-package')
          expect(result.valid).toBe(false)
          expect(result.error).toContain('underscore')
        })
      })

      describe('invalid characters', () => {
        it('should reject spaces in names', () => {
          const result = validatePackageName('my package')
          expect(result.valid).toBe(false)
        })

        it('should reject @ in non-scoped names', () => {
          const result = validatePackageName('my@package')
          expect(result.valid).toBe(false)
        })

        it('should reject # symbol', () => {
          const result = validatePackageName('my#package')
          expect(result.valid).toBe(false)
        })

        it('should reject $ symbol', () => {
          const result = validatePackageName('my$package')
          expect(result.valid).toBe(false)
        })

        it('should reject % symbol', () => {
          const result = validatePackageName('my%package')
          expect(result.valid).toBe(false)
        })
      })

      describe('scoped package violations', () => {
        it('should reject scope without package name', () => {
          const result = validatePackageName('@scope/')
          expect(result.valid).toBe(false)
          expect(result.error).toContain('empty')
        })

        it('should reject empty scope', () => {
          const result = validatePackageName('@/package')
          expect(result.valid).toBe(false)
          expect(result.error).toContain('empty')
        })

        it('should reject scope without slash', () => {
          const result = validatePackageName('@scope')
          expect(result.valid).toBe(false)
          expect(result.error).toContain('/')
        })

        it('should reject multiple slashes in scoped name', () => {
          const result = validatePackageName('@scope/pack/age')
          expect(result.valid).toBe(false)
          expect(result.error).toContain('one')
        })

        it('should reject uppercase in scoped names', () => {
          const result = validatePackageName('@Scope/package')
          expect(result.valid).toBe(false)
          expect(result.error).toContain('lowercase')
        })
      })
    })
  })

  describe('PackageJsonSchema', () => {
    it('should be a valid Zod schema', () => {
      expect(PackageJsonSchema).toBeDefined()
      expect(typeof PackageJsonSchema.parse).toBe('function')
    })
  })

  describe('validatePackageJson', () => {
    describe('valid package.json structures', () => {
      it('should accept minimal valid package.json', () => {
        const pkg = validatePackageJson({
          name: 'test-package',
          version: '1.0.0',
        })
        expect(pkg.name).toBe('test-package')
        expect(pkg.version).toBe('1.0.0')
      })

      it('should accept full package.json with all common fields', () => {
        const pkg = validatePackageJson({
          name: '@scope/my-package',
          version: '2.1.0',
          description: 'A test package',
          keywords: ['test', 'package'],
          homepage: 'https://example.com',
          bugs: 'https://github.com/user/repo/issues',
          license: 'MIT',
          author: 'John Doe <john@example.com>',
          files: ['dist'],
          main: 'dist/index.js',
          types: 'dist/index.d.ts',
          scripts: {
            build: 'tsc',
            test: 'vitest',
          },
          dependencies: {
            lodash: '^4.0.0',
          },
          devDependencies: {
            typescript: '^5.0.0',
          },
          engines: {
            node: '>=18.0.0',
          },
        })
        expect(pkg.name).toBe('@scope/my-package')
        expect(pkg.scripts?.build).toBe('tsc')
      })

      it('should accept author as object', () => {
        const pkg = validatePackageJson({
          name: 'test',
          version: '1.0.0',
          author: {
            name: 'John Doe',
            email: 'john@example.com',
            url: 'https://johndoe.com',
          },
        })
        expect(pkg.author).toEqual({
          name: 'John Doe',
          email: 'john@example.com',
          url: 'https://johndoe.com',
        })
      })

      it('should accept repository as string', () => {
        const pkg = validatePackageJson({
          name: 'test',
          version: '1.0.0',
          repository: 'github:user/repo',
        })
        expect(pkg.repository).toBe('github:user/repo')
      })

      it('should accept repository as object', () => {
        const pkg = validatePackageJson({
          name: 'test',
          version: '1.0.0',
          repository: {
            type: 'git',
            url: 'https://github.com/user/repo',
            directory: 'packages/pkg',
          },
        })
        expect((pkg.repository as { url: string }).url).toBe('https://github.com/user/repo')
      })

      it('should accept bugs as object', () => {
        const pkg = validatePackageJson({
          name: 'test',
          version: '1.0.0',
          bugs: {
            url: 'https://github.com/user/repo/issues',
            email: 'bugs@example.com',
          },
        })
        expect((pkg.bugs as { url: string }).url).toBe('https://github.com/user/repo/issues')
      })

      it('should accept semver with prerelease', () => {
        const pkg = validatePackageJson({
          name: 'test',
          version: '1.0.0-beta.1',
        })
        expect(pkg.version).toBe('1.0.0-beta.1')
      })

      it('should accept semver with build metadata', () => {
        const pkg = validatePackageJson({
          name: 'test',
          version: '1.0.0+build.123',
        })
        expect(pkg.version).toBe('1.0.0+build.123')
      })

      it('should accept type field', () => {
        const pkg = validatePackageJson({
          name: 'test',
          version: '1.0.0',
          type: 'module',
        })
        expect(pkg.type).toBe('module')
      })

      it('should accept bin as string', () => {
        const pkg = validatePackageJson({
          name: 'test',
          version: '1.0.0',
          bin: './cli.js',
        })
        expect(pkg.bin).toBe('./cli.js')
      })

      it('should accept bin as object', () => {
        const pkg = validatePackageJson({
          name: 'test',
          version: '1.0.0',
          bin: {
            test: './cli.js',
            'test-dev': './cli-dev.js',
          },
        })
        expect((pkg.bin as Record<string, string>).test).toBe('./cli.js')
      })

      it('should accept workspaces as array', () => {
        const pkg = validatePackageJson({
          name: 'test',
          version: '1.0.0',
          workspaces: ['packages/*'],
        })
        expect(pkg.workspaces).toEqual(['packages/*'])
      })

      it('should accept exports field', () => {
        const pkg = validatePackageJson({
          name: 'test',
          version: '1.0.0',
          exports: {
            '.': {
              types: './dist/index.d.ts',
              import: './dist/index.js',
            },
          },
        })
        expect(pkg.exports).toBeDefined()
      })

      it('should accept private field', () => {
        const pkg = validatePackageJson({
          name: 'test',
          version: '1.0.0',
          private: true,
        })
        expect(pkg.private).toBe(true)
      })

      it('should accept publishConfig', () => {
        const pkg = validatePackageJson({
          name: 'test',
          version: '1.0.0',
          publishConfig: {
            access: 'public',
            registry: 'https://registry.npmjs.org',
          },
        })
        expect(pkg.publishConfig?.access).toBe('public')
      })

      it('should accept peerDependenciesMeta', () => {
        const pkg = validatePackageJson({
          name: 'test',
          version: '1.0.0',
          peerDependencies: {
            react: '^18.0.0',
          },
          peerDependenciesMeta: {
            react: {
              optional: true,
            },
          },
        })
        expect(pkg.peerDependenciesMeta?.react?.optional).toBe(true)
      })

      it('should allow additional custom fields', () => {
        const pkg = validatePackageJson({
          name: 'test',
          version: '1.0.0',
          customField: 'custom value',
          anotherField: { nested: true },
        })
        expect((pkg as Record<string, unknown>).customField).toBe('custom value')
      })
    })

    describe('invalid package.json structures', () => {
      it('should reject missing name', () => {
        expect(() =>
          validatePackageJson({
            version: '1.0.0',
          })
        ).toThrow(ZodError)
      })

      it('should reject missing version', () => {
        expect(() =>
          validatePackageJson({
            name: 'test',
          })
        ).toThrow(ZodError)
      })

      it('should reject invalid package name', () => {
        expect(() =>
          validatePackageJson({
            name: 'Invalid Package',
            version: '1.0.0',
          })
        ).toThrow(ZodError)
      })

      it('should reject invalid version format', () => {
        expect(() =>
          validatePackageJson({
            name: 'test',
            version: 'not-semver',
          })
        ).toThrow(ZodError)
      })

      it('should reject invalid version with only two parts', () => {
        expect(() =>
          validatePackageJson({
            name: 'test',
            version: '1.0',
          })
        ).toThrow(ZodError)
      })

      it('should reject non-object input', () => {
        expect(() => validatePackageJson('not an object')).toThrow(ZodError)
        expect(() => validatePackageJson(null)).toThrow(ZodError)
        expect(() => validatePackageJson(undefined)).toThrow(ZodError)
        expect(() => validatePackageJson(123)).toThrow(ZodError)
      })

      it('should reject array input', () => {
        expect(() => validatePackageJson([])).toThrow(ZodError)
      })

      it('should reject invalid homepage URL', () => {
        expect(() =>
          validatePackageJson({
            name: 'test',
            version: '1.0.0',
            homepage: 'not-a-url',
          })
        ).toThrow(ZodError)
      })

      it('should reject invalid type value', () => {
        expect(() =>
          validatePackageJson({
            name: 'test',
            version: '1.0.0',
            type: 'invalid',
          })
        ).toThrow(ZodError)
      })

      it('should reject invalid publishConfig access', () => {
        expect(() =>
          validatePackageJson({
            name: 'test',
            version: '1.0.0',
            publishConfig: {
              access: 'invalid',
            },
          })
        ).toThrow(ZodError)
      })

      it('should reject non-string dependencies values', () => {
        expect(() =>
          validatePackageJson({
            name: 'test',
            version: '1.0.0',
            dependencies: {
              lodash: 123,
            },
          })
        ).toThrow(ZodError)
      })

      it('should reject non-string scripts values', () => {
        expect(() =>
          validatePackageJson({
            name: 'test',
            version: '1.0.0',
            scripts: {
              build: { cmd: 'tsc' },
            },
          })
        ).toThrow(ZodError)
      })
    })
  })

  describe('safeValidatePackageJson', () => {
    it('should return success for valid input', () => {
      const result = safeValidatePackageJson({
        name: 'test',
        version: '1.0.0',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('test')
      }
    })

    it('should return error for invalid input', () => {
      const result = safeValidatePackageJson({
        name: 'Invalid Name',
        version: '1.0.0',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ZodError)
      }
    })

    it('should not throw for any input', () => {
      expect(() => safeValidatePackageJson(null)).not.toThrow()
      expect(() => safeValidatePackageJson(undefined)).not.toThrow()
      expect(() => safeValidatePackageJson('string')).not.toThrow()
      expect(() => safeValidatePackageJson(123)).not.toThrow()
      expect(() => safeValidatePackageJson({})).not.toThrow()
    })

    it('should provide detailed error information', () => {
      const result = safeValidatePackageJson({
        version: '1.0.0',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const issues = result.error.issues
        expect(issues.length).toBeGreaterThan(0)
        expect(issues.some((i) => i.path.includes('name'))).toBe(true)
      }
    })
  })

  describe('additional package.json fields for coverage', () => {
    it('should accept directories field', () => {
      const pkg = validatePackageJson({
        name: 'test',
        version: '1.0.0',
        directories: {
          lib: 'lib',
          bin: 'bin',
          man: 'man',
          doc: 'doc',
          example: 'example',
          test: 'test',
        },
      })
      expect(pkg.directories?.lib).toBe('lib')
    })

    it('should accept man as array', () => {
      const pkg = validatePackageJson({
        name: 'test',
        version: '1.0.0',
        man: ['./man/foo.1', './man/bar.1'],
      })
      expect(pkg.man).toEqual(['./man/foo.1', './man/bar.1'])
    })

    it('should accept man as string', () => {
      const pkg = validatePackageJson({
        name: 'test',
        version: '1.0.0',
        man: './man/foo.1',
      })
      expect(pkg.man).toBe('./man/foo.1')
    })

    it('should accept browser as object with false values', () => {
      const pkg = validatePackageJson({
        name: 'test',
        version: '1.0.0',
        browser: {
          './lib/server.js': false,
          './lib/client.js': './lib/browser.js',
        },
      })
      expect(pkg.browser).toBeDefined()
    })

    it('should accept exports as string', () => {
      const pkg = validatePackageJson({
        name: 'test',
        version: '1.0.0',
        exports: './index.js',
      })
      expect(pkg.exports).toBe('./index.js')
    })

    it('should accept exports as null', () => {
      const pkg = validatePackageJson({
        name: 'test',
        version: '1.0.0',
        exports: null,
      })
      expect(pkg.exports).toBeNull()
    })

    it('should accept imports field', () => {
      const pkg = validatePackageJson({
        name: 'test',
        version: '1.0.0',
        imports: {
          '#dep': {
            node: 'dep-node-native',
            default: './dep-polyfill.js',
          },
        },
      })
      expect(pkg.imports).toBeDefined()
    })

    it('should accept funding as string', () => {
      const pkg = validatePackageJson({
        name: 'test',
        version: '1.0.0',
        funding: 'https://example.com/sponsor',
      })
      expect(pkg.funding).toBe('https://example.com/sponsor')
    })

    it('should accept funding as object', () => {
      const pkg = validatePackageJson({
        name: 'test',
        version: '1.0.0',
        funding: {
          type: 'individual',
          url: 'https://example.com/donate',
        },
      })
      expect(pkg.funding).toBeDefined()
    })

    it('should accept funding as array', () => {
      const pkg = validatePackageJson({
        name: 'test',
        version: '1.0.0',
        funding: [
          'https://example.com/sponsor',
          { type: 'patreon', url: 'https://patreon.com/user' },
        ],
      })
      expect(Array.isArray(pkg.funding)).toBe(true)
    })

    it('should accept typings field (alias for types)', () => {
      const pkg = validatePackageJson({
        name: 'test',
        version: '1.0.0',
        typings: './dist/index.d.ts',
      })
      expect(pkg.typings).toBe('./dist/index.d.ts')
    })

    it('should accept module field', () => {
      const pkg = validatePackageJson({
        name: 'test',
        version: '1.0.0',
        module: './dist/index.esm.js',
      })
      expect(pkg.module).toBe('./dist/index.esm.js')
    })

    it('should accept contributors as array', () => {
      const pkg = validatePackageJson({
        name: 'test',
        version: '1.0.0',
        contributors: [
          'Jane Doe <jane@example.com>',
          { name: 'Bob Smith', email: 'bob@example.com' },
        ],
      })
      expect(pkg.contributors?.length).toBe(2)
    })

    it('should accept os and cpu arrays', () => {
      const pkg = validatePackageJson({
        name: 'test',
        version: '1.0.0',
        os: ['darwin', 'linux', '!win32'],
        cpu: ['x64', 'arm64'],
      })
      expect(pkg.os).toEqual(['darwin', 'linux', '!win32'])
      expect(pkg.cpu).toEqual(['x64', 'arm64'])
    })

    it('should accept bundleDependencies as array', () => {
      const pkg = validatePackageJson({
        name: 'test',
        version: '1.0.0',
        bundleDependencies: ['pkg1', 'pkg2'],
      })
      expect(pkg.bundleDependencies).toEqual(['pkg1', 'pkg2'])
    })

    it('should accept bundleDependencies as boolean', () => {
      const pkg = validatePackageJson({
        name: 'test',
        version: '1.0.0',
        bundleDependencies: true,
      })
      expect(pkg.bundleDependencies).toBe(true)
    })

    it('should accept bundledDependencies (alternate spelling)', () => {
      const pkg = validatePackageJson({
        name: 'test',
        version: '1.0.0',
        bundledDependencies: ['pkg1'],
      })
      expect(pkg.bundledDependencies).toEqual(['pkg1'])
    })

    it('should accept optionalDependencies', () => {
      const pkg = validatePackageJson({
        name: 'test',
        version: '1.0.0',
        optionalDependencies: {
          fsevents: '^2.0.0',
        },
      })
      expect(pkg.optionalDependencies?.fsevents).toBe('^2.0.0')
    })

    it('should accept overrides field', () => {
      const pkg = validatePackageJson({
        name: 'test',
        version: '1.0.0',
        overrides: {
          foo: '1.0.0',
          bar: {
            '.': '2.0.0',
            baz: '3.0.0',
          },
        },
      })
      expect(pkg.overrides).toBeDefined()
    })

    it('should accept workspaces as object with packages', () => {
      const pkg = validatePackageJson({
        name: 'test',
        version: '1.0.0',
        workspaces: {
          packages: ['packages/*'],
          nohoist: ['**/react'],
        },
      })
      expect(pkg.workspaces).toBeDefined()
    })

    it('should accept publishConfig with tag', () => {
      const pkg = validatePackageJson({
        name: 'test',
        version: '1.0.0',
        publishConfig: {
          access: 'restricted',
          tag: 'next',
        },
      })
      expect(pkg.publishConfig?.tag).toBe('next')
    })

    it('should accept commonjs type', () => {
      const pkg = validatePackageJson({
        name: 'test',
        version: '1.0.0',
        type: 'commonjs',
      })
      expect(pkg.type).toBe('commonjs')
    })
  })

  describe('security module exports', () => {
    it('should export all path validation utilities', () => {
      expect(securityModule.validatePath).toBeDefined()
      expect(securityModule.safeReadFile).toBeDefined()
      expect(securityModule.safeWriteFile).toBeDefined()
      expect(securityModule.SafeFs).toBeDefined()
      expect(securityModule.PathSecurityError).toBeDefined()
    })

    it('should export all input validation utilities', () => {
      expect(securityModule.validatePackageName).toBeDefined()
      expect(securityModule.validatePackageJson).toBeDefined()
      expect(securityModule.safeValidatePackageJson).toBeDefined()
      expect(securityModule.PackageJsonSchema).toBeDefined()
    })

    it('should have working exports', () => {
      // Test that exports actually work
      expect(securityModule.validatePath('/base', 'file.txt')).toBe(true)
      expect(securityModule.validatePackageName('valid-name').valid).toBe(true)
    })
  })
})
