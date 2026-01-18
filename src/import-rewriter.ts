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

  private async rewriteFile(pathToImporter: string): Promise<void> {
    const project = new Project({ useInMemoryFileSystem: false })
    const sourceFile = project.addSourceFileAtPath(pathToImporter)

    let modified = false

    // Rewrite static import declarations:
    //   import { foo } from '@myorg/utils'  ->  import { foo } from './deps/packages/utils/dist/index.js'
    for (const decl of sourceFile.getImportDeclarations()) {
      const specifier = decl.getModuleSpecifierValue()
      const newSpecifier = this.computeNewSpecifier(pathToImporter, specifier)
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
        const newSpecifier = this.computeNewSpecifier(pathToImporter, specifier)
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
          const newSpecifier = this.computeNewSpecifier(pathToImporter, specifier)
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

  private computeNewSpecifier(pathToImporter: string, importSpecifier: string) {
    const packageName = this.extractPackageName(importSpecifier)
    const location = this.packageMap.get(packageName)
    if (!location) {
      return undefined
    }

    const subpath = importSpecifier.slice(packageName.length + 1)
    // Empty subpath means bare package import (e.g., '@myorg/utils' -> 'dist/index.js')
    // Non-empty subpath means subpath import (e.g., '@myorg/utils/foo' -> 'dist/foo')
    const pathAtImportee = subpath === '' ? location.outputEntryPoint : location.resolveSubpath(subpath)
    return this.computeRelativePath(pathToImporter, pathAtImportee)
  }

  private extractPackageName(specifier: string): string {
    const parts = specifier.split('/')
    const prefixLength = specifier.startsWith('@') ? 2 : 1
    return parts.slice(0, prefixLength).join('/')
  }

  private computeRelativePath(pathToImporter: string, pathToImportee: string): string {
    const absoluteTargetPath = path.join(this.outputDir, pathToImportee)
    let relative = path.relative(path.dirname(pathToImporter), absoluteTargetPath)
    if (!relative.startsWith('.')) {
      relative = './' + relative
    }
    return relative
  }
}
