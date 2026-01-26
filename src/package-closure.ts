import type { MonorepoPackage } from './repo-explorer.js'

/**
 * The transitive closure of packages needed to publish a monorepo package. Computed by traversing dependencies
 * starting from a subject package.
 */
export interface PackageClosure {
  /** The name of package we care about (the root of the closure). */
  subjectPackageName: string
  /** The subject package and its in-repo production dependencies (direct or transitive). */
  runtimeMembers: MonorepoPackage[]
  /** The subject package and its in-repo production and dev dependencies (direct or transitive). Is a superset of runtimeMembers. */
  compiletimeMembers: MonorepoPackage[]
  /** Merged third-party dependencies from all packages in the closure. */
  allThirdPartyDeps: Partial<Record<string, string>>
}
