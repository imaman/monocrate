import * as path from 'node:path'
import { findMonorepoRoot } from './monorepo.js'
import { buildDependencyGraph } from './build-dependency-graph.js'
import { bundle } from './bundle.js'
import { transformPackageJson, writePackageJson } from './transform-package-json.js'

export interface MonocrateOptions {
  sourceDir: string
  outputDir: string
  monorepoRoot: string
}

export type MonocrateResult = { success: true; outputDir: string } | { success: false; error: string }

export async function monocrate(options: MonocrateOptions): Promise<MonocrateResult> {
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
