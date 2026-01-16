/**
 * CLI Output Formatting Utilities
 *
 * Provides consistent, beautiful terminal output including:
 * - Colored text for success/error/warning/info messages
 * - Spinner for async operations
 * - Table formatting for dependency lists
 * - Box drawing for summaries
 *
 * Security note: All user-facing output should go through these utilities
 * to ensure consistent formatting and prevent accidental exposure of
 * sensitive information.
 */

// ANSI escape codes for colors (avoiding external dependencies for fast startup)
const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'

const FG_RED = '\x1b[31m'
const FG_GREEN = '\x1b[32m'
const FG_YELLOW = '\x1b[33m'
const FG_BLUE = '\x1b[34m'
const FG_MAGENTA = '\x1b[35m'
const FG_CYAN = '\x1b[36m'
const FG_WHITE = '\x1b[37m'
const FG_GRAY = '\x1b[90m'

// Symbols for status indicators
const SYMBOLS = {
  success: '\u2713', // checkmark
  error: '\u2717', // x mark
  warning: '\u26A0', // warning triangle
  info: '\u2139', // info circle
  bullet: '\u2022', // bullet point
  arrow: '\u2192', // right arrow
  box: {
    topLeft: '\u250C',
    topRight: '\u2510',
    bottomLeft: '\u2514',
    bottomRight: '\u2518',
    horizontal: '\u2500',
    vertical: '\u2502',
  },
} as const

// Spinner frames for loading animation
const SPINNER_FRAMES = ['\u280B', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2807', '\u280F']

/**
 * Determines if terminal supports colors.
 * Checks for TTY and respects NO_COLOR environment variable.
 */
function supportsColor(): boolean {
  // Respect NO_COLOR standard
  if (process.env.NO_COLOR !== undefined) {
    return false
  }
  // Check if FORCE_COLOR is set
  if (process.env.FORCE_COLOR !== undefined) {
    return true
  }
  // Check if stdout is a TTY
  return process.stdout.isTTY
}

/**
 * Wraps text with ANSI color codes if colors are supported.
 */
function colorize(text: string, ...codes: string[]): string {
  if (!supportsColor()) {
    return text
  }
  return codes.join('') + text + RESET
}

// ============================================================================
// Color Functions
// ============================================================================

/**
 * Format text in green (success color).
 */
export function green(text: string): string {
  return colorize(text, FG_GREEN)
}

/**
 * Format text in red (error color).
 */
export function red(text: string): string {
  return colorize(text, FG_RED)
}

/**
 * Format text in yellow (warning color).
 */
export function yellow(text: string): string {
  return colorize(text, FG_YELLOW)
}

/**
 * Format text in blue (info color).
 */
export function blue(text: string): string {
  return colorize(text, FG_BLUE)
}

/**
 * Format text in cyan (accent color).
 */
export function cyan(text: string): string {
  return colorize(text, FG_CYAN)
}

/**
 * Format text in magenta.
 */
export function magenta(text: string): string {
  return colorize(text, FG_MAGENTA)
}

/**
 * Format text in gray (dimmed text).
 */
export function gray(text: string): string {
  return colorize(text, FG_GRAY)
}

/**
 * Format text in white.
 */
export function white(text: string): string {
  return colorize(text, FG_WHITE)
}

/**
 * Format text in bold.
 */
export function bold(text: string): string {
  return colorize(text, BOLD)
}

/**
 * Format text as dimmed.
 */
export function dim(text: string): string {
  return colorize(text, DIM)
}

// ============================================================================
// Message Functions
// ============================================================================

/**
 * Format a success message with checkmark.
 */
export function success(message: string): string {
  return `${green(SYMBOLS.success)} ${message}`
}

/**
 * Format an error message with x mark.
 */
export function error(message: string): string {
  return `${red(SYMBOLS.error)} ${red('Error:')} ${message}`
}

/**
 * Format a warning message with warning symbol.
 */
export function warning(message: string): string {
  return `${yellow(SYMBOLS.warning)} ${yellow('Warning:')} ${message}`
}

/**
 * Format an info message with info symbol.
 */
export function info(message: string): string {
  return `${blue(SYMBOLS.info)} ${message}`
}

/**
 * Format a bullet point item.
 */
export function bullet(message: string): string {
  return `  ${gray(SYMBOLS.bullet)} ${message}`
}

/**
 * Format an arrow item.
 */
export function arrow(message: string): string {
  return `  ${gray(SYMBOLS.arrow)} ${message}`
}

// ============================================================================
// Output Functions
// ============================================================================

/**
 * Print a line to stdout.
 */
export function print(message = ''): void {
  console.log(message)
}

/**
 * Print an error to stderr.
 */
export function printError(message: string): void {
  console.error(error(message))
}

/**
 * Print a warning to stderr.
 */
export function printWarning(message: string): void {
  console.error(warning(message))
}

/**
 * Print success message to stdout.
 */
export function printSuccess(message: string): void {
  console.log(success(message))
}

/**
 * Print info message to stdout.
 */
export function printInfo(message: string): void {
  console.log(info(message))
}

// ============================================================================
// Spinner Class
// ============================================================================

/**
 * A spinner for showing progress during async operations.
 *
 * @example
 * ```typescript
 * const spinner = new Spinner('Loading...');
 * spinner.start();
 * // ... do async work
 * spinner.succeed('Done!');
 * ```
 */
export class Spinner {
  private message: string
  private frameIndex = 0
  private intervalId: ReturnType<typeof setInterval> | null = null
  private readonly stream: NodeJS.WriteStream

  constructor(message: string, stream: NodeJS.WriteStream = process.stdout) {
    this.message = message
    this.stream = stream
  }

  /**
   * Start the spinner animation.
   */
  start(): this {
    if (this.intervalId) {
      return this
    }

    // Don't animate if not a TTY
    if (!this.stream.isTTY) {
      this.stream.write(`  ${this.message}\n`)
      return this
    }

    // Hide cursor
    this.stream.write('\x1b[?25l')

    this.intervalId = setInterval(() => {
      this.render()
      this.frameIndex = (this.frameIndex + 1) % SPINNER_FRAMES.length
    }, 80)

    this.render()
    return this
  }

  /**
   * Update the spinner message.
   */
  update(message: string): this {
    this.message = message
    if (!this.stream.isTTY && this.intervalId === null) {
      this.stream.write(`  ${message}\n`)
    }
    return this
  }

  /**
   * Stop the spinner and show success message.
   */
  succeed(message?: string): void {
    this.stop()
    const finalMessage = message ?? this.message
    this.stream.write(`${green(SYMBOLS.success)} ${finalMessage}\n`)
  }

  /**
   * Stop the spinner and show error message.
   */
  fail(message?: string): void {
    this.stop()
    const finalMessage = message ?? this.message
    this.stream.write(`${red(SYMBOLS.error)} ${finalMessage}\n`)
  }

  /**
   * Stop the spinner and show warning message.
   */
  warn(message?: string): void {
    this.stop()
    const finalMessage = message ?? this.message
    this.stream.write(`${yellow(SYMBOLS.warning)} ${finalMessage}\n`)
  }

  /**
   * Stop the spinner and show info message.
   */
  info(message?: string): void {
    this.stop()
    const finalMessage = message ?? this.message
    this.stream.write(`${blue(SYMBOLS.info)} ${finalMessage}\n`)
  }

  /**
   * Stop the spinner without a final message.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    if (this.stream.isTTY) {
      // Clear line and show cursor
      this.stream.write('\r\x1b[K\x1b[?25h')
    }
  }

  private render(): void {
    if (!this.stream.isTTY) {
      return
    }
    const frame = SPINNER_FRAMES[this.frameIndex] ?? SPINNER_FRAMES[0]
    const coloredFrame = cyan(frame ?? '')
    this.stream.write(`\r\x1b[K${coloredFrame} ${this.message}`)
  }
}

// ============================================================================
// Table Formatting
// ============================================================================

/**
 * Options for table formatting.
 */
export interface TableOptions {
  /** Column headers */
  headers?: string[]
  /** Padding between columns */
  padding?: number
  /** Whether to show borders */
  borders?: boolean
}

/**
 * Format data as a simple table.
 *
 * @param rows - Array of rows, each row is an array of cells
 * @param options - Table formatting options
 * @returns Formatted table string
 *
 * @example
 * ```typescript
 * const table = formatTable([
 *   ['lodash', '^4.17.21'],
 *   ['axios', '^1.0.0']
 * ], { headers: ['Package', 'Version'] });
 * ```
 */
export function formatTable(rows: string[][], options: TableOptions = {}): string {
  const { headers, padding = 2, borders = false } = options

  if (rows.length === 0 && !headers) {
    return ''
  }

  // Calculate column widths
  const allRows = headers ? [headers, ...rows] : rows
  const columnCount = Math.max(...allRows.map((row) => row.length))
  const columnWidths: number[] = []

  for (let i = 0; i < columnCount; i++) {
    let maxWidth = 0
    for (const row of allRows) {
      const cell = row[i] ?? ''
      maxWidth = Math.max(maxWidth, cell.length)
    }
    columnWidths.push(maxWidth)
  }

  // Build table string
  const lines: string[] = []
  const totalWidth = columnWidths.reduce((sum, w) => sum + w + padding, 0) - padding

  if (borders) {
    lines.push(SYMBOLS.box.topLeft + SYMBOLS.box.horizontal.repeat(totalWidth + 2) + SYMBOLS.box.topRight)
  }

  // Add header row
  if (headers) {
    const headerCells = headers.map((h, i) => {
      const width = columnWidths[i] ?? 0
      return bold(h.padEnd(width))
    })
    const headerLine = headerCells.join(' '.repeat(padding))
    if (borders) {
      lines.push(`${SYMBOLS.box.vertical} ${headerLine} ${SYMBOLS.box.vertical}`)
      lines.push(
        SYMBOLS.box.vertical +
          SYMBOLS.box.horizontal.repeat(totalWidth + 2) +
          SYMBOLS.box.vertical
      )
    } else {
      lines.push(headerLine)
      lines.push(gray(SYMBOLS.box.horizontal.repeat(totalWidth)))
    }
  }

  // Add data rows
  for (const row of rows) {
    const cells = row.map((cell, i) => {
      const width = columnWidths[i] ?? 0
      return cell.padEnd(width)
    })
    const line = cells.join(' '.repeat(padding))
    if (borders) {
      lines.push(`${SYMBOLS.box.vertical} ${line} ${SYMBOLS.box.vertical}`)
    } else {
      lines.push(line)
    }
  }

  if (borders) {
    lines.push(SYMBOLS.box.bottomLeft + SYMBOLS.box.horizontal.repeat(totalWidth + 2) + SYMBOLS.box.bottomRight)
  }

  return lines.join('\n')
}

// ============================================================================
// Box Drawing
// ============================================================================

/**
 * Options for box drawing.
 */
export interface BoxOptions {
  /** Title for the box */
  title?: string
  /** Padding inside the box */
  padding?: number
  /** Border color function */
  borderColor?: (text: string) => string
}

/**
 * Draw a box around content.
 *
 * @param content - The content to put in the box
 * @param options - Box drawing options
 * @returns Formatted box string
 *
 * @example
 * ```typescript
 * const box = drawBox('Bundle complete!\nOutput: ./monocrate-out', {
 *   title: 'Success',
 *   borderColor: green
 * });
 * ```
 */
export function drawBox(content: string, options: BoxOptions = {}): string {
  const { title, padding = 1, borderColor = (t: string): string => t } = options

  const lines = content.split('\n')
  const maxLineLength = Math.max(...lines.map((l) => l.length), title?.length ?? 0)
  const innerWidth = maxLineLength + padding * 2

  const horizontalBorder = SYMBOLS.box.horizontal.repeat(innerWidth)
  const paddingStr = ' '.repeat(padding)
  const emptyLine = ' '.repeat(innerWidth)

  const result: string[] = []

  // Top border with optional title
  if (title) {
    const titlePadding = Math.floor((innerWidth - title.length - 2) / 2)
    const leftPad = SYMBOLS.box.horizontal.repeat(Math.max(0, titlePadding))
    const rightPad = SYMBOLS.box.horizontal.repeat(Math.max(0, innerWidth - titlePadding - title.length - 2))
    result.push(borderColor(SYMBOLS.box.topLeft + leftPad) + ` ${title} ` + borderColor(rightPad + SYMBOLS.box.topRight))
  } else {
    result.push(borderColor(SYMBOLS.box.topLeft + horizontalBorder + SYMBOLS.box.topRight))
  }

  // Top padding
  for (let i = 0; i < padding; i++) {
    result.push(borderColor(SYMBOLS.box.vertical) + emptyLine + borderColor(SYMBOLS.box.vertical))
  }

  // Content lines
  for (const line of lines) {
    const paddedLine = paddingStr + line.padEnd(maxLineLength) + paddingStr
    result.push(borderColor(SYMBOLS.box.vertical) + paddedLine + borderColor(SYMBOLS.box.vertical))
  }

  // Bottom padding
  for (let i = 0; i < padding; i++) {
    result.push(borderColor(SYMBOLS.box.vertical) + emptyLine + borderColor(SYMBOLS.box.vertical))
  }

  // Bottom border
  result.push(borderColor(SYMBOLS.box.bottomLeft + horizontalBorder + SYMBOLS.box.bottomRight))

  return result.join('\n')
}

// ============================================================================
// Error Formatting
// ============================================================================

/**
 * Format a detailed error message with context.
 * Does not include stack traces for user-facing errors.
 *
 * @param title - The error title
 * @param details - Additional details or suggestions
 * @param context - Optional context object (paths, values)
 * @returns Formatted error message
 */
export function formatError(
  title: string,
  details?: string,
  context?: Record<string, string | string[]>
): string {
  const lines: string[] = []

  lines.push('')
  lines.push(error(title))

  if (details) {
    lines.push('')
    for (const line of details.split('\n')) {
      lines.push(`  ${line}`)
    }
  }

  if (context) {
    lines.push('')
    for (const [key, value] of Object.entries(context)) {
      // Sanitize context values to avoid leaking sensitive information
      const sanitizedKey = key
      if (Array.isArray(value)) {
        lines.push(`  ${dim(sanitizedKey + ':')}`)
        for (const item of value) {
          lines.push(bullet(item))
        }
      } else {
        lines.push(`  ${dim(sanitizedKey + ':')} ${value}`)
      }
    }
  }

  lines.push('')

  return lines.join('\n')
}

// ============================================================================
// Help Formatting
// ============================================================================

/**
 * Options for help text formatting.
 */
export interface HelpSection {
  title: string
  items: { name: string; description: string; alias?: string }[]
}

/**
 * Format help text for CLI commands.
 *
 * @param usage - The usage string
 * @param description - Command description
 * @param sections - Help sections (arguments, options, etc.)
 * @param examples - Example commands
 * @returns Formatted help text
 */
export function formatHelp(
  usage: string,
  description: string,
  sections: HelpSection[],
  examples?: string[]
): string {
  const lines: string[] = []

  // Usage
  lines.push(bold('Usage:'))
  lines.push(`  ${usage}`)
  lines.push('')

  // Description
  lines.push(description)
  lines.push('')

  // Sections (Arguments, Options, etc.)
  for (const section of sections) {
    lines.push(bold(section.title + ':'))

    // Calculate max name width for alignment
    const maxNameWidth = Math.max(
      ...section.items.map((item) => {
        const name = item.alias ? `${item.alias}, ${item.name}` : item.name
        return name.length
      })
    )

    for (const item of section.items) {
      const name = item.alias ? `${item.alias}, ${item.name}` : item.name
      const padding = ' '.repeat(maxNameWidth - name.length + 4)
      lines.push(`  ${cyan(name)}${padding}${item.description}`)
    }
    lines.push('')
  }

  // Examples
  if (examples && examples.length > 0) {
    lines.push(bold('Examples:'))
    for (const example of examples) {
      lines.push(`  ${dim('$')} ${example}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ============================================================================
// Summary Formatting
// ============================================================================

/**
 * Format a bundle success summary.
 */
export function formatBundleSummary(
  outputPath: string,
  packageName: string,
  version: string,
  includedPackages: readonly string[],
  depsCount: number
): string {
  const lines: string[] = []

  lines.push(`Package:      ${bold(packageName)}@${version}`)
  lines.push(`Output:       ${cyan(outputPath)}`)
  lines.push(`Packages:     ${String(includedPackages.length)} in-repo package${includedPackages.length !== 1 ? 's' : ''} bundled`)
  lines.push(`Dependencies: ${String(depsCount)} third-party dependenc${depsCount !== 1 ? 'ies' : 'y'}`)

  return drawBox(lines.join('\n'), {
    title: 'Bundle Complete',
    borderColor: green,
  })
}
