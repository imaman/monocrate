import * as fsPromises from 'node:fs/promises'
import { buildPackageMap } from './package-map.js'
import { DistCopier } from './dist-copier.js'
import { ImportRewriter } from './import-rewriter.js'
import type { DependencyGraph } from './types.js'

export async function copyBundle(graph: DependencyGraph, monorepoRoot: string, outputDir: string): Promise<void> {
  await fsPromises.mkdir(outputDir, { recursive: true })

  const packageMap = buildPackageMap(graph, monorepoRoot)

  await new DistCopier(graph, packageMap, outputDir).copy()
  await new ImportRewriter(packageMap, outputDir).rewriteAll()
}
