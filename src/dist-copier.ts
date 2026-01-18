import * as fs from 'node:fs'
import * as fsPromises from 'node:fs/promises'
import * as path from 'node:path'
import type { DependencyGraph, MonorepoPackage, PackageLocation, PackageMap } from './types.js'

interface CopyOperation {
  source: string
  destination: string
}

interface ValidatedPackage {
  sourceDir: string
  location: PackageLocation
}

export class DistCopier {
  constructor(
    private graph: DependencyGraph,
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

    const main = this.getValidatedPackage(this.graph.packageToBundle)
    operations.push({
      source: main.sourceDir,
      destination: path.join(this.outputDir, main.location.distDir),
    })

    for (const dep of this.graph.inRepoDeps) {
      const validated = this.getValidatedPackage(dep)
      operations.push({
        source: validated.sourceDir,
        destination: path.join(
          this.outputDir,
          'deps',
          validated.location.monorepoRelativePath,
          validated.location.distDir
        ),
      })
    }

    return operations
  }

  private getValidatedPackage(pkg: MonorepoPackage): ValidatedPackage {
    const location = this.packageMap.get(pkg.name)
    if (!location) {
      throw new Error(`Package ${pkg.name} not found in package map. This is a bug.`)
    }
    const sourceDir = path.join(pkg.path, location.distDir)
    if (!fs.existsSync(sourceDir)) {
      throw new Error(`dist directory not found at ${sourceDir}. Did you run the build for ${pkg.name}?`)
    }
    return { sourceDir, location }
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
