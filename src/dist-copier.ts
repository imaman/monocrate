import * as fs from 'node:fs'
import * as fsPromises from 'node:fs/promises'
import * as path from 'node:path'
import type { DependencyGraph, PackageMap } from './types.js'

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

  async copy(): Promise<void> {
    const operations = this.collectCopyOperations()
    for (const op of operations) {
      await this.copyDir(op.source, op.destination)
    }
  }

  private collectCopyOperations(): CopyOperation[] {
    const operations: CopyOperation[] = []

    const packageToBundleLocation = this.packageMap.get(this.graph.packageToBundle.name)
    if (!packageToBundleLocation) {
      throw new Error(`Package to bundle ${this.graph.packageToBundle.name} not found in package map`)
    }

    const mainSource = path.join(this.graph.packageToBundle.path, packageToBundleLocation.distDir)
    if (!fs.existsSync(mainSource)) {
      throw new Error(`dist directory not found at ${mainSource}. Did you run the build?`)
    }
    operations.push({
      source: mainSource,
      destination: path.join(this.outputDir, packageToBundleLocation.distDir),
    })

    for (const dep of this.graph.inRepoDeps) {
      const depLocation = this.packageMap.get(dep.name)
      if (!depLocation) {
        throw new Error(`In-repo dependency ${dep.name} not found in package map. This is a bug.`)
      }

      const depSource = path.join(dep.path, depLocation.distDir)
      if (!fs.existsSync(depSource)) {
        throw new Error(`dist directory not found at ${depSource}. Did you run the build for ${dep.name}?`)
      }
      operations.push({
        source: depSource,
        destination: path.join(this.outputDir, 'deps', depLocation.monorepoRelativePath, depLocation.distDir),
      })
    }

    return operations
  }

  private async copyDir(src: string, dest: string): Promise<void> {
    await fsPromises.mkdir(dest, { recursive: true })
    const entries = await fsPromises.readdir(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        await this.copyDir(srcPath, destPath)
      } else {
        await fsPromises.copyFile(srcPath, destPath)
      }
    }
  }
}
