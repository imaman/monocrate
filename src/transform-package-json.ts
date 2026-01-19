import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { PackageJson } from './package-json.js'
import type { DependencyGraph } from './build-dependency-graph.js'

export function transformPackageJson(graph: DependencyGraph): PackageJson {
  const source = graph.subjectPackage.packageJson

  const { dependencies: _1, devDependencies: _2, ...rest } = source

  const transformed: PackageJson = {
    ...rest,
  }

  // Replace dependencies with flattened third-party deps (no workspace deps)
  if (Object.keys(graph.allThirdPartyDeps).length > 0) {
    transformed.dependencies = graph.allThirdPartyDeps
  }

  return transformed
}

export async function writePackageJson(packageJson: PackageJson, outputDir: string): Promise<void> {
  const outputPath = path.join(outputDir, 'package.json')
  await fs.writeFile(outputPath, JSON.stringify(packageJson, null, 2) + '\n')
}
