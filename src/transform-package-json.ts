import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { PackageJson } from './package-json.js'
import type { PackageClosure } from './package-closure.js'

export function transformPackageJson(closure: PackageClosure): PackageJson {
  const source = closure.packagesToAssemble.find((at) => at.name === closure.subjectPackageName)?.packageJson
  if (!source) {
    throw new Error(`Incosistency in subject package name: "${closure.subjectPackageName}"`)
  }

  const { dependencies: _1, devDependencies: _2, ...rest } = source

  const transformed: PackageJson = {
    ...rest,
  }

  // Replace dependencies with flattened third-party deps (no workspace deps)
  if (Object.keys(closure.allThirdPartyDeps).length > 0) {
    transformed.dependencies = closure.allThirdPartyDeps
  }

  return transformed
}

export async function writePackageJson(packageJson: PackageJson, outputDir: string): Promise<void> {
  const outputPath = path.join(outputDir, 'package.json')
  await fs.writeFile(outputPath, JSON.stringify(packageJson, null, 2) + '\n')
}
