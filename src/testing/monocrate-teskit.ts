import { execSync } from 'child_process'
import { unfolderify } from './unfolderify.js'
import { monocrate } from '../monocrate.js'
import path from 'node:path'
import type { PackageJson } from '../package-json.js'
import os from 'node:os'
import fs from 'node:fs'

export class MonocreateTeskit {
  async start() {}

  async shutdown() {}
}

export function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

interface PackageJsonOptions {
  name: string
  dependencies?: Record<string, string>
  transform?: (pkg: PackageJson) => void
}

/**
 * Creates a package.json object with sensible defaults for npm pack compatibility.
 * Required fields (name, version) are always included.
 */
export function makePackageJson(options: PackageJsonOptions): PackageJson {
  const pkg: PackageJson = {
    name: options.name,
    version: '1.0.0',
    main: 'dist/index.js',
  }

  if (options.dependencies !== undefined) {
    pkg.dependencies = options.dependencies
  }

  if (options.transform !== undefined) {
    options.transform(pkg)
  }

  return pkg
}

export async function runMonocrate(monorepoRoot: string, sourcePackage: string, entryPoint = 'dist/index.js') {
  const outputDir = createTempDir('monocrate-output-')

  await monocrate({
    cwd: monorepoRoot,
    pathToSubjectPackage: path.join(monorepoRoot, sourcePackage),
    outputDir,
    monorepoRoot,
  })

  let stdout = ''
  let stderr = ''
  try {
    stdout = execSync(`node --enable-source-maps ${path.join(outputDir, entryPoint)}`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    })
  } catch (error) {
    stderr = (error as { stderr?: string }).stderr ?? stderr
  }
  const output = unfolderify(outputDir)

  return { stdout, stderr, output }
}
