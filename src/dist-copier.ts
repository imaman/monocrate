import * as fs from 'node:fs'
import * as fsPromises from 'node:fs/promises'
import * as path from 'node:path'
import type { DependencyGraph, PackageMap } from './types.js'

export class DistCopier {
  constructor(
    private graph: DependencyGraph,
    private packageMap: PackageMap,
    private outputDir: string
  ) {}

  async copy(): Promise<void> {
    await this.copyMainPackage()
    await this.copyDependencies()
  }

  private async copyMainPackage(): Promise<void> {
    const packageToBundleLocation = this.packageMap.get(this.graph.packageToBundle.name)
    if (!packageToBundleLocation) {
      throw new Error(`Package to bundle ${this.graph.packageToBundle.name} not found in package map`)
    }

    const packageToBundleDistSrc = path.join(this.graph.packageToBundle.path, packageToBundleLocation.distDir)
    const packageToBundleDistDest = path.join(this.outputDir, packageToBundleLocation.distDir)

    if (!fs.existsSync(packageToBundleDistSrc)) {
      throw new Error(`dist directory not found at ${packageToBundleDistSrc}. Did you run the build?`)
    }

    await this.copyDir(packageToBundleDistSrc, packageToBundleDistDest)
  }

  private async copyDependencies(): Promise<void> {
    for (const dep of this.graph.inRepoDeps) {
      const depLocation = this.packageMap.get(dep.name)
      if (!depLocation) {
        throw new Error(`In-repo dependency ${dep.name} not found in package map. This is a bug.`)
      }

      const depDistSrc = path.join(dep.path, depLocation.distDir)
      const depDistDest = path.join(this.outputDir, 'deps', depLocation.monorepoRelativePath, depLocation.distDir)

      if (!fs.existsSync(depDistSrc)) {
        throw new Error(`dist directory not found at ${depDistSrc}. Did you run the build for ${dep.name}?`)
      }

      await this.copyDir(depDistSrc, depDistDest)
    }
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
