import { createRequire } from 'node:module'
import { defineCommand, runMain } from 'citty'
import type { MonocrateOptions } from './monocrate.js'
import { monocrate } from './monocrate.js'

const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { version: string }

const cliArgsDefs = {
  packages: {
    type: 'positional' as const,
    description: 'Package directories to assemble',
    required: true,
  },
  bump: {
    type: 'string' as const,
    description: 'Version or increment (patch/minor/major)',
    valueHint: 'version',
    alias: 'b',
  },
  output: {
    type: 'string' as const,
    description: 'Output directory for assembled packages',
    valueHint: 'dir',
    alias: 'o',
  },
  root: {
    type: 'string' as const,
    description: 'Monorepo root (auto-detected if omitted)',
    valueHint: 'dir',
    alias: 'r',
  },
  report: {
    type: 'string' as const,
    description: 'Write report to file',
    valueHint: 'path',
  },
  'mirror-to': {
    type: 'string' as const,
    description: 'Mirror source files to directory',
    valueHint: 'dir',
    alias: 'm',
  },
}

interface CliArgs {
  _: string[]
  output?: string
  root?: string
  bump?: string
  report?: string
  'mirror-to'?: string
}

function buildOptions(args: CliArgs, publish: boolean): MonocrateOptions {
  const packages = extractPackages(args._)
  return {
    pathToSubjectPackage: packages,
    outputRoot: args.output,
    monorepoRoot: args.root,
    bump: args.bump,
    publish,
    report: args.report,
    cwd: process.cwd(),
    mirrorTo: args['mirror-to'],
  }
}

function extractPackages(args: string[]): string[] {
  if (args.length === 0) {
    throw new Error('At least one package directory must be specified')
  }
  return args
}

const prepareCommand = defineCommand({
  meta: {
    name: 'prepare',
    description: 'Assemble packages without publishing',
  },
  args: cliArgsDefs,
  async run({ args }) {
    await monocrate(buildOptions(args, false))
  },
})

const publishCommand = defineCommand({
  meta: {
    name: 'publish',
    description: 'Assemble packages and publish to npm',
  },
  args: cliArgsDefs,
  async run({ args }) {
    await monocrate(buildOptions(args, true))
  },
})

const mainCommand = defineCommand({
  meta: {
    name: 'monocrate',
    version: pkg.version,
    description: 'Assemble and publish monorepo packages to npm',
  },
  subCommands: {
    publish: publishCommand,
    prepare: prepareCommand,
  },
})

export function monocrateCli(): void {
  runMain(mainCommand).catch((error: unknown) => {
    console.error('Fatal error:', error instanceof Error ? error.stack : error)
    process.exit(1)
  })
}
