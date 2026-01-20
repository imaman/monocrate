import { spawnSync } from 'node:child_process'

export function publish(outputDir: string) {
  const npmPublishResult = spawnSync('npm', ['publish'], { cwd: outputDir, stdio: 'inherit' })
  if (npmPublishResult.status !== 0) {
    throw new Error(`npm publish failed with exit code ${String(npmPublishResult.status ?? 1)}`)
  }
}
