import * as fs from 'node:fs'
import * as path from 'node:path'
import type { AbsolutePath } from './paths.js'
import { runNpm } from './run-npm.js'

export async function publish(outputDir: AbsolutePath, monorepoRoot: AbsolutePath) {
  const npmrcPath = path.join(monorepoRoot, '.npmrc')
  const args = fs.existsSync(npmrcPath) ? ['--userconfig', npmrcPath] : []
  await runNpm('publish', args, outputDir)
}

// get-files-to-pack
// resolve-version
// publish
