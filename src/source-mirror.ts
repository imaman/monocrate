import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as fsPromises from 'node:fs/promises'
import * as path from 'node:path'
import type { MonorepoPackage } from './repo-explorer.js'
import { AbsolutePath, RelativePath } from './paths.js'

/**
 * Lists files in a directory that are tracked by git (i.e., not gitignored).
 * Uses `git ls-files` to get the list of tracked and untracked-but-not-ignored files.
 */
function listNonGitIgnoredFiles(packageDir: AbsolutePath): string[] {
  // Get tracked files and untracked files that are not ignored
  // --cached: show tracked files
  // --others: show untracked files
  // --exclude-standard: apply standard gitignore rules to --others
  const output = execSync('git ls-files --cached --others --exclude-standard', {
    cwd: packageDir,
    encoding: 'utf-8',
  })

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

/**
 * Mirrors source code of packages to a target directory.
 * Each package's files are copied preserving the path structure relative to the monorepo root.
 * Only files that are NOT gitignored are copied.
 * Each package's target directory is wiped before copying.
 */
export async function mirrorSources(packages: MonorepoPackage[], mirrorDir: AbsolutePath): Promise<void> {
  for (const pkg of packages) {
    const targetDir = AbsolutePath.join(mirrorDir, pkg.pathInRepo)

    // Wipe the target directory if it exists
    if (fs.existsSync(targetDir)) {
      await fsPromises.rm(targetDir, { recursive: true })
    }

    // Get list of non-gitignored files
    const files = listNonGitIgnoredFiles(pkg.fromDir)

    // Copy each file
    for (const relativePath of files) {
      const sourceFile = path.join(pkg.fromDir, relativePath)
      const targetFile = AbsolutePath.join(targetDir, RelativePath(relativePath))

      // Skip if source doesn't exist (could happen if file was deleted after ls-files)
      if (!fs.existsSync(sourceFile)) {
        continue
      }

      // Skip directories (git ls-files only returns files, but just in case)
      const stat = fs.statSync(sourceFile)
      if (stat.isDirectory()) {
        continue
      }

      // Create target directory
      const targetFileDir = path.dirname(targetFile)
      await fsPromises.mkdir(targetFileDir, { recursive: true })

      // Copy the file
      await fsPromises.copyFile(sourceFile, targetFile)
    }
  }
}
