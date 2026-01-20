import * as fs from 'node:fs'
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
      await this.copyFromTo(op.source, op.destination, copiedFiles)
    }
    return copiedFiles
  }

  private collectCopyOperations(): CopyOperation[] {
    const operations: CopyOperation[] = []

    for (const location of this.packageMap.values()) {
      for (const filePattern of location.filesToCopy) {
        const source = path.join(location.packageDir, filePattern)
        const destination = path.join(this.outputDir, location.outputPrefix, filePattern)

        if (fs.existsSync(source)) {
          operations.push({ source, destination })
        }
      }
    }

    return operations
  }

  private async copyFromTo(src: string, dest: string, copiedFiles: string[]): Promise<void> {
    const isDir = fs.statSync(src).isDirectory()
    if (!isDir) {
      await fsPromises.mkdir(path.dirname(dest), { recursive: true })
      await fsPromises.copyFile(src, dest)
      copiedFiles.push(dest)
      return
    }

    await fsPromises.mkdir(dest, { recursive: true })
    const list = await fsPromises.readdir(src, { withFileTypes: true })
    for (const at of list) {
      await this.copyFromTo(path.join(src, at.name), path.join(dest, at.name), copiedFiles)
    }
  }
}
