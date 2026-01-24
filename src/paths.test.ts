import { describe, it, expect } from 'vitest'
import { AbsolutePath, RelativePath } from './paths.js'

const { contains } = AbsolutePath

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
      it('joins an AbsolutePath with a RelativePath', () => {
        expect(AbsolutePath.join(AbsolutePath('/home/user/project'), RelativePath('packages/utils'))).toBe(
          '/home/user/project/packages/utils'
        )
      })

      it('normalizes the result', () => {
        expect(AbsolutePath.join(AbsolutePath('/home/user/project'), RelativePath('packages/../other'))).toBe(
          '/home/user/project/other'
        )
      })

      it('joins with additional path segments', () => {
        expect(AbsolutePath.join(AbsolutePath('/home/user'), RelativePath('project'), 'src', 'index.ts')).toBe(
          '/home/user/project/src/index.ts'
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

    describe('contains', () => {
      it('checks if parent contains child', () => {
        const parent = AbsolutePath('/home/user/project')

        expect(contains(parent, AbsolutePath('/home/user/project/packages'))).toBe(true)
        expect(contains(parent, AbsolutePath('/home/user/project/packages/app/src'))).toBe(true)
        expect(contains(parent, AbsolutePath('/home/user/project'))).toBe(true)
        expect(contains(parent, AbsolutePath('/home/user/project/a/..'))).toBe(true)

        expect(contains(parent, AbsolutePath('/home/user/other'))).toBe(false)
        expect(contains(parent, AbsolutePath('/home/user/sibling'))).toBe(false)
        expect(contains(parent, AbsolutePath('/home/user'))).toBe(false)
        expect(contains(parent, AbsolutePath('/home/user/project-other'))).toBe(false)

        // Path traversal that stays inside parent
        expect(contains(parent, AbsolutePath('/home/user/project/a/b/../c'))).toBe(true)

        // Path that traverses up, escapes, but comes back into parent
        expect(contains(parent, AbsolutePath('/home/user/project/a/../../project/b'))).toBe(true)

        // Path that traverses up and escapes the parent
        expect(contains(parent, AbsolutePath('/home/user/project/a/b/../../../../other'))).toBe(false)

        // Trailing slashes and double slashes are normalized
        expect(contains(AbsolutePath('/home/user/project/'), AbsolutePath('/home/user/project/packages'))).toBe(true)
        expect(contains(AbsolutePath('/home//user//project'), AbsolutePath('/home/user/project/packages'))).toBe(true)
      })
    })
  })

  describe('RelativePath', () => {
    describe('creation', () => {
      it('creates a RelativePath from a relative path', () => {
        expect(RelativePath('packages/utils')).toBe('packages/utils')
      })

      it('normalizes the input path', () => {
        expect(RelativePath('packages/../packages/utils/./src')).toBe('packages/utils/src')
      })

      it('throws when given an absolute path', () => {
        expect(() => RelativePath('/absolute/path')).toThrow('Expected relative path')
      })

      it('accepts empty string as current directory', () => {
        expect(RelativePath('')).toBe('.')
      })

      it('normalizes dot to dot', () => {
        expect(RelativePath('.')).toBe('.')
      })
    })

    describe('join', () => {
      it('joins two RelativePath values', () => {
        expect(RelativePath.join(RelativePath('packages/utils'), RelativePath('src/index.ts'))).toBe(
          'packages/utils/src/index.ts'
        )
      })

      it('normalizes the result', () => {
        expect(RelativePath.join(RelativePath('packages/utils'), RelativePath('../other/src'))).toBe(
          'packages/other/src'
        )
      })

      it('joins multiple path segments', () => {
        expect(RelativePath.join(RelativePath('packages'), 'utils', 'src', 'index.ts')).toBe(
          'packages/utils/src/index.ts'
        )
      })

      it('throws when any segment is an absolute path', () => {
        expect(() => RelativePath.join(RelativePath('packages'), '/absolute/path')).toThrow(
          'Cannot join absolute path /absolute/path to RelativePath'
        )
      })

      it('throws when a later segment is an absolute path', () => {
        expect(() => RelativePath.join(RelativePath('packages'), 'utils', '/etc/passwd')).toThrow(
          'Cannot join absolute path /etc/passwd to RelativePath'
        )
      })
    })

    describe('dirname', () => {
      it('returns the parent directory', () => {
        expect(RelativePath.dirname(RelativePath('packages/utils/src/index.ts'))).toBe('packages/utils/src')
      })

      it('returns dot for single segment path', () => {
        expect(RelativePath.dirname(RelativePath('packages'))).toBe('.')
      })
    })
  })
})
