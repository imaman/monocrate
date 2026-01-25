import * as fs from 'node:fs'
import { AbsolutePath, RelativePath } from './paths.js'
import type { NpmClient } from './npm-client.js'

export async function publish(npmClient: NpmClient, outputDir: AbsolutePath, monorepoRoot: AbsolutePath) {
  const npmrcPath = AbsolutePath.join(monorepoRoot, RelativePath('.npmrc'))
  await npmClient.publish(outputDir, { userconfig: fs.existsSync(npmrcPath) ? npmrcPath : undefined })
}
