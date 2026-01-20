import * as fs from 'node:fs'
import * as fsPromises from 'node:fs/promises'
import * as path from 'node:path'
import type { PackageMap } from './package-map.js'

interface CopyOperation {
  source: string
  destination: string
  isDirectory: boolean
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
      await this.executeOperation(op, copiedFiles)
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
          const stat = fs.statSync(source)
          operations.push({ source, destination, isDirectory: stat.isDirectory() })
        }
      }
    }

    return operations
  }

  private async executeOperation(operation: CopyOperation, copiedFiles: string[]): Promise<void> {
    if (operation.isDirectory) {
      await this.copyDir(operation.source, operation.destination, copiedFiles)
    } else {
      await this.copyFile(operation.source, operation.destination, copiedFiles)
    }
  }

  private async copyFile(src: string, dest: string, copiedFiles: string[]): Promise<void> {
    await fsPromises.mkdir(path.dirname(dest), { recursive: true })
    await fsPromises.copyFile(src, dest)
    copiedFiles.push(dest)
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
        await this.copyFile(srcPath, destPath, copiedFiles)
      }
    }
  }
}
