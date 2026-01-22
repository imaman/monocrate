import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { AbsolutePath } from './paths.js'

/**
 * @param outputDir
 * @param monorepoRoot
 */
export function publish(outputDir: AbsolutePath, monorepoRoot: AbsolutePath) {
  const npmrcPath = path.join(monorepoRoot, '.npmrc')
  const userconfigArg = fs.existsSync(npmrcPath) ? ` --userconfig ${npmrcPath}` : ''
  // transition to a common npm invocation utility + a common child process invocation utility.
  execSync(`npm publish${userconfigArg}`, { cwd: outputDir, stdio: 'inherit', encoding: 'utf-8' })
  // if (npmPublishResult.status !== 0) {
  //   throw new Error(`npm publish failed with exit code ${String(npmPublishResult.status ?? 1)}`)
  // }
}

// get-files-to-pack
// resolve-version
// publish
