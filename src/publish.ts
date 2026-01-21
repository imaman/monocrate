import { spawnSync } from 'node:child_process'
import type { AbsolutePath } from './paths.js'

export function publish(outputDir: AbsolutePath) {
  const npmPublishResult = spawnSync('npm', ['publish'], { cwd: outputDir, stdio: 'inherit' })
  if (npmPublishResult.status !== 0) {
    throw new Error(`npm publish failed with exit code ${String(npmPublishResult.status ?? 1)}`)
  }
}
