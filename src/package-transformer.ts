import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { DependencyGraph } from './types.js'
import type { PackageJson } from './package-json.js'

export function transformPackageJson(graph: DependencyGraph): PackageJson {
  const source = graph.packageToBundle.packageJson

  // Start with a copy of source, then remove/replace fields we don't want
  const { dependencies: _deps, devDependencies: _devDeps, ...rest } = source

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
