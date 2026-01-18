import * as fsPromises from 'node:fs/promises'
import { buildPackageMap } from './build-package-map.js'
import { DistCopier } from './dist-copier.js'
import { ImportRewriter } from './import-rewriter.js'
import type { DependencyGraph } from './types.js'

export async function copyBundle(graph: DependencyGraph, monorepoRoot: string, outputDir: string): Promise<void> {
  const { packageMap, errors } = buildPackageMap(graph, monorepoRoot)

  if (errors.length > 0) {
    const firstError = errors[0]
    if (firstError) {
      throw new Error(firstError.message)
    }
  }

  await fsPromises.mkdir(outputDir, { recursive: true })

  const copiedFiles = await new DistCopier(packageMap, outputDir).copy()
  await new ImportRewriter(packageMap, outputDir).rewriteAll(copiedFiles)
}
