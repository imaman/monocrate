import { defineCommand, runMain } from 'citty'
import { monocrate, monocrateMultiple } from './monocrate.js'

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
    root: {
      type: 'string',
      description: 'Monorepo root directory (auto-detected if not specified)',
      alias: 'r',
    },
    output: {
      type: 'string',
      description: 'Output root directory (creates a dedicated temp directory if not specified)',
      alias: 'O',
    },
    publish: {
      type: 'string',
      description: 'Publish to npm with version: x.y.z (explicit) or patch|minor|major (increment)',
      alias: 'p',
    },
    'output-file': {
      type: 'string',
      description: 'Write resolved version to file instead of stdout',
      alias: 'o',
    },
  },
  async run({ args }) {
    const outputRoot = args.output || undefined
    const outputFile = args['output-file'] || undefined
    // citty puts remaining positional args in args._ (after the first one in args.sources)
    const additionalSources = args._ as readonly string[]
    const firstSource = args.sources
    const allSources = [firstSource, ...additionalSources]

    if (allSources.length === 1) {
      // Single package: use original function for backward compatibility
      await monocrate({
        pathToSubjectPackage: firstSource,
        ...(outputRoot ? { outputRoot } : {}),
        ...(outputFile ? { outputFile } : {}),
        monorepoRoot: args.root,
        publishToVersion: args.publish,
        cwd: process.cwd(),
      })
    } else {
      // Multiple packages: use new multi-package function
      await monocrateMultiple({
        pathsToSubjectPackages: allSources,
        ...(outputRoot ? { outputRoot } : {}),
        ...(outputFile ? { outputFile } : {}),
        monorepoRoot: args.root,
        publishToVersion: args.publish,
        cwd: process.cwd(),
      })
    }
  },
})

export function monocrateCli(): void {
  runMain(command).catch((error: unknown) => {
    console.error('Fatal error:', error instanceof Error ? error.stack : error)
    process.exit(1)
  })
}
