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
      await this.copyEntry(op.source, op.destination, copiedFiles)
    }
    return copiedFiles
  }

  private collectCopyOperations(): CopyOperation[] {
    const operations: CopyOperation[] = []

    for (const location of this.packageMap.values()) {
      for (const filePattern of location.filesToCopy) {
        const source = path.join(location.packageDir, filePattern)
        const destination = path.join(this.outputDir, location.outputPrefix, filePattern)

        // Only add operations for paths that exist
        if (fs.existsSync(source)) {
          operations.push({ source, destination })
        }
      }
    }

    return operations
  }

  private async copyEntry(src: string, dest: string, copiedFiles: string[]): Promise<void> {
    const stat = await fsPromises.stat(src)

    if (stat.isDirectory()) {
      await this.copyDir(src, dest, copiedFiles)
    } else {
      await fsPromises.mkdir(path.dirname(dest), { recursive: true })
      await fsPromises.copyFile(src, dest)
      copiedFiles.push(dest)
    }
  }

  private async copyDir(src: string, dest: string, copiedFiles: string[]): Promise<void> {
    await fsPromises.mkdir(dest, { recursive: true })
    const entries = await fsPromises.readdir(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        await this.copyDir(srcPath, destPath, copiedFiles)
      } else {
        await fsPromises.copyFile(srcPath, destPath)
        copiedFiles.push(destPath)
      }
    }
  }
}
