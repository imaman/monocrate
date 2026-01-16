#!/usr/bin/env node
/**
 * Monocrate CLI - From monorepo to npm in one command
 *
 * Main entry point for the command-line interface.
 */

import { runMain } from 'citty'
import { bundleCommand, findMonorepoRoot, EXIT_CODES } from './commands/bundle.js'

// ============================================================================
// Run CLI
// ============================================================================

void runMain(bundleCommand)

// Export for testing
export { findMonorepoRoot, bundleCommand, EXIT_CODES }
