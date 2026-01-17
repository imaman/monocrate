import * as fs from 'node:fs'
import * as fsPromises from 'node:fs/promises'
import * as path from 'node:path'
import { Project, SyntaxKind } from 'ts-morph'
import type { DependencyGraph, PackageLocation, PackageMap } from './types.js'

function getDistDir(main: string | undefined): string {
  const mainPath = main ?? 'dist/index.js'
  const dir = path.dirname(mainPath)
  return dir || 'dist'
}

function getEntryPoint(main: string | undefined): string {
  return main ?? 'dist/index.js'
}

export function buildPackageMap(graph: DependencyGraph, monorepoRoot: string): PackageMap {
  const packageMap: PackageMap = new Map()

  const rootRelativePath = path.relative(monorepoRoot, graph.root.path)
  packageMap.set(graph.root.name, {
    name: graph.root.name,
    monorepoRelativePath: rootRelativePath,
    entryPoint: getEntryPoint(graph.root.packageJson.main),
    distDir: getDistDir(graph.root.packageJson.main),
    isSourcePackage: true,
  })

  for (const dep of graph.inRepoDeps) {
    const depRelativePath = path.relative(monorepoRoot, dep.path)
    packageMap.set(dep.name, {
      name: dep.name,
      monorepoRelativePath: depRelativePath,
      entryPoint: getEntryPoint(dep.packageJson.main),
      distDir: getDistDir(dep.packageJson.main),
      isSourcePackage: false,
    })
  }

  return packageMap
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fsPromises.mkdir(dest, { recursive: true })
  const entries = await fsPromises.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      await fsPromises.copyFile(srcPath, destPath)
    }
  }
}

export async function copyDistDirectories(
  graph: DependencyGraph,
  packageMap: PackageMap,
  outputDir: string
): Promise<void> {
  const rootLocation = packageMap.get(graph.root.name)
  if (!rootLocation) {
    throw new Error(`Source package ${graph.root.name} not found in package map`)
  }

  const rootDistSrc = path.join(graph.root.path, rootLocation.distDir)
  const rootDistDest = path.join(outputDir, rootLocation.distDir)

  if (!fs.existsSync(rootDistSrc)) {
    throw new Error(`dist directory not found at ${rootDistSrc}. Did you run the build?`)
  }

  await copyDir(rootDistSrc, rootDistDest)

  for (const dep of graph.inRepoDeps) {
    const depLocation = packageMap.get(dep.name)
    if (!depLocation) {
      continue
    }

    const depDistSrc = path.join(dep.path, depLocation.distDir)
    const depDistDest = path.join(outputDir, 'deps', depLocation.monorepoRelativePath, depLocation.distDir)

    if (!fs.existsSync(depDistSrc)) {
      throw new Error(`dist directory not found at ${depDistSrc}. Did you run the build for ${dep.name}?`)
    }

    await copyDir(depDistSrc, depDistDest)
  }
}

function computeRelativePath(fromFile: string, target: PackageLocation, outputDir: string): string {
  const targetPath = target.isSourcePackage
    ? path.join(outputDir, target.entryPoint)
    : path.join(outputDir, 'deps', target.monorepoRelativePath, target.entryPoint)

  let relative = path.relative(path.dirname(fromFile), targetPath)
  if (!relative.startsWith('.')) {
    relative = './' + relative
  }
  return relative
}

function rewriteSpecifier(
  specifier: string,
  packageMap: PackageMap,
  fromFile: string,
  outputDir: string
): string | null {
  const exactMatch = packageMap.get(specifier)
  if (exactMatch) {
    return computeRelativePath(fromFile, exactMatch, outputDir)
  }

  for (const [pkgName, location] of packageMap) {
    if (specifier.startsWith(pkgName + '/')) {
      const subpath = specifier.slice(pkgName.length + 1)
      const basePath = location.isSourcePackage
        ? path.join(outputDir, location.distDir)
        : path.join(outputDir, 'deps', location.monorepoRelativePath, location.distDir)

      let relativePath = path.relative(path.dirname(fromFile), path.join(basePath, subpath))
      if (!relativePath.startsWith('.')) {
        relativePath = './' + relativePath
      }
      return relativePath
    }
  }

  return null
}

export async function rewriteImportsInFile(filePath: string, packageMap: PackageMap, outputDir: string): Promise<void> {
  const project = new Project({ useInMemoryFileSystem: false })
  const sourceFile = project.addSourceFileAtPath(filePath)

  let modified = false

  for (const decl of sourceFile.getImportDeclarations()) {
    const specifier = decl.getModuleSpecifierValue()
    const newSpecifier = rewriteSpecifier(specifier, packageMap, filePath, outputDir)
    if (newSpecifier) {
      decl.setModuleSpecifier(newSpecifier)
      modified = true
    }
  }

  for (const decl of sourceFile.getExportDeclarations()) {
    const specifier = decl.getModuleSpecifierValue()
    if (specifier) {
      const newSpecifier = rewriteSpecifier(specifier, packageMap, filePath, outputDir)
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
        const newSpecifier = rewriteSpecifier(specifier, packageMap, filePath, outputDir)
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

async function findAllJsAndDtsFiles(dir: string): Promise<string[]> {
  const files: string[] = []

  async function walk(currentDir: string): Promise<void> {
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

  await walk(dir)
  return files
}

export async function rewriteAllImports(outputDir: string, packageMap: PackageMap): Promise<void> {
  const files = await findAllJsAndDtsFiles(outputDir)

  for (const file of files) {
    await rewriteImportsInFile(file, packageMap, outputDir)
  }
}

export async function copyBundle(graph: DependencyGraph, monorepoRoot: string, outputDir: string): Promise<void> {
  await fsPromises.mkdir(outputDir, { recursive: true })

  const packageMap = buildPackageMap(graph, monorepoRoot)
  await copyDistDirectories(graph, packageMap, outputDir)
  await rewriteAllImports(outputDir, packageMap)
}
