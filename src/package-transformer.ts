import * as fs from 'node:fs'
import * as path from 'node:path'
import type { DependencyGraph, PackageJson } from './types.js'

export function transformPackageJson(graph: DependencyGraph): PackageJson {
  const source = graph.root.packageJson

  const transformed: PackageJson = {
    name: source.name,
    version: source.version,
    main: 'index.js',
  }

  const fieldsToPreserve = [
    'description',
    'keywords',
    'author',
    'license',
    'repository',
    'homepage',
    'bugs',
    'engines',
    'bin',
    'type',
  ] as const

  for (const field of fieldsToPreserve) {
    if (field in source) {
      ;(transformed as Record<string, unknown>)[field] = source[field as keyof PackageJson]
    }
  }

  if (Object.keys(graph.allThirdPartyDeps).length > 0) {
    transformed.dependencies = { ...graph.allThirdPartyDeps }
  }

  return transformed
}

export function writePackageJson(packageJson: PackageJson, outputDir: string): void {
  const outputPath = path.join(outputDir, 'package.json')
  fs.writeFileSync(outputPath, JSON.stringify(packageJson, null, 2) + '\n')
}
