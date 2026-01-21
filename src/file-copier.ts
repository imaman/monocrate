import * as fsPromises from 'node:fs/promises'
import * as path from 'node:path'
import type { PackageMap } from './package-map.js'
import type { AbsolutePath } from './paths.js'

interface CopyOperation {
  source: string
  destination: string
}

export class FileCopier {
  constructor(
    private packageMap: PackageMap,
    private outputDir: AbsolutePath
  ) {}

  async copy(): Promise<string[]> {
    const operations = this.collectCopyOperations()

    // Phase 1: Collect and create unique directories
    const directories = new Set(operations.map((op) => path.dirname(op.destination)))
    for (const dir of directories) {
      await fsPromises.mkdir(dir, { recursive: true })
    }

    // Phase 2: Copy all files
    const copiedFiles: string[] = []
    for (const op of operations) {
      await fsPromises.copyFile(op.source, op.destination)
      copiedFiles.push(op.destination)
    }
    return copiedFiles
  }

  private collectCopyOperations(): CopyOperation[] {
    const operations: CopyOperation[] = []

    for (const location of this.packageMap.values()) {
      for (const filePath of location.filesToCopy) {
        operations.push({
          source: path.join(location.packageDir, filePath),
          destination: path.join(this.outputDir, location.outputPrefix, filePath),
        })
      }
    }

    return operations
  }
}
