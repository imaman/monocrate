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
    description: 'Output directory for assembled packages',
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
    pathToSubjectPackage: packages,
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
    .usage('$0 <command> [options] <packages...>')
    .command(
      'publish <packages...>',
      'Assemble packages and publish to npm',
      (yargs) =>
        yargs.options(sharedOptions).positional('packages', {
          describe: 'Package directories to assemble',
          type: 'string',
          array: true,
        }),
      async (argv) => {
        await runCommand(argv, true)
      }
    )
    .command(
      'prepare <packages...>',
      'Assemble packages without publishing',
      (yargs) =>
        yargs.options(sharedOptions).positional('packages', {
          describe: 'Package directories to assemble',
          type: 'string',
          array: true,
        }),
      async (argv) => {
        await runCommand(argv, false)
      }
    )
    .demandCommand(1, 'You must specify a command (publish or prepare)')
    .strict()
    .help()

  void Promise.resolve(parser.parse()).catch((error: unknown) => {
    console.error('Fatal error:', error instanceof Error ? error.stack : error)
    process.exit(1)
  })
}
