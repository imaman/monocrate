import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  green,
  red,
  yellow,
  blue,
  cyan,
  magenta,
  gray,
  white,
  bold,
  dim,
  success,
  error,
  warning,
  info,
  bullet,
  arrow,
  Spinner,
  formatTable,
  drawBox,
  formatError,
  formatHelp,
  formatBundleSummary,
} from '../output.js'

describe('Output Utilities', () => {
  // Store original environment
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv }
    // Remove color-related env vars for consistent testing
    delete process.env.NO_COLOR
    delete process.env.FORCE_COLOR
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('Color Functions (with NO_COLOR)', () => {
    beforeEach(() => {
      process.env.NO_COLOR = '1'
    })

    it('should return plain text when NO_COLOR is set', () => {
      expect(green('test')).toBe('test')
      expect(red('test')).toBe('test')
      expect(yellow('test')).toBe('test')
      expect(blue('test')).toBe('test')
      expect(cyan('test')).toBe('test')
      expect(magenta('test')).toBe('test')
      expect(gray('test')).toBe('test')
      expect(white('test')).toBe('test')
      expect(bold('test')).toBe('test')
      expect(dim('test')).toBe('test')
    })
  })

  describe('Color Functions (with FORCE_COLOR)', () => {
    beforeEach(() => {
      process.env.FORCE_COLOR = '1'
    })

    it('should include ANSI codes when FORCE_COLOR is set', () => {
      expect(green('test')).toContain('\x1b[32m')
      expect(green('test')).toContain('\x1b[0m')
      expect(red('test')).toContain('\x1b[31m')
      expect(yellow('test')).toContain('\x1b[33m')
      expect(blue('test')).toContain('\x1b[34m')
      expect(cyan('test')).toContain('\x1b[36m')
      expect(bold('test')).toContain('\x1b[1m')
    })
  })

  describe('Message Functions', () => {
    beforeEach(() => {
      process.env.NO_COLOR = '1'
    })

    it('success should include checkmark', () => {
      const result = success('Operation complete')
      expect(result).toContain('\u2713')
      expect(result).toContain('Operation complete')
    })

    it('error should include x mark and Error prefix', () => {
      const result = error('Something failed')
      expect(result).toContain('\u2717')
      expect(result).toContain('Error:')
      expect(result).toContain('Something failed')
    })

    it('warning should include warning symbol', () => {
      const result = warning('Be careful')
      expect(result).toContain('\u26A0')
      expect(result).toContain('Warning:')
      expect(result).toContain('Be careful')
    })

    it('info should include info symbol', () => {
      const result = info('For your information')
      expect(result).toContain('\u2139')
      expect(result).toContain('For your information')
    })

    it('bullet should include bullet point', () => {
      const result = bullet('List item')
      expect(result).toContain('\u2022')
      expect(result).toContain('List item')
    })

    it('arrow should include arrow symbol', () => {
      const result = arrow('Next step')
      expect(result).toContain('\u2192')
      expect(result).toContain('Next step')
    })
  })

  describe('Spinner', () => {
    /**
     * Creates a mock write stream that collects all written data
     */
    function createMockStream(): { stream: NodeJS.WriteStream; getOutput: () => string } {
      const chunks: string[] = []
      const writeFn = vi.fn((data: string) => {
        chunks.push(data)
        return true
      })
      const stream = {
        isTTY: false,
        write: writeFn,
      } as unknown as NodeJS.WriteStream
      return {
        stream,
        getOutput: () => chunks.join(''),
      }
    }

    it('should create a spinner with message', () => {
      const { stream, getOutput } = createMockStream()

      const spinner = new Spinner('Loading...', stream)
      spinner.start()
      spinner.stop()

      expect(getOutput()).toContain('Loading...')
    })

    it('should succeed with message', () => {
      const { stream, getOutput } = createMockStream()

      const spinner = new Spinner('Working...', stream)
      spinner.start()
      spinner.succeed('Done!')

      const output = getOutput()
      expect(output).toContain('Done!')
      expect(output).toContain('\u2713')
    })

    it('should fail with message', () => {
      const { stream, getOutput } = createMockStream()

      const spinner = new Spinner('Working...', stream)
      spinner.start()
      spinner.fail('Failed!')

      const output = getOutput()
      expect(output).toContain('Failed!')
      expect(output).toContain('\u2717')
    })

    it('should warn with message', () => {
      const { stream, getOutput } = createMockStream()

      const spinner = new Spinner('Working...', stream)
      spinner.start()
      spinner.warn('Warning!')

      const output = getOutput()
      expect(output).toContain('Warning!')
      expect(output).toContain('\u26A0')
    })

    it('should update message', () => {
      const { stream, getOutput } = createMockStream()

      const spinner = new Spinner('First message', stream)
      spinner.start()
      spinner.update('Second message')

      expect(getOutput()).toContain('Second message')
    })

    it('should use default message on succeed without argument', () => {
      const { stream, getOutput } = createMockStream()

      const spinner = new Spinner('Original message', stream)
      spinner.start()
      spinner.succeed()

      expect(getOutput()).toContain('Original message')
    })
  })

  describe('formatTable', () => {
    beforeEach(() => {
      process.env.NO_COLOR = '1'
    })

    it('should format a simple table', () => {
      const table = formatTable([
        ['lodash', '^4.17.21'],
        ['axios', '^1.0.0'],
      ])

      expect(table).toContain('lodash')
      expect(table).toContain('^4.17.21')
      expect(table).toContain('axios')
      expect(table).toContain('^1.0.0')
    })

    it('should format table with headers', () => {
      const table = formatTable(
        [
          ['lodash', '^4.17.21'],
          ['axios', '^1.0.0'],
        ],
        { headers: ['Package', 'Version'] }
      )

      expect(table).toContain('Package')
      expect(table).toContain('Version')
      expect(table).toContain('lodash')
    })

    it('should return empty string for empty table without headers', () => {
      const table = formatTable([])
      expect(table).toBe('')
    })

    it('should handle table with just headers', () => {
      const table = formatTable([], { headers: ['Name', 'Value'] })
      expect(table).toContain('Name')
      expect(table).toContain('Value')
    })

    it('should handle uneven rows', () => {
      const table = formatTable([
        ['short'],
        ['longer value', 'second'],
        ['a', 'b', 'c'],
      ])

      expect(table).toContain('short')
      expect(table).toContain('longer value')
    })

    it('should support borders option', () => {
      const table = formatTable(
        [['value1', 'value2']],
        { borders: true }
      )

      expect(table).toContain('\u250C') // top-left corner
      expect(table).toContain('\u2510') // top-right corner
      expect(table).toContain('\u2514') // bottom-left corner
      expect(table).toContain('\u2518') // bottom-right corner
    })
  })

  describe('drawBox', () => {
    beforeEach(() => {
      process.env.NO_COLOR = '1'
    })

    it('should draw a box around content', () => {
      const box = drawBox('Hello World')

      expect(box).toContain('\u250C') // top-left corner
      expect(box).toContain('\u2510') // top-right corner
      expect(box).toContain('\u2514') // bottom-left corner
      expect(box).toContain('\u2518') // bottom-right corner
      expect(box).toContain('Hello World')
    })

    it('should support title option', () => {
      const box = drawBox('Content', { title: 'Title' })

      expect(box).toContain('Title')
      expect(box).toContain('Content')
    })

    it('should handle multiline content', () => {
      const box = drawBox('Line 1\nLine 2\nLine 3')

      expect(box).toContain('Line 1')
      expect(box).toContain('Line 2')
      expect(box).toContain('Line 3')
    })

    it('should apply border color', () => {
      process.env.FORCE_COLOR = '1'
      delete process.env.NO_COLOR

      const box = drawBox('Content', { borderColor: green })

      expect(box).toContain('\x1b[32m')
    })
  })

  describe('formatError', () => {
    beforeEach(() => {
      process.env.NO_COLOR = '1'
    })

    it('should format error with title', () => {
      const formatted = formatError('Something went wrong')

      expect(formatted).toContain('Error:')
      expect(formatted).toContain('Something went wrong')
    })

    it('should include details when provided', () => {
      const formatted = formatError(
        'File not found',
        'Check that the file exists and you have read permissions.'
      )

      expect(formatted).toContain('File not found')
      expect(formatted).toContain('Check that the file exists')
    })

    it('should include context when provided', () => {
      const formatted = formatError('Package not found', undefined, {
        'Searched in': '/path/to/packages',
      })

      expect(formatted).toContain('Package not found')
      expect(formatted).toContain('Searched in:')
      expect(formatted).toContain('/path/to/packages')
    })

    it('should handle array context values', () => {
      const formatted = formatError('Package not found', undefined, {
        'Available packages': ['pkg-a', 'pkg-b', 'pkg-c'],
      })

      expect(formatted).toContain('Available packages:')
      expect(formatted).toContain('pkg-a')
      expect(formatted).toContain('pkg-b')
      expect(formatted).toContain('pkg-c')
    })

    it('should handle multiline details', () => {
      const formatted = formatError(
        'Build failed',
        'Line 1\nLine 2\nLine 3'
      )

      expect(formatted).toContain('Line 1')
      expect(formatted).toContain('Line 2')
      expect(formatted).toContain('Line 3')
    })
  })

  describe('formatHelp', () => {
    beforeEach(() => {
      process.env.NO_COLOR = '1'
    })

    it('should format basic help text', () => {
      const help = formatHelp(
        'mycommand [options]',
        'A helpful command',
        [],
        []
      )

      expect(help).toContain('Usage:')
      expect(help).toContain('mycommand [options]')
      expect(help).toContain('A helpful command')
    })

    it('should include options section', () => {
      const help = formatHelp(
        'cmd',
        'Description',
        [
          {
            title: 'Options',
            items: [
              { name: '--help', alias: '-h', description: 'Show help' },
              { name: '--verbose', description: 'Verbose output' },
            ],
          },
        ],
        []
      )

      expect(help).toContain('Options:')
      expect(help).toContain('--help')
      expect(help).toContain('-h')
      expect(help).toContain('Show help')
      expect(help).toContain('--verbose')
      expect(help).toContain('Verbose output')
    })

    it('should include examples section', () => {
      const help = formatHelp(
        'cmd',
        'Description',
        [],
        ['cmd --help', 'cmd --verbose']
      )

      expect(help).toContain('Examples:')
      expect(help).toContain('cmd --help')
      expect(help).toContain('cmd --verbose')
    })

    it('should include multiple sections', () => {
      const help = formatHelp(
        'cmd [args]',
        'Description',
        [
          {
            title: 'Arguments',
            items: [{ name: 'path', description: 'Path to file' }],
          },
          {
            title: 'Options',
            items: [{ name: '--help', description: 'Show help' }],
          },
        ],
        ['cmd file.txt']
      )

      expect(help).toContain('Arguments:')
      expect(help).toContain('path')
      expect(help).toContain('Options:')
      expect(help).toContain('--help')
      expect(help).toContain('Examples:')
    })
  })

  describe('formatBundleSummary', () => {
    beforeEach(() => {
      process.env.NO_COLOR = '1'
    })

    it('should format bundle summary', () => {
      const summary = formatBundleSummary(
        '/output/path',
        'my-package',
        '1.0.0',
        ['pkg-a', 'pkg-b', 'my-package'],
        5
      )

      expect(summary).toContain('my-package')
      expect(summary).toContain('1.0.0')
      expect(summary).toContain('/output/path')
      expect(summary).toContain('3 in-repo packages bundled')
      expect(summary).toContain('5 third-party dependencies')
      expect(summary).toContain('Bundle Complete')
    })

    it('should use singular for single package', () => {
      const summary = formatBundleSummary(
        '/output',
        'pkg',
        '1.0.0',
        ['pkg'],
        1
      )

      expect(summary).toContain('1 in-repo package bundled')
      expect(summary).toContain('1 third-party dependency')
    })

    it('should handle zero dependencies', () => {
      const summary = formatBundleSummary(
        '/output',
        'pkg',
        '1.0.0',
        ['pkg'],
        0
      )

      expect(summary).toContain('0 third-party dependencies')
    })
  })
})
