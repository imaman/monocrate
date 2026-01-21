import { describe, it, expect } from 'vitest'
import { AbsolutePath, PathInRepo } from './paths.js'

describe('AbsolutePath', () => {
  describe('creation', () => {
    it('creates an AbsolutePath from an absolute path', () => {
      const p = AbsolutePath('/home/user/project')
      expect(p).toBe('/home/user/project')
    })

    it('normalizes the input path', () => {
      const p = AbsolutePath('/home/user/../user/project/./src')
      expect(p).toBe('/home/user/project/src')
    })

    it('throws when given a relative path', () => {
      expect(() => AbsolutePath('relative/path')).toThrow('Expected absolute path')
    })

    it('throws when given an empty string', () => {
      expect(() => AbsolutePath('')).toThrow('Expected absolute path')
    })
  })

  describe('join', () => {
    it('joins an AbsolutePath with a PathInRepo', () => {
      const base = AbsolutePath('/home/user/project')
      const relative = PathInRepo('packages/utils')
      const result = AbsolutePath.join(base, relative)
      expect(result).toBe('/home/user/project/packages/utils')
    })

    it('normalizes the result', () => {
      const base = AbsolutePath('/home/user/project')
      const relative = PathInRepo('packages/../other')
      const result = AbsolutePath.join(base, relative)
      expect(result).toBe('/home/user/project/other')
    })
  })

  describe('dirname', () => {
    it('returns the parent directory', () => {
      const p = AbsolutePath('/home/user/project/file.ts')
      const result = AbsolutePath.dirname(p)
      expect(result).toBe('/home/user/project')
    })

    it('returns root for root path children', () => {
      const p = AbsolutePath('/home')
      const result = AbsolutePath.dirname(p)
      expect(result).toBe('/')
    })
  })
})

describe('PathInRepo', () => {
  describe('creation', () => {
    it('creates a PathInRepo from a relative path', () => {
      const p = PathInRepo('packages/utils')
      expect(p).toBe('packages/utils')
    })

    it('normalizes the input path', () => {
      const p = PathInRepo('packages/../packages/utils/./src')
      expect(p).toBe('packages/utils/src')
    })

    it('throws when given an absolute path', () => {
      expect(() => PathInRepo('/absolute/path')).toThrow('Expected relative path')
    })

    it('accepts empty string as current directory', () => {
      const p = PathInRepo('')
      expect(p).toBe('.')
    })

    it('normalizes dot to dot', () => {
      const p = PathInRepo('.')
      expect(p).toBe('.')
    })
  })

  describe('join', () => {
    it('joins two PathInRepo values', () => {
      const base = PathInRepo('packages/utils')
      const relative = PathInRepo('src/index.ts')
      const result = PathInRepo.join(base, relative)
      expect(result).toBe('packages/utils/src/index.ts')
    })

    it('normalizes the result', () => {
      const base = PathInRepo('packages/utils')
      const relative = PathInRepo('../other/src')
      const result = PathInRepo.join(base, relative)
      expect(result).toBe('packages/other/src')
    })
  })

  describe('dirname', () => {
    it('returns the parent directory', () => {
      const p = PathInRepo('packages/utils/src/index.ts')
      const result = PathInRepo.dirname(p)
      expect(result).toBe('packages/utils/src')
    })

    it('returns dot for single segment path', () => {
      const p = PathInRepo('packages')
      const result = PathInRepo.dirname(p)
      expect(result).toBe('.')
    })
  })
})
