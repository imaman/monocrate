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
 * Lists files in a directory that are committed in git (not just staged).
 * Uses `git ls-tree` to get only files from HEAD.
 * Throws if there are any untracked files.
 */
function listCommittedFiles(packageDir: AbsolutePath): RelativePath[] {
  // Check for untracked files (not gitignored)
  const untrackedOutput = execSync('git ls-files --others --exclude-standard', {
    cwd: packageDir,
    encoding: 'utf-8',
  })
  const untrackedFiles = untrackedOutput
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (untrackedFiles.length > 0) {
    throw new Error(
      `Cannot mirror: found ${String(untrackedFiles.length)} untracked file(s) in ${packageDir}. ` +
        `First few: ${untrackedFiles.slice(0, 3).join(', ')}. ` +
        `Commit or gitignore them before mirroring.`
    )
  }

  // Get only committed files from HEAD
  // -r: recursive
  // --name-only: show only file names
  const output = execSync('git ls-tree -r --name-only HEAD', {
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
    const files = listCommittedFiles(pkg.fromDir)

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
 * Only committed files (from HEAD) are copied.
 * Throws if any package has untracked files.
 * Each package's target directory is wiped before copying.
 */
export async function mirrorSources(packages: MonorepoPackage[], mirrorDir: AbsolutePath): Promise<void> {
  // TODO(imaman): can we dedup with file-copier.ts?

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

  // TODO(imaman): make the loop run concurrently (with some controlled concurrency).
  // Phase 4: Copy all files
  for (const op of operations) {
    await fsPromises.copyFile(op.source, op.destination)
  }
}
