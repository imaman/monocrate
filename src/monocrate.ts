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
  /**
   * Path to the package directory to bundle.
   * Can be absolute or relative. Relative paths are resolved from the cwd option.
   */
  pathToPackageToBundle: string
  /**
   * Path to the output directory where the bundle will be written.
   * Can be absolute or relative. Relative paths are resolved from the cwd option.
   * If not specified, a dedicated temp directory is created under the system temp directory.
   */
  outputDir?: string
  /**
   * Path to the monorepo root directory.
   * Can be absolute or relative. Relative paths are resolved from the cwd option.
   * If not specified, auto-detected by searching for a root package.json with workspaces.
   */
  monorepoRoot?: string
  /**
   * Publish the bundle to npm after building.
   * Accepts either an explicit semver version (e.g., "1.2.3") or an increment keyword ("patch", "minor", "major").
   * When specified, the bundle is published to npm with the resolved version.
   * If not specified, no publishing occurs.
   */
  publishToVersion?: string
  /**
   * Base directory for resolving relative paths. Must be a valid, existing directory.
   */
  cwd: string
}

const explicitVersionRegex = /^\d+\.\d+\.\d+$/

const VersionSpecifier = z.union([
  z.literal('patch'),
  z.literal('minor'),
  z.literal('major'),
  z.string().regex(explicitVersionRegex, 'Must be x.y.z format'),
])

type VersionSpecifier = z.infer<typeof VersionSpecifier>

function isExplicitVersion(value: string): boolean {
  return explicitVersionRegex.test(value)
}

function getCurrentPublishedVersion(packageName: string): string {
  const result = spawnSync('npm', ['view', packageName, 'version'], {
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
  // Resolve and validate cwd first, then use it to resolve all other paths
  const cwd = path.resolve(options.cwd)
  const cwdExists = await fs
    .stat(cwd)
    .then(() => true)
    .catch(() => false)
  if (!cwdExists) {
    throw new Error(`cwd does not exist: ${cwd}`)
  }

  const sourceDir = path.resolve(cwd, options.pathToPackageToBundle)
  const monorepoRoot = options.monorepoRoot ? path.resolve(cwd, options.monorepoRoot) : findMonorepoRoot(sourceDir)

  // Validate publish argument before any side effects
  let versionSpecifier: VersionSpecifier | undefined
  if (options.publishToVersion !== undefined) {
    const parseResult = VersionSpecifier.safeParse(options.publishToVersion)
    if (!parseResult.success) {
      throw new Error(
        `Invalid publish value: "${options.publishToVersion}". Expected "patch", "minor", "major" or an explicit version such as "1.2.3"`
      )
    }
    versionSpecifier = parseResult.data
  }

  const outputDir = options.outputDir
    ? path.resolve(cwd, options.outputDir)
    : await fs.mkdtemp(path.join(os.tmpdir(), 'monocrate-'))

  const graph = await buildDependencyGraph(sourceDir, monorepoRoot)

  await bundle(graph, monorepoRoot, outputDir)

  const packageJson = transformPackageJson(graph)

  if (!versionSpecifier) {
    await writePackageJson(packageJson, outputDir)
    return outputDir
  }

  // Publishing flow
  const packageName = graph.packageToBundle.packageJson.name

  if (isExplicitVersion(versionSpecifier)) {
    await writePackageJson({ ...packageJson, version: versionSpecifier }, outputDir)
  } else {
    const currentVersion = getCurrentPublishedVersion(packageName)
    await writePackageJson({ ...packageJson, version: currentVersion }, outputDir)

    // --no-git-tag-version: bump version in package.json only, without creating a git tag (we're in a temp directory, not a git repo)
    const npmVersionResult = spawnSync('npm', ['version', versionSpecifier, '--no-git-tag-version'], {
      cwd: outputDir,
      stdio: 'inherit',
    })
    if (npmVersionResult.status !== 0) {
      throw new Error(`npm version failed with exit code ${String(npmVersionResult.status ?? 1)}`)
    }
  }

  const npmPublishResult = spawnSync('npm', ['publish'], { cwd: outputDir, stdio: 'inherit' })
  if (npmPublishResult.status !== 0) {
    throw new Error(`npm publish failed with exit code ${String(npmPublishResult.status ?? 1)}`)
  }

  return outputDir
}
