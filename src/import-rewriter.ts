import * as fsPromises from 'node:fs/promises'
import * as path from 'node:path'
import { Project, SyntaxKind } from 'ts-morph'
import type { PackageLocation, PackageMap } from './types.js'

export class ImportRewriter {
  constructor(
    private packageMap: PackageMap,
    private outputDir: string
  ) {}

  async rewriteAll(): Promise<void> {
    const files = await this.findAllJsAndDtsFiles()

    for (const file of files) {
      await this.rewriteFile(file)
    }
  }

  private async findAllJsAndDtsFiles(): Promise<string[]> {
    const files: string[] = []

    const walk = async (currentDir: string): Promise<void> => {
      const entries = await fsPromises.readdir(currentDir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)
        if (entry.isDirectory()) {
          await walk(fullPath)
        } else if (entry.name.endsWith('.js') || entry.name.endsWith('.d.ts')) {
          files.push(fullPath)
        }
      }
    }

    await walk(this.outputDir)
    return files
  }

  private async rewriteFile(filePath: string): Promise<void> {
    const project = new Project({ useInMemoryFileSystem: false })
    const sourceFile = project.addSourceFileAtPath(filePath)

    let modified = false

    for (const decl of sourceFile.getImportDeclarations()) {
      const specifier = decl.getModuleSpecifierValue()
      const newSpecifier = this.rewriteSpecifier(specifier, filePath)
      if (newSpecifier) {
        decl.setModuleSpecifier(newSpecifier)
        modified = true
      }
    }

    for (const decl of sourceFile.getExportDeclarations()) {
      const specifier = decl.getModuleSpecifierValue()
      if (specifier) {
        const newSpecifier = this.rewriteSpecifier(specifier, filePath)
        if (newSpecifier) {
          decl.setModuleSpecifier(newSpecifier)
          modified = true
        }
      }
    }

    for (const callExpr of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expr = callExpr.getExpression()
      if (expr.getKind() === SyntaxKind.ImportKeyword) {
        const args = callExpr.getArguments()
        const firstArg = args[0]
        if (firstArg?.getKind() === SyntaxKind.StringLiteral) {
          const specifier = firstArg.getText().slice(1, -1)
          const newSpecifier = this.rewriteSpecifier(specifier, filePath)
          if (newSpecifier) {
            firstArg.replaceWithText(`'${newSpecifier}'`)
            modified = true
          }
        }
      }
    }

    if (modified) {
      await sourceFile.save()
    }
  }

  private rewriteSpecifier(specifier: string, fromFile: string): string | null {
    const exactMatch = this.packageMap.get(specifier)
    if (exactMatch) {
      return this.computeRelativePath(fromFile, exactMatch)
    }

    for (const [pkgName, location] of this.packageMap) {
      if (specifier.startsWith(pkgName + '/')) {
        const subpath = specifier.slice(pkgName.length + 1)
        const basePath = location.isPackageToBundle
          ? path.join(this.outputDir, location.distDir)
          : path.join(this.outputDir, 'deps', location.monorepoRelativePath, location.distDir)

        let relativePath = path.relative(path.dirname(fromFile), path.join(basePath, subpath))
        if (!relativePath.startsWith('.')) {
          relativePath = './' + relativePath
        }
        return relativePath
      }
    }

    return null
  }

  private computeRelativePath(fromFile: string, target: PackageLocation): string {
    // isPackageToBundle distinguishes between the main package being bundled vs its in-repo dependencies:
    // - Package to bundle (true): files go to output root, e.g., outputDir/dist/index.js
    // - In-repo deps (false): files go under deps/, e.g., outputDir/deps/packages/lib/dist/index.js
    const targetPath = target.isPackageToBundle
      ? path.join(this.outputDir, target.entryPoint)
      : path.join(this.outputDir, 'deps', target.monorepoRelativePath, target.entryPoint)

    let relative = path.relative(path.dirname(fromFile), targetPath)
    if (!relative.startsWith('.')) {
      relative = './' + relative
    }
    return relative
  }
}
