import * as fsPromises from 'node:fs/promises'
import * as path from 'node:path'
import type { PackageMap } from './types.js'

interface CopyOperation {
  source: string
  destination: string
}

export class DistCopier {
  constructor(
    private packageMap: PackageMap,
    private outputDir: string
  ) {}

  async copy(): Promise<string[]> {
    const operations = this.collectCopyOperations()
    const copiedFiles: string[] = []
    for (const op of operations) {
      const files = await this.copyDir(op.source, op.destination)
      copiedFiles.push(...files)
    }
    return copiedFiles
  }

  private collectCopyOperations(): CopyOperation[] {
    const operations: CopyOperation[] = []

    for (const location of this.packageMap.values()) {
      operations.push({
        source: location.sourceDistDir,
        destination: path.join(this.outputDir, location.outputDistDir),
      })
    }

    return operations
  }

  private async copyDir(src: string, dest: string): Promise<string[]> {
    await fsPromises.mkdir(dest, { recursive: true })
    const entries = await fsPromises.readdir(src, { withFileTypes: true })
    const copiedFiles: string[] = []

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        const nestedFiles = await this.copyDir(srcPath, destPath)
        copiedFiles.push(...nestedFiles)
      } else {
        await fsPromises.copyFile(srcPath, destPath)
        copiedFiles.push(destPath)
      }
    }

    return copiedFiles
  }
}
