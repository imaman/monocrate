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
    const { packageName, pathInPackage } = this.parseSpecifier(specifier)
    if (packageName === null) {
      return null
    }

    const location = this.packageMap.get(packageName)
    if (!location) {
      return null
    }

    // Case 1: Exact package match (no subpath)
    // Handles imports that reference the package entry point directly:
    //   import { foo } from '@myorg/utils'
    if (pathInPackage === null) {
      return this.computeRelativePath(fromFile, location.outputEntryPoint)
    }

    // Case 2: Subpath imports
    // Handles imports that reference files within a package:
    //   import { bar } from '@myorg/utils/lib/helpers.js'
    const targetPath = location.resolveSubpath(pathInPackage)
    return this.computeRelativePath(fromFile, targetPath)
  }

  private parseSpecifier(specifier: string): { packageName: string | null; pathInPackage: string | null } {
    // For scoped packages (@org/name), package name includes everything up to the 2nd "/"
    // For regular packages (name), package name is everything up to the 1st "/"
    if (specifier.startsWith('@')) {
      const secondSlash = specifier.indexOf('/', specifier.indexOf('/') + 1)
      if (secondSlash === -1) {
        return { packageName: specifier, pathInPackage: null }
      }
      return { packageName: specifier.slice(0, secondSlash), pathInPackage: specifier.slice(secondSlash + 1) }
    }

    const firstSlash = specifier.indexOf('/')
    if (firstSlash === -1) {
      return { packageName: specifier, pathInPackage: null }
    }
    return { packageName: specifier.slice(0, firstSlash), pathInPackage: specifier.slice(firstSlash + 1) }
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
