import * as fsPromises from 'node:fs/promises'
import { buildPackageMap } from './build-package-map.js'
import { DistCopier } from './dist-copier.js'
import { ImportRewriter } from './import-rewriter.js'
import type { DependencyGraph } from './build-dependency-graph.js'

export async function assemble(graph: DependencyGraph, monorepoRoot: string, outputDir: string): Promise<void> {
  const packageMap = buildPackageMap(graph, monorepoRoot)

  await fsPromises.mkdir(outputDir, { recursive: true })

  const copiedFiles = await new DistCopier(packageMap, outputDir).copy()
  await new ImportRewriter(packageMap, outputDir).rewriteAll(copiedFiles)
}
