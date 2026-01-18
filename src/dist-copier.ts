import * as fs from 'node:fs'
import * as fsPromises from 'node:fs/promises'
import * as path from 'node:path'
import type { DependencyGraph, MonorepoPackage, PackageLocation, PackageMap } from './types.js'

interface CopyOperation {
  source: string
  destination: string
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

    const mainLocation = this.getPackageLocation(this.graph.packageToBundle)
    const mainSource = this.getValidatedSourceDir(this.graph.packageToBundle, mainLocation)
    operations.push({
      source: mainSource,
      destination: path.join(this.outputDir, mainLocation.distDir),
    })

    for (const dep of this.graph.inRepoDeps) {
      const depLocation = this.getPackageLocation(dep)
      const depSource = this.getValidatedSourceDir(dep, depLocation)
      operations.push({
        source: depSource,
        destination: path.join(this.outputDir, 'deps', depLocation.monorepoRelativePath, depLocation.distDir),
      })
    }

    return operations
  }

  private getPackageLocation(pkg: MonorepoPackage): PackageLocation {
    const location = this.packageMap.get(pkg.name)
    if (!location) {
      throw new Error(`Package ${pkg.name} not found in package map. This is a bug.`)
    }
    return location
  }

  private getValidatedSourceDir(pkg: MonorepoPackage, location: PackageLocation): string {
    const sourceDir = path.join(pkg.path, location.distDir)
    if (!fs.existsSync(sourceDir)) {
      throw new Error(`dist directory not found at ${sourceDir}. Did you run the build for ${pkg.name}?`)
    }
    return sourceDir
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
        if (entry.name.endsWith('.js') || entry.name.endsWith('.d.ts')) {
          copiedFiles.push(destPath)
        }
      }
    }

    return copiedFiles
  }
}
