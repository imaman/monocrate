import * as fs from 'node:fs'
import * as path from 'node:path'
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
    'version-file': {
      type: 'string',
      description: 'Write resolved version to file instead of stdout',
      alias: 'o',
    },
  },
  async run({ args }) {
    const outputDir = args.output || undefined
    const result = await monocrate({
      pathToSubjectPackage: args.source,
      ...(outputDir ? { outputDir } : {}),
      monorepoRoot: args.root,
      publishToVersion: args.publish,
      cwd: process.cwd(),
    })

    if (result.resolvedVersion !== undefined) {
      const versionOutput = result.resolvedVersion
      const versionFile = args['version-file']
      if (versionFile) {
        fs.writeFileSync(path.resolve(process.cwd(), versionFile), versionOutput)
      } else {
        console.log(versionOutput)
      }
    }
  },
})

export function monocrateCli(): void {
  runMain(command).catch((error: unknown) => {
    console.error('Fatal error:', error instanceof Error ? error.stack : error)
    process.exit(1)
  })
}
