import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { z } from 'zod'

const execAsync = promisify(exec)

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
export async function getFilesToPack(packageDir: string): Promise<string[]> {
  const { stdout } = await execAsync('npm pack --dry-run --json', {
    cwd: packageDir,
    encoding: 'utf-8',
  })

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
