import * as fs from 'node:fs/promises'
import * as fsSync from 'node:fs'
import module from 'node:module'
import * as path from 'node:path'
import * as esbuild from 'esbuild'
import type { DependencyGraph, MonorepoPackage, PackageJson } from './types.js'
import { getExternalDependencies } from './dependency-graph.js'

const NODE_BUILTIN_MODULES = module.builtinModules.flatMap((m) => [m, `node:${m}`])

function findEntryPoint(packageDir: string, packageJson: PackageJson): string {
  const possibleEntries = [
    packageJson.source,
    packageJson.main,
    'src/index.ts',
    'src/index.js',
    'index.ts',
    'index.js',
  ].flatMap((at) => (at ? [at] : []))

  for (const entry of possibleEntries) {
    const fullPath = path.resolve(packageDir, entry)
    if (fsSync.existsSync(fullPath)) {
      return fullPath
    }
  }

  throw new Error(`Could not find entry point in ${packageDir}`)
}

function createInRepoResolverPlugin(inRepoDeps: MonorepoPackage[]): esbuild.Plugin {
  const packageMap = new Map<string, string>()
  for (const dep of inRepoDeps) {
    const entryPoint = findEntryPoint(dep.path, dep.packageJson)
    packageMap.set(dep.name, entryPoint)
  }

  return {
    name: 'in-repo-resolver',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        const resolved = packageMap.get(args.path)
        if (resolved) {
          return { path: resolved }
        }
        return null
      })
    },
  }
}

export async function bundle(graph: DependencyGraph, outputDir: string): Promise<void> {
  const entryPoint = findEntryPoint(graph.root.path, graph.root.packageJson)
  const externalDeps = getExternalDependencies(graph)
  const resolverPlugin = createInRepoResolverPlugin(graph.inRepoDeps)

  await fs.mkdir(outputDir, { recursive: true })

  await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    outfile: path.join(outputDir, 'index.js'),
    external: [...externalDeps, ...NODE_BUILTIN_MODULES],
    plugins: [resolverPlugin],
    sourcemap: false,
    minify: false,
  })
}
