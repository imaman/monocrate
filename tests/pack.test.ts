import { describe, expect, it } from 'vitest';

import { pack } from '../src/pack.js';

describe('pack', () => {
  it('should return a PackResult with the expected structure', async () => {
    const result = await pack({
      packageName: 'test-package',
      outputDir: '/tmp/test-output',
    });

    expect(result).toHaveProperty('outputDir');
    expect(result).toHaveProperty('bundledDependencies');
    expect(result).toHaveProperty('dependencies');
    expect(result).toHaveProperty('devDependencies');
    expect(result).toHaveProperty('peerDependencies');
  });

  it('should use provided output directory', async () => {
    const outputDir = '/custom/output/dir';
    const result = await pack({
      packageName: 'test-package',
      outputDir,
    });

    expect(result.outputDir).toBe(outputDir);
  });

  it('should use default output directory when not provided', async () => {
    const result = await pack({
      packageName: 'test-package',
    });

    expect(result.outputDir).toBe('/tmp/monocrate-output');
  });

  it('should return empty bundled dependencies for placeholder', async () => {
    const result = await pack({
      packageName: 'test-package',
    });

    expect(result.bundledDependencies).toEqual([]);
  });

  it('should accept verbose option without error', async () => {
    const result = await pack({
      packageName: 'test-package',
      verbose: true,
    });

    expect(result).toBeDefined();
  });

  it('should accept dry run option without error', async () => {
    const result = await pack({
      packageName: 'test-package',
      dryRun: true,
    });

    expect(result).toBeDefined();
  });

  it('should handle verbose with dry run together', async () => {
    const result = await pack({
      packageName: 'test-package',
      verbose: true,
      dryRun: true,
    });

    expect(result).toBeDefined();
  });

  it('should return empty dependencies objects', async () => {
    const result = await pack({
      packageName: 'test-package',
    });

    expect(result.dependencies).toEqual({});
    expect(result.devDependencies).toEqual({});
    expect(result.peerDependencies).toEqual({});
  });
});
