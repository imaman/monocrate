import { z } from 'zod'
import type { AbsolutePath } from './paths.js'
import { runNpm } from './run-npm.js'

const NpmPackFile = z.object({
  path: z.string(),
})

const NpmPackResult = z.object({
  files: z.array(NpmPackFile),
})

const NpmPackOutput = z.array(NpmPackResult)

const NpmPackError = z.object({
  error: z.object({
    summary: z.string(),
  }),
})

/**
 * Gets the list of files that npm would include in a package tarball.
 * Uses `npm pack --dry-run --json` to get npm's exact file selection.
 *
 * @param packageDir - Absolute path to the package directory
 * @returns Array of relative file paths that npm would include
 * @example getFilesToPack("/home/user/my-package") => ["dist/index.js", "README.md", "package.json"]
 */
export async function getFilesToPack(packageDir: AbsolutePath): Promise<string[]> {
  const { stdout } = await runNpm('pack', ['--dry-run', '--json'], packageDir)

  const json: unknown = JSON.parse(stdout)

  // Check if npm returned an error
  const errorResult = NpmPackError.safeParse(json)
  if (errorResult.success) {
    throw new Error(`npm pack failed: ${errorResult.data.error.summary}`)
  }

  const parsed = NpmPackOutput.safeParse(json)
  if (!parsed.success) {
    throw new Error(`Failed to parse npm pack output: ${parsed.error.message}`)
  }

  const packOutput = parsed.data[0]
  if (packOutput === undefined) {
    throw new Error('npm pack returned empty output')
  }

  return packOutput.files.map((f) => f.path)
}
