import * as fs from 'node:fs'
import { AbsolutePath, RelativePath } from './paths.js'
import { NpmClient } from './npm-client.js'

export async function publish(outputDir: AbsolutePath, monorepoRoot: AbsolutePath) {
  const npmrcPath = AbsolutePath.join(monorepoRoot, RelativePath('.npmrc'))
  await new NpmClient().publish(outputDir, { userconfig: fs.existsSync(npmrcPath) ? npmrcPath : undefined })
}

// get-files-to-pack
// resolve-version
// publish
