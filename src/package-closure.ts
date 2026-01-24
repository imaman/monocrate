import type { MonorepoPackage } from './repo-explorer.js'

/**
 * The transitive closure of packages needed to publish a monorepo package. Computed by traversing dependencies
 * starting from a subject package.
 */
export interface PackageClosure {
  /** The name of package we care about (the root of the closure). */
  subjectPackageName: string
  /** The subject package all in-repo dependencies (direct or indirect dependencies). */
  members: MonorepoPackage[]
  /** Merged third-party dependencies from all packages in the closure. */
  allThirdPartyDeps: Partial<Record<string, string>>
}
