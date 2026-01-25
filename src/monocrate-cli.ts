import { createRequire } from 'node:module'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import type { MonocrateOptions } from './monocrate.js'
import { monocrate } from './monocrate.js'

const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { version: string }

const sharedOptions = {
  bump: {
    alias: 'b',
    type: 'string' as const,
    description: 'Version or increment (patch/minor/major)',
  },
  output: {
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
}

interface YargsArgs {
  packages?: string[]
  output?: string
  root?: string
  bump?: string
  report?: string
  'mirror-to'?: string
}

async function runCommand(argv: YargsArgs, publish: boolean): Promise<void> {
  const packages = argv.packages ?? []
  if (packages.length === 0) {
    throw new Error('At least one package directory must be specified')
  }
  const options: MonocrateOptions = {
    pathToSubjectPackages: packages,
    outputRoot: argv.output,
    monorepoRoot: argv.root,
    bump: argv.bump,
    publish,
    report: argv.report,
    cwd: process.cwd(),
    mirrorTo: argv['mirror-to'],
  }
  await monocrate(options)
}

export function monocrateCli(): void {
  const parser = yargs(hideBin(process.argv))
    .scriptName('monocrate')
    .version(pkg.version)
    .usage(
      `From monorepo to npm in one command.

Point at your package. That's it.`
    )
    .example('$0 publish pkg/my-lib', '')
    .example('$0 publish pkg/my-lib --bump patch', '')
    .command(
      'publish <packages...>',
      'Publish to npm',
      (yargs) =>
        yargs.options(sharedOptions).positional('packages', {
          describe: 'Package directories to publish',
          type: 'string',
          array: true,
        }),
      async (argv) => {
        await runCommand(argv, true)
      }
    )
    .command(
      'prepare <packages...>',
      'Same as publish, but stop short of publishing',
      (yargs) =>
        yargs.options(sharedOptions).positional('packages', {
          describe: 'Package directories to prepare',
          type: 'string',
          array: true,
        }),
      async (argv) => {
        await runCommand(argv, false)
      }
    )
    .demandCommand(1, 'Try: monocrate publish <package-dir>')
    .strict()
    .help()
    .version(pkg.version)
    .option('help', { hidden: true })
    .option('version', { hidden: true })

  void Promise.resolve(parser.parse()).catch((error: unknown) => {
    console.error('Fatal error:', error instanceof Error ? error.stack : error)
    process.exit(1)
  })
}
