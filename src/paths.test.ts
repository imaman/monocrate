import { describe, it, expect } from 'vitest'
import { AbsolutePath, PathInRepo } from './paths.js'

describe('paths', () => {
  describe('AbsolutePath', () => {
    describe('creation', () => {
      it('creates an AbsolutePath from an absolute path', () => {
        expect(AbsolutePath('/home/user/project')).toBe('/home/user/project')
      })

      it('normalizes the input path', () => {
        expect(AbsolutePath('/home/user/../user/project/./src')).toBe('/home/user/project/src')
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
        expect(AbsolutePath.join(AbsolutePath('/home/user/project'), PathInRepo('packages/utils'))).toBe(
          '/home/user/project/packages/utils'
        )
      })

      it('normalizes the result', () => {
        expect(AbsolutePath.join(AbsolutePath('/home/user/project'), PathInRepo('packages/../other'))).toBe(
          '/home/user/project/other'
        )
      })
    })

    describe('dirname', () => {
      it('returns the parent directory', () => {
        expect(AbsolutePath.dirname(AbsolutePath('/home/user/project/file.ts'))).toBe('/home/user/project')
      })

      it('returns root for root path children', () => {
        expect(AbsolutePath.dirname(AbsolutePath('/home'))).toBe('/')
      })

      it('converges to root', () => {
        let p = AbsolutePath('/home/user/project/deeply/nested/path')
        let iterations = 0
        while (p !== AbsolutePath.dirname(p)) {
          if (iterations++ > 20) {
            throw new Error('dirname did not converge')
          }
          p = AbsolutePath.dirname(p)
        }
        expect(p).toBe('/')
      })
    })
  })

  describe('PathInRepo', () => {
    describe('creation', () => {
      it('creates a PathInRepo from a relative path', () => {
        expect(PathInRepo('packages/utils')).toBe('packages/utils')
      })

      it('normalizes the input path', () => {
        expect(PathInRepo('packages/../packages/utils/./src')).toBe('packages/utils/src')
      })

      it('throws when given an absolute path', () => {
        expect(() => PathInRepo('/absolute/path')).toThrow('Expected relative path')
      })

      it('accepts empty string as current directory', () => {
        expect(PathInRepo('')).toBe('.')
      })

      it('normalizes dot to dot', () => {
        expect(PathInRepo('.')).toBe('.')
      })
    })

    describe('join', () => {
      it('joins two PathInRepo values', () => {
        expect(PathInRepo.join(PathInRepo('packages/utils'), PathInRepo('src/index.ts'))).toBe(
          'packages/utils/src/index.ts'
        )
      })

      it('normalizes the result', () => {
        expect(PathInRepo.join(PathInRepo('packages/utils'), PathInRepo('../other/src'))).toBe('packages/other/src')
      })
    })

    describe('dirname', () => {
      it('returns the parent directory', () => {
        expect(PathInRepo.dirname(PathInRepo('packages/utils/src/index.ts'))).toBe('packages/utils/src')
      })

      it('returns dot for single segment path', () => {
        expect(PathInRepo.dirname(PathInRepo('packages'))).toBe('.')
      })
    })
  })
})
