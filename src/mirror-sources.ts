import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as fsPromises from 'node:fs/promises'
import * as path from 'node:path'
import type { MonorepoPackage } from './repo-explorer.js'
import { AbsolutePath, RelativePath } from './paths.js'

interface CopyOperation {
  source: AbsolutePath
  destination: AbsolutePath
}

/**
 * Lists files in a directory that are tracked by git.
 * Uses `git ls-files` to get only committed/staged files.
 */
function listGitTrackedFiles(packageDir: AbsolutePath): RelativePath[] {
  // Get only tracked files (committed or staged)
  // --cached: show tracked files
  const output = execSync('git ls-files --cached', {
    cwd: packageDir,
    encoding: 'utf-8',
  })

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => RelativePath(line))
}

function collectCopyOperations(packages: MonorepoPackage[], mirrorDir: AbsolutePath): CopyOperation[] {
  const operations: CopyOperation[] = []

  for (const pkg of packages) {
    const targetDir = AbsolutePath.join(mirrorDir, pkg.pathInRepo)
    const files = listGitTrackedFiles(pkg.fromDir)

    for (const relativePath of files) {
      const sourceFile = AbsolutePath.join(pkg.fromDir, relativePath)

      if (!fs.existsSync(sourceFile)) {
        throw new Error(`Source file does not exist: ${sourceFile}`)
      }

      const stat = fs.statSync(sourceFile)
      if (stat.isDirectory()) {
        throw new Error(`git ls-files returned a directory, which is unexpected: ${sourceFile}`)
      }

      operations.push({
        source: sourceFile,
        destination: AbsolutePath.join(targetDir, relativePath),
      })
    }
  }

  return operations
}

/**
 * Mirrors source code of packages to a target directory.
 * Each package's files are copied preserving the path structure relative to the monorepo root.
 * Only git-tracked files (committed or staged) are copied.
 * Each package's target directory is wiped before copying.
 */
export async function mirrorSources(packages: MonorepoPackage[], mirrorDir: AbsolutePath): Promise<void> {
  // Phase 1: Wipe target directories for each package
  for (const pkg of packages) {
    const targetDir = AbsolutePath.join(mirrorDir, pkg.pathInRepo)
    if (fs.existsSync(targetDir)) {
      await fsPromises.rm(targetDir, { recursive: true })
    }
  }

  // Phase 2: Collect all copy operations
  const operations = collectCopyOperations(packages, mirrorDir)

  // Phase 3: Create all unique directories
  const directories = new Set(operations.map((op) => path.dirname(op.destination)))
  for (const dir of directories) {
    await fsPromises.mkdir(dir, { recursive: true })
  }

  // Phase 4: Copy all files
  for (const op of operations) {
    await fsPromises.copyFile(op.source, op.destination)
  }
}
