import * as fs from 'node:fs'
import * as path from 'node:path'
import * as esbuild from 'esbuild'
import type { DependencyGraph } from './types.js'
import { getExternalDependencies } from './dependency-graph.js'

function findEntryPoint(packageDir: string, packageJson: Record<string, unknown>): string {
  const possibleEntries = [
    packageJson.source,
    packageJson.main,
    'src/index.ts',
    'src/index.js',
    'index.ts',
    'index.js',
  ].filter((e): e is string => typeof e === 'string')

  for (const entry of possibleEntries) {
    const fullPath = path.resolve(packageDir, entry)
    if (fs.existsSync(fullPath)) {
      return fullPath
    }
  }

  throw new Error(`Could not find entry point in ${packageDir}`)
}

export async function bundle(graph: DependencyGraph, outputDir: string): Promise<void> {
  const entryPoint = findEntryPoint(graph.root.path, graph.root.packageJson)
  const externalDeps = getExternalDependencies(graph)

  fs.mkdirSync(outputDir, { recursive: true })

  const nodePrefixedBuiltins = [
    'node:assert',
    'node:buffer',
    'node:child_process',
    'node:cluster',
    'node:console',
    'node:constants',
    'node:crypto',
    'node:dgram',
    'node:dns',
    'node:domain',
    'node:events',
    'node:fs',
    'node:http',
    'node:http2',
    'node:https',
    'node:inspector',
    'node:module',
    'node:net',
    'node:os',
    'node:path',
    'node:perf_hooks',
    'node:process',
    'node:punycode',
    'node:querystring',
    'node:readline',
    'node:repl',
    'node:stream',
    'node:string_decoder',
    'node:sys',
    'node:timers',
    'node:tls',
    'node:trace_events',
    'node:tty',
    'node:url',
    'node:util',
    'node:v8',
    'node:vm',
    'node:wasi',
    'node:worker_threads',
    'node:zlib',
  ]

  await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    outfile: path.join(outputDir, 'index.js'),
    external: [...externalDeps, ...nodePrefixedBuiltins],
    sourcemap: false,
    minify: false,
  })
}
