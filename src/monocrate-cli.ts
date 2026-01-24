import { defineCommand, runMain } from 'citty'
import type { MonocrateOptions } from './monocrate.js';
import { monocrate } from './monocrate.js'

const sharedArgs = {
  packages: {
    type: 'positional' as const,
    description: 'Package directories to assemble',
    required: true,
  },
  bump: {
    type: 'string' as const,
    description: 'Version: x.y.z (explicit) or patch|minor|major (increment)',
    alias: 'b',
  },
  output: {
    type: 'string' as const,
    description: 'Output directory (creates a dedicated temp directory if not specified)',
    alias: 'o',
  },
  root: {
    type: 'string' as const,
    description: 'Monorepo root directory (auto-detected if not specified)',
    alias: 'r',
  },
  'output-file': {
    type: 'string' as const,
    description: 'Write output to file instead of stdout',
    alias: 'f',
  },
}

interface SharedArgs {
  _: string[]
  output?: string
  root?: string
  bump?: string
  'output-file'?: string
}

function buildOptions(args: SharedArgs, publish: boolean): MonocrateOptions {
  const packages = extractPackages(args._)
  return {
    pathToSubjectPackage: packages,
    outputRoot: args.output,
    monorepoRoot: args.root,
    bump: args.bump,
    publish,
    outputFile: args['output-file'],
    cwd: process.cwd(),
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
    description: 'Assemble packages for publishing without actually publishing',
  },
  args: sharedArgs,
  async run({ args }) {
    await monocrate(buildOptions(args, false))
  },
})

const publishCommand = defineCommand({
  meta: {
    name: 'publish',
    description: 'Assemble and publish packages to npm',
  },
  args: sharedArgs,
  async run({ args }) {
    await monocrate(buildOptions(args, true))
  },
})

const mainCommand = defineCommand({
  meta: {
    name: 'monocrate',
    description: 'Assemble and publish monorepo packages to npm',
  },
  subCommands: {
    prepare: prepareCommand,
    publish: publishCommand,
  },
})

export function monocrateCli(): void {
  runMain(mainCommand).catch((error: unknown) => {
    console.error('Fatal error:', error instanceof Error ? error.stack : error)
    process.exit(1)
  })
}
