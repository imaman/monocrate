import { z } from 'zod'

export const PackageJsonSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  main: z.string().optional(),
  types: z.string().optional(),
  dependencies: z.record(z.string()).optional(),
  devDependencies: z.record(z.string()).optional(),
  peerDependencies: z.record(z.string()).optional(),
})

export type PackageJson = z.infer<typeof PackageJsonSchema> & Record<string, unknown>

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

export interface BundleResult {
  success: boolean
  outputDir?: string
  error?: string
}
