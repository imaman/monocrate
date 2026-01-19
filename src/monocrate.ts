import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { z } from 'zod'
import { findMonorepoRoot } from './monorepo.js'
import { buildDependencyGraph } from './build-dependency-graph.js'
import { bundle } from './bundle.js'
import { transformPackageJson, writePackageJson } from './transform-package-json.js'

export interface MonocrateOptions {
  /** The source package directory to bundle */
  sourceDir: string
  /** Output directory for the bundle. Creates a dedicated temp directory if not specified. */
  outputDir?: string
  /** Monorepo root directory. Auto-detected if not specified. */
  monorepoRoot?: string
  /** Version bump and publish: explicit version (x.y.z) or increment (patch, minor, major) */
  publish?: string
}

const explicitVersionRegex = /^\d+\.\d+\.\d+$/

const PublishArg = z.union([
  z.literal('patch'),
  z.literal('minor'),
  z.literal('major'),
  z.string().regex(explicitVersionRegex, 'Must be x.y.z format'),
])

type PublishArg = z.infer<typeof PublishArg>

function isExplicitVersion(value: string): boolean {
  return explicitVersionRegex.test(value)
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

/**
 * Bundles a monorepo package and its in-repo dependencies for npm publishing.
 * @param options - Configuration options for the bundling process
 * @returns The output directory path where the bundle was created
 * @throws Error if bundling or publishing fails
 */
export async function monocrate(options: MonocrateOptions): Promise<string> {
  // Validate publish argument first, before any side effects
  let publishArg: PublishArg | undefined
  if (options.publish !== undefined) {
    const parseResult = PublishArg.safeParse(options.publish)
    if (!parseResult.success) {
      throw new Error(`Invalid --publish value: ${options.publish}. Expected x.y.z, patch, minor, or major`)
    }
    publishArg = parseResult.data
  }

  const sourceDir = path.resolve(options.sourceDir)
  const outputDir = options.outputDir
    ? path.resolve(options.outputDir)
    : await fs.mkdtemp(path.join(os.tmpdir(), 'monocrate-'))
  const monorepoRoot = options.monorepoRoot ? path.resolve(options.monorepoRoot) : findMonorepoRoot(sourceDir)

  const graph = await buildDependencyGraph(sourceDir, monorepoRoot)

  await bundle(graph, monorepoRoot, outputDir)

  let packageJson = transformPackageJson(graph)

  if (publishArg !== undefined) {
    const packageName = graph.packageToBundle.packageJson.name

    if (isExplicitVersion(publishArg)) {
      packageJson = { ...packageJson, version: publishArg }
    } else {
      const currentVersion = getCurrentPublishedVersion(packageName)
      packageJson = { ...packageJson, version: currentVersion }
    }
  }

  await writePackageJson(packageJson, outputDir)

  if (publishArg !== undefined && !isExplicitVersion(publishArg)) {
    const npmVersionResult = spawnSync('npm', ['version', publishArg, '--no-git-tag-version'], {
      cwd: outputDir,
      stdio: 'inherit',
    })
    if (npmVersionResult.status !== 0) {
      throw new Error(`npm version failed with exit code ${String(npmVersionResult.status ?? 1)}`)
    }
  }

  if (publishArg !== undefined) {
    const npmPublishResult = spawnSync('npm', ['publish'], {
      cwd: outputDir,
      stdio: 'inherit',
    })
    if (npmPublishResult.status !== 0) {
      throw new Error(`npm publish failed with exit code ${String(npmPublishResult.status ?? 1)}`)
    }
  }

  return outputDir
}
