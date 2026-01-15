import { describe, expect, it } from 'vitest';

import { pack } from '../src/index.js';

describe('index exports', () => {
  it('should export pack function', () => {
    expect(typeof pack).toBe('function');
  });

  it('should be able to call pack through index export', async () => {
    const result = await pack({
      packageName: 'test-package',
    });

    expect(result).toBeDefined();
    expect(result.outputDir).toBeDefined();
  });
});
