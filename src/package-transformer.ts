import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { DependencyGraph, PackageJson } from './types.js'

export function transformPackageJson(graph: DependencyGraph): PackageJson {
  const source = graph.root.packageJson

  const transformed: PackageJson = {
    name: source.name,
    version: source.version,
  }

  if (source.main) {
    transformed.main = source.main
  }

  if (source.types) {
    transformed.types = source.types
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

  // exports is a passthrough field with complex structure, use bracket notation
  if ('exports' in source) {
    // eslint-disable-next-line @typescript-eslint/dot-notation
    ;(transformed as Record<string, unknown>)['exports'] = source['exports']
  }

  if (Object.keys(graph.allThirdPartyDeps).length > 0) {
    transformed.dependencies = { ...graph.allThirdPartyDeps }
  }

  return transformed
}

export async function writePackageJson(packageJson: PackageJson, outputDir: string): Promise<void> {
  const outputPath = path.join(outputDir, 'package.json')
  await fs.writeFile(outputPath, JSON.stringify(packageJson, null, 2) + '\n')
}
