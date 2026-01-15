#!/usr/bin/env node

import { Command } from 'commander';

import { pack } from './pack.js';

const program = new Command();

program
  .name('monocrate')
  .description('Bundle monorepo packages for npm publishing')
  .version('0.0.0');

program
  .command('pack <package>')
  .description('Pack a package and its in-repo dependencies for publishing')
  .option('-o, --output <dir>', 'Output directory')
  .option(
    '-w, --workspace-type <type>',
    'Workspace type (pnpm, npm, yarn)',
    undefined
  )
  .option('-d, --dry-run', 'Show what would be packed without writing files')
  .option('-v, --verbose', 'Enable verbose output')
  .action(
    async (
      packageName: string,
      options: {
        output?: string;
        workspaceType?: 'pnpm' | 'npm' | 'yarn';
        dryRun?: boolean;
        verbose?: boolean;
      }
    ) => {
      try {
        const result = await pack({
          packageName,
          outputDir: options.output,
          workspaceType: options.workspaceType,
          dryRun: options.dryRun,
          verbose: options.verbose,
        });

        // eslint-disable-next-line no-console
        console.log(`\nPackage packed successfully!`);
        // eslint-disable-next-line no-console
        console.log(`Output: ${result.outputDir}`);

        if (result.bundledDependencies.length > 0) {
          // eslint-disable-next-line no-console
          console.log(
            `\nBundled ${result.bundledDependencies.length} in-repo dependencies:`
          );
          for (const dep of result.bundledDependencies) {
            // eslint-disable-next-line no-console
            console.log(`  - ${dep}`);
          }
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          `\nError: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        process.exit(1);
      }
    }
  );

program
  .command('list-deps <package>')
  .description('List all dependencies of a package')
  .option('-v, --verbose', 'Enable verbose output')
  .action((packageName: string, options: { verbose?: boolean }) => {
    if (options.verbose === true) {
      // eslint-disable-next-line no-console
      console.log(`Listing dependencies for: ${packageName}`);
    }
    // TODO: Implement dependency listing
    // eslint-disable-next-line no-console
    console.log('Not yet implemented');
  });

program
  .command('validate <package>')
  .description('Validate a package can be packed')
  .option('-v, --verbose', 'Enable verbose output')
  .action((packageName: string, options: { verbose?: boolean }) => {
    if (options.verbose === true) {
      // eslint-disable-next-line no-console
      console.log(`Validating package: ${packageName}`);
    }
    // TODO: Implement validation
    // eslint-disable-next-line no-console
    console.log('Not yet implemented');
  });

program.parse();
