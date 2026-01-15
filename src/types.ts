/**
 * Options for the pack operation
 */
export interface PackOptions {
  /**
   * Name of the package to pack
   */
  packageName: string;

  /**
   * Root directory of the monorepo workspace
   * If not provided, will be auto-detected by searching for workspace config
   */
  workspaceRoot?: string | undefined;

  /**
   * Output directory for the packed package
   * If not provided, a temporary directory will be created
   */
  outputDir?: string | undefined;

  /**
   * Workspace type to use (pnpm, npm, or yarn)
   * If not provided, will be auto-detected
   */
  workspaceType?: 'pnpm' | 'npm' | 'yarn' | undefined;

  /**
   * Enable verbose output
   */
  verbose?: boolean | undefined;

  /**
   * Perform a dry run without writing files
   */
  dryRun?: boolean | undefined;
}

/**
 * Result of the pack operation
 */
export interface PackResult {
  /**
   * Path to the output directory containing the packed package
   */
  outputDir: string;

  /**
   * List of in-repo dependencies that were bundled
   */
  bundledDependencies: string[];

  /**
   * Merged third-party dependencies
   */
  dependencies: Record<string, string>;

  /**
   * Merged third-party devDependencies (if any)
   */
  devDependencies: Record<string, string>;

  /**
   * Merged third-party peerDependencies (if any)
   */
  peerDependencies: Record<string, string>;
}

/**
 * Supported workspace types
 */
export type WorkspaceType = 'pnpm' | 'npm' | 'yarn';

/**
 * Information about a package in the workspace
 */
export interface WorkspacePackage {
  /**
   * Package name from package.json
   */
  name: string;

  /**
   * Absolute path to the package directory
   */
  path: string;

  /**
   * Package version
   */
  version: string;

  /**
   * Dependencies from package.json
   */
  dependencies: Record<string, string>;

  /**
   * DevDependencies from package.json
   */
  devDependencies: Record<string, string>;

  /**
   * PeerDependencies from package.json
   */
  peerDependencies: Record<string, string>;
}

/**
 * Detected workspace configuration
 */
export interface WorkspaceConfig {
  /**
   * Type of workspace (pnpm, npm, yarn)
   */
  type: WorkspaceType;

  /**
   * Root directory of the workspace
   */
  root: string;

  /**
   * Lock file path
   */
  lockFile: string;

  /**
   * All packages in the workspace
   */
  packages: WorkspacePackage[];
}

/**
 * Error thrown when a version conflict is detected
 */
export class VersionConflictError extends Error {
  constructor(
    public readonly packageName: string,
    public readonly conflicts: Array<{ source: string; version: string }>
  ) {
    const conflictDetails = conflicts
      .map((c) => `  ${c.source} requires "${c.version}"`)
      .join('\n');

    super(
      `Dependency version conflict detected for "${packageName}":\n${conflictDetails}\n\n` +
        `Resolve the conflict by aligning all packages to use the same version.`
    );
    this.name = 'VersionConflictError';
  }
}

/**
 * Error thrown when workspace detection fails
 */
export class WorkspaceDetectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceDetectionError';
  }
}

/**
 * Error thrown when lock file doesn't match workspace type
 */
export class LockFileMismatchError extends Error {
  constructor(
    public readonly detectedType: WorkspaceType,
    public readonly expectedLockFile: string,
    public readonly foundLockFile: string | null
  ) {
    super(
      `Workspace type mismatch detected\n\n` +
        `  Detected workspace type: ${detectedType}\n` +
        `  Expected lock file: ${expectedLockFile}\n` +
        `  Found lock file: ${foundLockFile ?? 'none'}\n\n` +
        `Ensure your workspace configuration matches your package manager.`
    );
    this.name = 'LockFileMismatchError';
  }
}
