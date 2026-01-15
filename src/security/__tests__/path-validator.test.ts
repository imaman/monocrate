import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import {
  validatePath,
  safeReadFile,
  safeWriteFile,
  SafeFs,
  PathSecurityError,
} from '../path-validator.js'

describe('path-validator', () => {
  let testDir: string

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'monocrate-test-'))

    // Create some test files and directories
    await fs.mkdir(path.join(testDir, 'src'))
    await fs.mkdir(path.join(testDir, 'nested', 'deep'), { recursive: true })
    await fs.writeFile(path.join(testDir, 'test.txt'), 'test content')
    await fs.writeFile(path.join(testDir, 'src', 'index.ts'), 'export const x = 1')
    await fs.writeFile(path.join(testDir, 'nested', 'deep', 'file.txt'), 'deep content')
  })

  afterEach(async () => {
    // Clean up the temporary directory
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('validatePath', () => {
    describe('valid paths', () => {
      it('should accept a simple relative path', () => {
        expect(validatePath(testDir, 'test.txt')).toBe(true)
      })

      it('should accept nested relative paths', () => {
        expect(validatePath(testDir, 'src/index.ts')).toBe(true)
        expect(validatePath(testDir, 'nested/deep/file.txt')).toBe(true)
      })

      it('should accept paths with dots in filenames', () => {
        expect(validatePath(testDir, 'file.name.txt')).toBe(true)
        expect(validatePath(testDir, '.hidden')).toBe(true)
      })

      it('should accept the base path itself', () => {
        expect(validatePath(testDir, '.')).toBe(true)
        expect(validatePath(testDir, '')).toBe(true)
      })

      it('should accept absolute paths within base', () => {
        const absolutePath = path.join(testDir, 'src', 'index.ts')
        expect(validatePath(testDir, absolutePath)).toBe(true)
      })

      it('should handle paths with redundant slashes', () => {
        expect(validatePath(testDir, 'src//index.ts')).toBe(true)
        expect(validatePath(testDir, './src/./index.ts')).toBe(true)
      })
    })

    describe('path traversal attacks', () => {
      it('should reject simple parent directory traversal', () => {
        expect(validatePath(testDir, '../')).toBe(false)
        expect(validatePath(testDir, '..')).toBe(false)
      })

      it('should reject nested parent directory traversal', () => {
        expect(validatePath(testDir, '../../')).toBe(false)
        expect(validatePath(testDir, '../../../etc/passwd')).toBe(false)
      })

      it('should reject traversal in the middle of path', () => {
        expect(validatePath(testDir, 'src/../../../etc/passwd')).toBe(false)
        expect(validatePath(testDir, 'src/../../secret.txt')).toBe(false)
      })

      it('should reject traversal that appears to stay in bounds', () => {
        expect(validatePath(testDir, 'src/../../../' + testDir)).toBe(false)
      })

      it('should reject traversal with valid file extension', () => {
        expect(validatePath(testDir, '../../../etc/passwd.txt')).toBe(false)
      })

      it('should reject deep traversal attacks', () => {
        const deepTraversal = '../'.repeat(20) + 'etc/passwd'
        expect(validatePath(testDir, deepTraversal)).toBe(false)
      })
    })

    describe('encoded traversal attacks', () => {
      it('should reject URL-encoded dot-dot-slash', () => {
        // %2e = . %2f = /
        expect(validatePath(testDir, '%2e%2e%2f')).toBe(false)
        expect(validatePath(testDir, '%2e%2e/')).toBe(false)
        expect(validatePath(testDir, '..%2f')).toBe(false)
      })

      it('should reject double URL-encoded traversal', () => {
        // Double encoding: %252e = %2e (after first decode) = . (after second)
        expect(validatePath(testDir, '%252e%252e%252f')).toBe(false)
      })

      it('should reject mixed encoding', () => {
        expect(validatePath(testDir, '.%2e/')).toBe(false)
        expect(validatePath(testDir, '%2e./')).toBe(false)
      })

      it('should reject uppercase URL-encoded traversal', () => {
        expect(validatePath(testDir, '%2E%2E%2F')).toBe(false)
        expect(validatePath(testDir, '%2E%2E/')).toBe(false)
      })
    })

    describe('null byte injection', () => {
      it('should reject paths with null bytes', () => {
        expect(validatePath(testDir, 'file\x00.txt')).toBe(false)
        expect(validatePath(testDir, 'file\0.txt')).toBe(false)
      })

      it('should reject null bytes at the end', () => {
        expect(validatePath(testDir, 'file.txt\x00')).toBe(false)
      })

      it('should reject null bytes at the start', () => {
        expect(validatePath(testDir, '\x00file.txt')).toBe(false)
      })

      it('should reject null bytes in traversal attempts', () => {
        expect(validatePath(testDir, '../\x00')).toBe(false)
        expect(validatePath(testDir, '..\x00/')).toBe(false)
      })
    })

    describe('Windows-style paths', () => {
      it('should normalize backslashes to forward slashes', () => {
        expect(validatePath(testDir, 'src\\index.ts')).toBe(true)
        expect(validatePath(testDir, 'nested\\deep\\file.txt')).toBe(true)
      })

      it('should reject Windows-style traversal', () => {
        expect(validatePath(testDir, '..\\..\\etc\\passwd')).toBe(false)
        expect(validatePath(testDir, '..\\../')).toBe(false)
        expect(validatePath(testDir, '../..\\')).toBe(false)
      })

      it('should reject mixed slash traversal', () => {
        expect(validatePath(testDir, '..\\../etc/passwd')).toBe(false)
        expect(validatePath(testDir, '../..\\etc\\passwd')).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('should handle empty paths safely', () => {
        expect(validatePath(testDir, '')).toBe(true) // Empty resolves to basePath
      })

      it('should handle whitespace paths', () => {
        expect(validatePath(testDir, '   ')).toBe(true) // Whitespace is technically valid
      })

      it('should prevent prefix attacks', () => {
        // Ensure /home/user doesn't match /home/username
        const basePath = path.join(testDir, 'short')
        const attackPath = path.join(testDir, 'shorter')
        expect(validatePath(basePath, attackPath)).toBe(false)
      })

      it('should handle paths with special characters', () => {
        expect(validatePath(testDir, 'file name.txt')).toBe(true)
        expect(validatePath(testDir, "file'name.txt")).toBe(true)
        expect(validatePath(testDir, 'file"name.txt')).toBe(true)
      })

      it('should handle very long paths', () => {
        const longPath = 'a/'.repeat(100) + 'file.txt'
        expect(validatePath(testDir, longPath)).toBe(true)
      })

      it('should handle unicode in paths', () => {
        expect(validatePath(testDir, 'file-\u00e9.txt')).toBe(true) // e with accent
        expect(validatePath(testDir, '\u4e2d\u6587.txt')).toBe(true) // Chinese characters
      })
    })
  })

  describe('safeReadFile', () => {
    it('should read a valid file', async () => {
      const content = await safeReadFile(testDir, 'test.txt')
      expect(content).toBe('test content')
    })

    it('should read nested files', async () => {
      const content = await safeReadFile(testDir, 'src/index.ts')
      expect(content).toBe('export const x = 1')
    })

    it('should throw PathSecurityError for traversal attempts', async () => {
      await expect(safeReadFile(testDir, '../../../etc/passwd')).rejects.toThrow(PathSecurityError)
    })

    it('should throw PathSecurityError with descriptive message', async () => {
      try {
        await safeReadFile(testDir, '../../../etc/passwd')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(PathSecurityError)
        expect((error as PathSecurityError).message).toContain('traversal')
        expect((error as PathSecurityError).basePath).toBe(testDir)
        expect((error as PathSecurityError).targetPath).toBe('../../../etc/passwd')
      }
    })

    it('should throw for non-existent files', async () => {
      await expect(safeReadFile(testDir, 'nonexistent.txt')).rejects.toThrow()
    })

    it('should throw for null byte injection', async () => {
      await expect(safeReadFile(testDir, 'file\x00.txt')).rejects.toThrow(PathSecurityError)
    })

    it('should throw for URL-encoded traversal', async () => {
      await expect(safeReadFile(testDir, '%2e%2e%2fetc/passwd')).rejects.toThrow(PathSecurityError)
    })
  })

  describe('safeWriteFile', () => {
    it('should write a file within base path', async () => {
      await safeWriteFile(testDir, 'output.txt', 'output content')
      const content = await fs.readFile(path.join(testDir, 'output.txt'), 'utf-8')
      expect(content).toBe('output content')
    })

    it('should create parent directories as needed', async () => {
      await safeWriteFile(testDir, 'new/nested/dir/file.txt', 'nested content')
      const content = await fs.readFile(
        path.join(testDir, 'new', 'nested', 'dir', 'file.txt'),
        'utf-8'
      )
      expect(content).toBe('nested content')
    })

    it('should overwrite existing files', async () => {
      await safeWriteFile(testDir, 'test.txt', 'new content')
      const content = await fs.readFile(path.join(testDir, 'test.txt'), 'utf-8')
      expect(content).toBe('new content')
    })

    it('should throw PathSecurityError for traversal attempts', async () => {
      await expect(safeWriteFile(testDir, '../../../tmp/evil.txt', 'evil')).rejects.toThrow(
        PathSecurityError
      )
    })

    it('should throw for null byte injection', async () => {
      await expect(safeWriteFile(testDir, 'file\x00.txt', 'content')).rejects.toThrow(
        PathSecurityError
      )
    })
  })

  describe('SafeFs', () => {
    let safeFs: SafeFs

    beforeEach(() => {
      safeFs = new SafeFs(testDir)
    })

    describe('constructor', () => {
      it('should create instance with valid path', () => {
        expect(safeFs.basePath).toBe(path.resolve(testDir))
      })

      it('should throw for empty path', () => {
        expect(() => new SafeFs('')).toThrow('Base path cannot be empty')
      })

      it('should throw for whitespace-only path', () => {
        expect(() => new SafeFs('   ')).toThrow('Base path cannot be empty')
      })

      it('should resolve relative base paths', () => {
        const relativeSafeFs = new SafeFs('.')
        expect(relativeSafeFs.basePath).toBe(path.resolve('.'))
      })
    })

    describe('readFile', () => {
      it('should read files within base path', async () => {
        const content = await safeFs.readFile('test.txt')
        expect(content).toBe('test content')
      })

      it('should throw for traversal attempts', async () => {
        await expect(safeFs.readFile('../../../etc/passwd')).rejects.toThrow(PathSecurityError)
      })
    })

    describe('writeFile', () => {
      it('should write files within base path', async () => {
        await safeFs.writeFile('new-file.txt', 'new content')
        const content = await fs.readFile(path.join(testDir, 'new-file.txt'), 'utf-8')
        expect(content).toBe('new content')
      })

      it('should throw for traversal attempts', async () => {
        await expect(safeFs.writeFile('../../../tmp/evil.txt', 'evil')).rejects.toThrow(
          PathSecurityError
        )
      })
    })

    describe('copyDir', () => {
      it('should copy a directory recursively', async () => {
        await safeFs.copyDir('nested', 'nested-copy')

        const exists = await fs
          .access(path.join(testDir, 'nested-copy', 'deep', 'file.txt'))
          .then(() => true)
          .catch(() => false)
        expect(exists).toBe(true)

        const content = await fs.readFile(
          path.join(testDir, 'nested-copy', 'deep', 'file.txt'),
          'utf-8'
        )
        expect(content).toBe('deep content')
      })

      it('should throw for source traversal', async () => {
        await expect(safeFs.copyDir('../../../etc', 'copy')).rejects.toThrow(PathSecurityError)
      })

      it('should throw for destination traversal', async () => {
        await expect(safeFs.copyDir('src', '../../../tmp/copy')).rejects.toThrow(PathSecurityError)
      })

      it('should throw for non-directory source', async () => {
        await expect(safeFs.copyDir('test.txt', 'copy')).rejects.toThrow(
          'Source is not a directory'
        )
      })
    })

    describe('exists', () => {
      it('should return true for existing files', async () => {
        expect(await safeFs.exists('test.txt')).toBe(true)
      })

      it('should return true for existing directories', async () => {
        expect(await safeFs.exists('src')).toBe(true)
      })

      it('should return false for non-existent paths', async () => {
        expect(await safeFs.exists('nonexistent.txt')).toBe(false)
      })

      it('should throw for traversal attempts', async () => {
        await expect(safeFs.exists('../../../etc/passwd')).rejects.toThrow(PathSecurityError)
      })
    })

    describe('mkdir', () => {
      it('should create a directory', async () => {
        await safeFs.mkdir('new-dir')
        const stats = await fs.stat(path.join(testDir, 'new-dir'))
        expect(stats.isDirectory()).toBe(true)
      })

      it('should create nested directories', async () => {
        await safeFs.mkdir('a/b/c')
        const stats = await fs.stat(path.join(testDir, 'a', 'b', 'c'))
        expect(stats.isDirectory()).toBe(true)
      })

      it('should not throw for existing directories', async () => {
        await safeFs.mkdir('src')
        const stats = await fs.stat(path.join(testDir, 'src'))
        expect(stats.isDirectory()).toBe(true)
      })

      it('should throw for traversal attempts', async () => {
        await expect(safeFs.mkdir('../../../tmp/evil')).rejects.toThrow(PathSecurityError)
      })
    })

    describe('symlink handling', () => {
      it('should allow symlinks that stay within base path', async () => {
        // Create a symlink within the test directory
        const linkPath = path.join(testDir, 'link-to-src')
        await fs.symlink(path.join(testDir, 'src'), linkPath)

        // Reading through the symlink should work
        const content = await safeFs.readFile('link-to-src/index.ts')
        expect(content).toBe('export const x = 1')
      })

      it('should handle symlink copy by copying content', async () => {
        // Create a symlink within the test directory
        const linkPath = path.join(testDir, 'link-file')
        await fs.symlink(path.join(testDir, 'test.txt'), linkPath)

        // Create a directory containing the symlink
        await fs.mkdir(path.join(testDir, 'with-link'))
        await fs.symlink(
          path.join(testDir, 'test.txt'),
          path.join(testDir, 'with-link', 'linked-file')
        )

        // Copy the directory
        await safeFs.copyDir('with-link', 'copied-with-link')

        // The copy should have the file content, not a symlink
        const content = await fs.readFile(
          path.join(testDir, 'copied-with-link', 'linked-file'),
          'utf-8'
        )
        expect(content).toBe('test content')

        // Verify it's not a symlink in the copy
        const stats = await fs.lstat(path.join(testDir, 'copied-with-link', 'linked-file'))
        expect(stats.isSymbolicLink()).toBe(false)
      })
    })
  })

  describe('PathSecurityError', () => {
    it('should have correct name', () => {
      const error = new PathSecurityError('test', '/base', '/target')
      expect(error.name).toBe('PathSecurityError')
    })

    it('should preserve basePath and targetPath', () => {
      const error = new PathSecurityError('test', '/base', '/target')
      expect(error.basePath).toBe('/base')
      expect(error.targetPath).toBe('/target')
    })

    it('should be instance of Error', () => {
      const error = new PathSecurityError('test', '/base', '/target')
      expect(error).toBeInstanceOf(Error)
    })
  })
})
