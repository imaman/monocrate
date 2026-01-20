import * as fsPromises from 'node:fs/promises'
import { collectPackageLocations } from './collect-package-locations.js'
import { FileCopier } from './file-copier.js'
import { ImportRewriter } from './import-rewriter.js'
import type { DependencyGraph } from './build-dependency-graph.js'

export async function assemble(graph: DependencyGraph, monorepoRoot: string, outputDir: string): Promise<void> {
  const locations = collectPackageLocations(graph, monorepoRoot)
  const packageMap = new Map(locations.map((at) => [at.name, at] as const))

  await fsPromises.mkdir(outputDir, { recursive: true })

  const copiedFiles = await new FileCopier(packageMap, outputDir).copy()
  await new ImportRewriter(packageMap, outputDir).rewriteAll(copiedFiles)
}
