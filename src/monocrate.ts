import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { findMonorepoRoot } from './monorepo.js'
import { buildDependencyGraph } from './build-dependency-graph.js'
import { bundle } from './bundle.js'
import { transformPackageJson, writePackageJson } from './transform-package-json.js'

export interface MonocrateOptions {
  sourceDir: string
  outputDir?: string
  monorepoRoot?: string
  publish?: string
}

export type MonocrateResult = { success: true; outputDir: string } | { success: false; error: string }

const validIncrements = ['patch', 'minor', 'major'] as const

function isExplicitVersion(value: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(value)
}

function getCurrentPublishedVersion(packageName: string): string {
  const result = spawnSync('npm', ['info', packageName, 'version'], {
    encoding: 'utf-8',
  })
  if (result.status !== 0 || !result.stdout.trim()) {
    return '0.0.0'
  }
  return result.stdout.trim()
}

async function setPackageVersion(outputDir: string, version: string): Promise<void> {
  const pkgPath = path.join(outputDir, 'package.json')
  const content = await fs.readFile(pkgPath, 'utf-8')
  const pkg = JSON.parse(content) as { version?: string }
  pkg.version = version
  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
}

async function readPackageName(outputDir: string): Promise<string> {
  const pkgPath = path.join(outputDir, 'package.json')
  const content = await fs.readFile(pkgPath, 'utf-8')
  const pkg = JSON.parse(content) as { name?: string }
  if (!pkg.name) {
    throw new Error('package.json is missing "name" field')
  }
  return pkg.name
}

export async function monocrate(options: MonocrateOptions): Promise<MonocrateResult> {
  try {
    const sourceDir = path.resolve(options.sourceDir)
    const outputDir = options.outputDir
      ? path.resolve(options.outputDir)
      : await fs.mkdtemp(path.join(os.tmpdir(), 'monocrate-'))
    const monorepoRoot = options.monorepoRoot ? path.resolve(options.monorepoRoot) : findMonorepoRoot(sourceDir)

    const graph = await buildDependencyGraph(sourceDir, monorepoRoot)

    await bundle(graph, monorepoRoot, outputDir)

    const packageJson = transformPackageJson(graph)
    await writePackageJson(packageJson, outputDir)

    if (options.publish !== undefined) {
      const versionArg = options.publish

      if (!isExplicitVersion(versionArg) && !validIncrements.includes(versionArg as (typeof validIncrements)[number])) {
        throw new Error(`Invalid --publish value: ${versionArg}. Expected x.y.z, patch, minor, or major`)
      }

      const packageName = await readPackageName(outputDir)

      if (isExplicitVersion(versionArg)) {
        await setPackageVersion(outputDir, versionArg)
      } else {
        const currentVersion = getCurrentPublishedVersion(packageName)
        await setPackageVersion(outputDir, currentVersion)

        const npmVersionResult = spawnSync('npm', ['version', versionArg, '--no-git-tag-version'], {
          cwd: outputDir,
          stdio: 'inherit',
        })
        if (npmVersionResult.status !== 0) {
          throw new Error(`npm version failed with exit code ${String(npmVersionResult.status ?? 1)}`)
        }
      }

      const npmPublishResult = spawnSync('npm', ['publish'], {
        cwd: outputDir,
        stdio: 'inherit',
      })
      if (npmPublishResult.status !== 0) {
        throw new Error(`npm publish failed with exit code ${String(npmPublishResult.status ?? 1)}`)
      }
    }

    return {
      success: true,
      outputDir,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? (error.stack ?? error.message) : String(error),
    }
  }
}
