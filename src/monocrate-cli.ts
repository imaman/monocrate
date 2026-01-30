import { createRequire } from 'node:module'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import type { MonocrateOptions } from './monocrate.js'
import { monocrate } from './monocrate.js'

const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { version: string }

interface YargsArgs {
  _: string[]
  'output-dir'?: string
  root?: string
  bump?: string
  report?: string
  'mirror-to'?: string
  'dry-run'?: boolean
}

export function monocrateCli(): void {
  const parser = yargs(hideBin(process.argv))
    .scriptName('monocrate')
    .version(pkg.version)
    .usage(
      `From monorepo to npm in one command.

Point at your packages. That's it.

Usage: $0 <packages...> [options]`
    )
    .example('$0 pkg/foo --bump patch', 'Bump to next patch and publish')
    .example('$0 libs/a libs/b', 'Multi-package (defaults to minor bump)')
    .example('$0 pkg/foo --dry-run', 'Prepare without publishing')
    .positional('packages', {
      describe: 'Package directories to publish',
      type: 'string',
      array: true,
    })
    .options({
      bump: {
        alias: 'b',
        type: 'string' as const,
        description: 'Version or increment (patch/minor/major)',
      },
      'output-dir': {
        alias: 'o',
        type: 'string' as const,
        description: 'Output directory',
      },
      root: {
        alias: 'r',
        type: 'string' as const,
        description: 'Monorepo root (auto-detected if omitted)',
      },
      report: {
        type: 'string' as const,
        description: 'Write report to file',
      },
      'mirror-to': {
        alias: 'm',
        type: 'string' as const,
        description: 'Mirror source files to directory',
      },
      'dry-run': {
        alias: 'd',
        type: 'boolean' as const,
        description: 'Prepare without publishing',
        default: false,
      },
    })
    .strict()
    .help()
    .option('help', { hidden: true })
    .option('version', { hidden: true })

  void Promise.resolve(parser.parse())
    .then(async (argv) => {
      const args = argv as YargsArgs
      const packages = args._
      if (packages.length === 0) {
        throw new Error('At least one package directory must be specified. Try: monocrate <package-dir>')
      }
      const options: MonocrateOptions = {
        pathToSubjectPackages: packages,
        outputRoot: args['output-dir'],
        monorepoRoot: args.root,
        bump: args.bump,
        publish: !args['dry-run'],
        report: args.report,
        cwd: process.cwd(),
        mirrorTo: args['mirror-to'],
      }
      await monocrate(options)
    })
    .catch((error: unknown) => {
      console.error('Fatal error:', error instanceof Error ? error.stack : error)
      process.exit(1)
    })
}
