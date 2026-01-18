import * as path from 'node:path'
import { Project, SyntaxKind } from 'ts-morph'
import type { PackageMap } from './types.js'

export class ImportRewriter {
  constructor(
    private packageMap: PackageMap,
    private outputDir: string
  ) {}

  async rewriteAll(files: string[]): Promise<void> {
    const jsAndDtsFiles = files.filter((f) => f.endsWith('.js') || f.endsWith('.d.ts'))
    for (const file of jsAndDtsFiles) {
      await this.rewriteFile(file)
    }
  }

  private async rewriteFile(filePath: string): Promise<void> {
    const project = new Project({ useInMemoryFileSystem: false })
    const sourceFile = project.addSourceFileAtPath(filePath)

    let modified = false

    // Rewrite static import declarations:
    //   import { foo } from '@myorg/utils'  ->  import { foo } from './deps/packages/utils/dist/index.js'
    for (const decl of sourceFile.getImportDeclarations()) {
      const specifier = decl.getModuleSpecifierValue()
      const newSpecifier = this.rewriteSpecifier(specifier, filePath)
      if (newSpecifier) {
        decl.setModuleSpecifier(newSpecifier)
        modified = true
      }
    }

    // Rewrite re-export declarations:
    //   export { bar } from '@myorg/utils'  ->  export { bar } from './deps/packages/utils/dist/index.js'
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

    // Rewrite dynamic import() calls:
    //   const mod = await import('@myorg/utils')  ->  const mod = await import('./deps/packages/utils/dist/index.js')
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
      return this.computeRelativePath(fromFile, exactMatch.outputEntryPoint)
    }

    for (const [pkgName, location] of this.packageMap) {
      if (specifier.startsWith(pkgName + '/')) {
        const subpath = specifier.slice(pkgName.length + 1)
        const targetPath = location.resolveSubpath(subpath)
        return this.computeRelativePath(fromFile, targetPath)
      }
    }

    return null
  }

  private computeRelativePath(fromFile: string, targetOutputPath: string): string {
    const absoluteTargetPath = path.join(this.outputDir, targetOutputPath)
    let relative = path.relative(path.dirname(fromFile), absoluteTargetPath)
    if (!relative.startsWith('.')) {
      relative = './' + relative
    }
    return relative
  }
}
