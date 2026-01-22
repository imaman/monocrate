import { defineCommand, runMain } from 'citty'
import { monocrate } from './monocrate.js'

const command = defineCommand({
  meta: {
    name: 'monocrate',
    description: 'Assemble and optionally publish monorepo packages to npm',
  },
  args: {
    sources: {
      type: 'positional',
      description: 'Source package directories (one or more)',
      required: true,
    },
    output: {
      type: 'string',
      description: 'Output directory. When multiple packages are specified, each gets a subdirectory. Creates temp directories if not specified.',
      alias: 'd',
    },
    root: {
      type: 'string',
      description: 'Monorepo root directory (auto-detected if not specified)',
      alias: 'r',
    },
    publish: {
      type: 'string',
      description: 'Publish to npm with version: x.y.z (explicit) or patch|minor|major (increment). All packages share the same version.',
      alias: 'p',
    },
    'output-file': {
      type: 'string',
      description: 'Write resolved version to file instead of stdout',
      alias: 'o',
    },
  },
  async run({ args }) {
    // Collect all positional arguments (source directories)
    // citty puts the first positional in args.sources, and remaining in args._
    const sources: string[] = [args.sources, ...((args._ as string[] | undefined) ?? [])]
    const outputDir = args.output || undefined
    const outputFile = args['output-file'] || undefined
    await monocrate({
      pathToSubjectPackages: sources,
      ...(outputDir ? { outputDir } : {}),
      ...(outputFile ? { outputFile } : {}),
      monorepoRoot: args.root,
      publishToVersion: args.publish,
      cwd: process.cwd(),
    })
  },
})

export function monocrateCli(): void {
  runMain(command).catch((error: unknown) => {
    console.error('Fatal error:', error instanceof Error ? error.stack : error)
    process.exit(1)
  })
}
