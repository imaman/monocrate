import type { AbsolutePath } from './paths.js'
import type { NpmClient } from './npm-client.js'

export async function publish(npmClient: NpmClient, outputDir: AbsolutePath) {
  await npmClient.publish(outputDir)
}
