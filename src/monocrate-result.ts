export interface MonocrateResult {
  /**
   * The output directory path where the assembly of the first package was created.
   */
  outputDir: string
  /**
   * The new version (AKA: 'resolved version') for the package (or packages).
   */
  resolvedVersion: string
  /**
   * Details about each individual package that was assembled/published.
   */
  summaries: { packageName: string; outputDir: string }[]
}
