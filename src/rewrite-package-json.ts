import * as fs from 'node:fs'
import * as path from 'node:path'
import type { PackageJson } from './package-json.js'
import type { PackageClosure } from './package-closure.js'

export function rewritePackageJson(closure: PackageClosure, version: string | undefined, outputDir: string) {
  const subject = closure.members.find((at) => at.name === closure.subjectPackageName)
  if (!subject) {
    throw new Error(`Incosistency in subject package name: "${closure.subjectPackageName}"`)
  }

  const { dependencies: _1, devDependencies: _2, ...rest } = subject.packageJson

  const rewritten: PackageJson = {
    ...rest,
  }

  if (version) {
    rewritten.version = version
  }

  // Replace dependencies with flattened third-party deps (no workspace deps)
  if (Object.keys(closure.allThirdPartyDeps).length > 0) {
    rewritten.dependencies = closure.allThirdPartyDeps
  }

  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(rewritten, null, 2) + '\n')
}
