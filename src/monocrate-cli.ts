import { defineCommand, runMain } from 'citty'
import { monocrate } from './monocrate.js'

const command = defineCommand({
  meta: {
    name: 'monocrate',
    description: 'Assemble and optionally publish a monorepo package to npm',
  },
  args: {
    source: {
      type: 'positional',
      description: 'Source package directory',
      required: true,
    },
    output: {
      type: 'positional',
      description: 'Output directory (creates a dedicated temp directory if not specified)',
      required: false,
    },
    root: {
      type: 'string',
      description: 'Monorepo root directory (auto-detected if not specified)',
      alias: 'r',
    },
    publish: {
      type: 'string',
      description: 'Publish to npm with version: x.y.z (explicit) or patch|minor|major (increment)',
      alias: 'p',
    },
    'output-file': {
      type: 'string',
      description: 'Write output to file instead of stdout',
      alias: 'o',
    },
  },
  async run({ args }) {
    const outputRoot = args.output || undefined
    const outputFile = args['output-file'] || undefined
    await monocrate({
      pathToSubjectPackage: args.source,
      ...(outputRoot ? { outputRoot } : {}),
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
