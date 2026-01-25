import { defineCommand, runMain } from 'citty'
import type { MonocrateOptions } from './monocrate.js'
import { monocrate } from './monocrate.js'

const cliArgsDefs = {
  packages: {
    type: 'positional' as const,
    description:
      'Package directories to assemble (absolute or relative). Specify one or more packages from your monorepo to bundle with their in-repo dependencies.',
    required: true,
  },
  bump: {
    type: 'string' as const,
    description:
      'Version specifier: explicit semver (1.2.3) or increment (patch|minor|major). For increments, finds the highest current version across all packages and bumps it. Defaults to minor.',
    alias: 'b',
  },
  output: {
    type: 'string' as const,
    description:
      'Output root directory; assembly placed in package-named subdirectory. Defaults to a temp directory. Useful for inspecting the assembly before publishing or for manual publishing.',
    alias: 'o',
  },
  root: {
    type: 'string' as const,
    description:
      'Monorepo root directory. Auto-detected by searching for a package.json with workspaces. Specify explicitly if auto-detection fails or your structure is non-standard.',
    alias: 'r',
  },
  'output-file': {
    type: 'string' as const,
    description:
      'Write the resolved version to a file instead of stdout. Useful in CI/CD pipelines to capture the published version for downstream steps.',
    alias: 'f',
  },
  'mirror-to': {
    type: 'string' as const,
    description:
      'Mirror package sources to this directory (committed files from HEAD only; fails if untracked files exist). Primary use case: copying source code from a private monorepo to a public mirror repository for open-sourced packages.',
    alias: 'm',
  },
}

interface CliArgs {
  _: string[]
  output?: string
  root?: string
  bump?: string
  'output-file'?: string
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
    outputFile: args['output-file'],
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

const rehearseCommand = defineCommand({
  meta: {
    name: 'rehearse',
    description: 'Assemble packages for publishing without actually publishing',
  },
  args: cliArgsDefs,
  async run({ args }) {
    await monocrate(buildOptions(args, false))
  },
})

const publishCommand = defineCommand({
  meta: {
    name: 'publish',
    description: 'publish packages to npm',
  },
  args: cliArgsDefs,
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
    prepare: rehearseCommand,
    publish: publishCommand,
  },
})

export function monocrateCli(): void {
  runMain(mainCommand).catch((error: unknown) => {
    console.error('Fatal error:', error instanceof Error ? error.stack : error)
    process.exit(1)
  })
}
