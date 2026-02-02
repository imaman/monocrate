import type { PackageLocation } from './package-location.js'

/**
 * Validates that all packages contain only ES module files.
 * Throws an error if any CommonJS files are found.
 *
 * This check happens early, before file copying, to fail fast.
 */
export function validateEsmOnly(locations: PackageLocation[]): void {
  for (const location of locations) {
    for (const file of location.filesToCopy) {
      validateFile(file, location)
    }
  }
}

function validateFile(file: string, location: PackageLocation): void {
  // .cjs and .d.cts files are always CommonJS
  if (file.endsWith('.cjs') || file.endsWith('.d.cts')) {
    throw new Error(
      `Cannot process CommonJS file: ${location.name}/${file}\n` +
        `Monocrate only supports ES modules. Use .mjs extension or set "type": "module" in package.json.`
    )
  }

  // .js files are CommonJS unless the package has "type": "module"
  if (file.endsWith('.js') && location.packageJson.type !== 'module') {
    throw new Error(
      `Cannot process CommonJS file: ${location.name}/${file}\n` +
        `Package "${location.name}" does not have "type": "module" in package.json.\n` +
        `Monocrate only supports ES modules. Set "type": "module" in package.json or use .mjs extension.`
    )
  }
}
