import * as fsPromises from 'node:fs/promises'
import * as path from 'node:path'
import type { PackageMap } from './package-map.js'

interface CopyOperation {
  source: string
  destination: string
}

export class FileCopier {
  constructor(
    private packageMap: PackageMap,
    private outputDir: string
  ) {}

  async copy(): Promise<string[]> {
    const operations = this.collectCopyOperations()
    const copiedFiles: string[] = []
    for (const op of operations) {
      await fsPromises.mkdir(path.dirname(op.destination), { recursive: true })
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
