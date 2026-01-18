import * as path from 'node:path'
import { findMonorepoRoot } from './monorepo.js'
import { buildDependencyGraph } from './dependency-graph.js'
import { bundle } from './bundle.js'
import { transformPackageJson, writePackageJson } from './transform-package-json.js'
import type { BundleOptions, BundleResult } from './types.js'

export async function monocrate(options: BundleOptions): Promise<BundleResult> {
  try {
    const sourceDir = path.resolve(options.sourceDir)
    const outputDir = path.resolve(options.outputDir)
    const monorepoRoot = options.monorepoRoot ? path.resolve(options.monorepoRoot) : findMonorepoRoot(sourceDir)

    const graph = await buildDependencyGraph(sourceDir, monorepoRoot)

    await bundle(graph, monorepoRoot, outputDir)

    const packageJson = transformPackageJson(graph)
    await writePackageJson(packageJson, outputDir)

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
