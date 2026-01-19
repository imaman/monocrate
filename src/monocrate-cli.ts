import { defineCommand, runMain } from 'citty'
import { monocrate } from './monocrate.js'

const command = defineCommand({
  meta: {
    name: 'monocrate',
    description: 'Bundle a monorepo package for npm publishing',
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
  },
  async run({ args }) {
    const outputDir: string | undefined = args.output || undefined
    const result = await monocrate({
      pathToPackageToBundle: args.source,
      ...(outputDir ? { outputDir } : {}),
      monorepoRoot: args.root,
      publishToVersion: args.publish,
      cwd: process.cwd(),
    })

    console.log(`Output directory: ${result}`)
  },
})

export function monocrateCli(): void {
  runMain(command).catch((error: unknown) => {
    console.error('Fatal error:', error instanceof Error ? error.stack : error)
    process.exit(1)
  })
}
