import * as path from 'node:path'
import { Project, SyntaxKind } from 'ts-morph'
import type { PackageMap } from './package-location.js'
import { resolveImport } from './collect-package-locations.js'
import type { AbsolutePath } from './paths.js'

export class ImportRewriter {
  constructor(
    private packageMap: PackageMap,
    private outputDir: AbsolutePath
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
    const { packageName, subPath } = this.extractPackageName(importSpecifier)
    const importeeLocation = this.packageMap.get(packageName)
    if (!importeeLocation) {
      return undefined
    }

    const pathAtImportee = resolveImport(importeeLocation.packageJson, subPath)
    return this.computeRelativePath(pathToImporter, path.join(importeeLocation.directoryInOutput, pathAtImportee))
  }

  private extractPackageName(specifier: string) {
    const parts = specifier.split('/')
    const cutoff = specifier.startsWith('@') ? 2 : 1
    return { packageName: parts.slice(0, cutoff).join('/'), subPath: parts.slice(cutoff).join('/') }
  }

  private computeRelativePath(importerPath: string, importeePath: string): string {
    const absoluteImporteePath = path.join(this.outputDir, importeePath)
    let relative = path.relative(path.dirname(importerPath), absoluteImporteePath)
    if (!relative.startsWith('.')) {
      relative = './' + relative
    }
    return relative
  }
}
