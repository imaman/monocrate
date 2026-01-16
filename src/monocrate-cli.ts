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
      description: 'Output directory',
      required: true,
    },
    root: {
      type: 'string',
      description: 'Monorepo root directory (auto-detected if not specified)',
      alias: 'r',
    },
  },
  async run({ args }) {
    const result = await monocrate({
      sourceDir: args.source,
      outputDir: args.output,
      monorepoRoot: args.root,
    })

    if (result.success) {
      console.log(`Bundle created at: ${result.outputDir}`)
    } else {
      console.error(`Error: ${result.error}`)
      process.exit(1)
    }
  },
})

export function monocrateCli(): void {
  runMain(command).catch((error: unknown) => {
    console.error('Fatal error:', error instanceof Error ? error.stack : error)
    process.exit(1)
  })
}
