import { z } from 'zod'

export const PackageJsonSchema = z
  .object({
    name: z.string(),
    version: z.string().optional(),
    main: z.string().optional(),
    source: z.string().optional(),
    types: z.string().optional(),
    dependencies: z.record(z.string()).optional(),
    devDependencies: z.record(z.string()).optional(),
    peerDependencies: z.record(z.string()).optional(),
    description: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    author: z.union([z.string(), z.object({ name: z.string(), email: z.string().optional() })]).optional(),
    license: z.string().optional(),
    repository: z.union([z.string(), z.object({ type: z.string(), url: z.string() })]).optional(),
    homepage: z.string().optional(),
    bugs: z.union([z.string(), z.object({ url: z.string().optional(), email: z.string().optional() })]).optional(),
    engines: z.record(z.string()).optional(),
    bin: z.union([z.string(), z.record(z.string())]).optional(),
    type: z.enum(['module', 'commonjs']).optional(),
    workspaces: z.union([z.array(z.string()), z.object({ packages: z.array(z.string()) })]).optional(),
  })
  .passthrough()

export type PackageJson = z.infer<typeof PackageJsonSchema>

export interface MonorepoPackage {
  name: string
  path: string
  packageJson: PackageJson
}

export interface DependencyGraph {
  root: MonorepoPackage
  inRepoDeps: MonorepoPackage[]
  allThirdPartyDeps: Record<string, string>
}

export interface BundleOptions {
  sourceDir: string
  outputDir: string
  monorepoRoot: string
}

export type BundleResult = { success: true; outputDir: string } | { success: false; error: string }
