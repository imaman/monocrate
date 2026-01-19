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
      description: 'Version bump and publish: x.y.z | patch | minor | major',
      alias: 'p',
    },
  },
  async run({ args }) {
    const outputDir: string | undefined = args.output || undefined
    const result = await monocrate({
      sourceDir: args.source,
      ...(outputDir ? { outputDir } : {}),
      monorepoRoot: args.root,
      publish: args.publish,
    })

    console.log(`Bundle created at: ${result}`)
  },
})

export function monocrateCli(): void {
  runMain(command).catch((error: unknown) => {
    console.error('Fatal error:', error instanceof Error ? error.stack : error)
    process.exit(1)
  })
}
