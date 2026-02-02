import { describe, it, expect } from 'vitest'
import { monocrate } from '../index.js'
import { folderify } from '../testing/folderify.js'
import { unfolderify } from '../testing/unfolderify.js'
import { pj, runMonocrate } from '../testing/monocrate-teskit.js'

const name = 'root-package'

describe('file format support', () => {
  describe('.mjs and .cjs file handling', () => {
    it('rewrites imports in .mjs files', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app', {
          dependencies: { '@test/lib': '*' },
          type: 'module',
          main: 'dist/index.mjs',
        }),
        'packages/app/dist/index.mjs': `import { greet } from '@test/lib';
console.log(greet('World'));
`,
        'packages/lib/package.json': pj('@test/lib', {
          type: 'module',
          main: 'dist/index.mjs',
        }),
        'packages/lib/dist/index.mjs': `export function greet(name) {
  return 'Hello, ' + name + '!';
}
`,
      })

      const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app', {
        bump: '1.0.0',
        entryPoint: 'dist/index.mjs',
      })

      // Verify .mjs file has rewritten import
      const indexMjs = output['dist/index.mjs'] as string
      expect(indexMjs).toContain('../deps/__test__lib/dist/index.mjs')
      expect(indexMjs).not.toContain("'@test/lib'")

      expect(stdout.trim()).toBe('Hello, World!')
    })

    it('rewrites dynamic imports in .cjs files', async () => {
      // Note: The import rewriter only handles ES module syntax (import/export declarations
      // and dynamic import() calls). CommonJS require() calls are NOT rewritten.
      // This test verifies that dynamic import() works in .cjs files.
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app', {
          dependencies: { '@test/lib': '*' },
          type: 'commonjs',
          main: 'dist/index.cjs',
        }),
        'packages/app/dist/index.cjs': `(async () => {
  const { greet } = await import('@test/lib');
  console.log(greet('World'));
})();
`,
        'packages/lib/package.json': pj('@test/lib', {
          type: 'module',
          main: 'dist/index.mjs',
        }),
        'packages/lib/dist/index.mjs': `export function greet(name) {
  return 'Hello, ' + name + '!';
}
`,
      })

      const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app', {
        bump: '1.0.0',
        entryPoint: 'dist/index.cjs',
      })

      // Verify .cjs file has rewritten dynamic import
      const indexCjs = output['dist/index.cjs'] as string
      expect(indexCjs).toContain('../deps/__test__lib/dist/index.mjs')
      expect(indexCjs).not.toContain("'@test/lib'")

      expect(stdout.trim()).toBe('Hello, World!')
    })

    it('rewrites imports in .d.mts files', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app', {
          dependencies: { '@test/lib': '*' },
          type: 'module',
          main: 'dist/index.mjs',
          types: 'dist/index.d.mts',
        }),
        'packages/app/dist/index.mjs': `import { greet } from '@test/lib';
export const result = greet('World');
`,
        'packages/app/dist/index.d.mts': `import { greet } from '@test/lib';
export declare const result: ReturnType<typeof greet>;
`,
        'packages/lib/package.json': pj('@test/lib', {
          type: 'module',
          main: 'dist/index.mjs',
          types: 'dist/index.d.mts',
        }),
        'packages/lib/dist/index.mjs': `export function greet(name) {
  return 'Hello, ' + name + '!';
}
`,
        'packages/lib/dist/index.d.mts': `export declare function greet(name: string): string;
`,
      })

      const { outputDir } = await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/app',
        publish: false,
        bump: '1.0.0',
      })

      const output = unfolderify(outputDir)

      // Verify .d.mts file has rewritten import
      const indexDmts = output['dist/index.d.mts'] as string
      expect(indexDmts).toContain('../deps/__test__lib/dist/index.mjs')
      expect(indexDmts).not.toContain("'@test/lib'")
    })

    it('rewrites imports in .d.cts files', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app', {
          dependencies: { '@test/lib': '*' },
          type: 'commonjs',
          main: 'dist/index.cjs',
          types: 'dist/index.d.cts',
        }),
        'packages/app/dist/index.cjs': `const { greet } = require('@test/lib');
module.exports = { result: greet('World') };
`,
        'packages/app/dist/index.d.cts': `import { greet } from '@test/lib';
export declare const result: ReturnType<typeof greet>;
`,
        'packages/lib/package.json': pj('@test/lib', {
          type: 'commonjs',
          main: 'dist/index.cjs',
          types: 'dist/index.d.cts',
        }),
        'packages/lib/dist/index.cjs': `function greet(name) {
  return 'Hello, ' + name + '!';
}
module.exports = { greet };
`,
        'packages/lib/dist/index.d.cts': `export declare function greet(name: string): string;
`,
      })

      const { outputDir } = await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/app',
        publish: false,
        bump: '1.0.0',
      })

      const output = unfolderify(outputDir)

      // Verify .d.cts file has rewritten import
      const indexDcts = output['dist/index.d.cts'] as string
      expect(indexDcts).toContain('../deps/__test__lib/dist/index.cjs')
      expect(indexDcts).not.toContain("'@test/lib'")
    })
  })

  describe('main field pointing to .mjs/.cjs', () => {
    it('resolves package with main pointing to .mjs file', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app', {
          dependencies: { '@test/lib': '*' },
          main: 'dist/index.js',
        }),
        'packages/app/dist/index.js': `import { greet } from '@test/lib';
console.log(greet('World'));
`,
        'packages/lib/package.json': {
          name: '@test/lib',
          version: '1.0.0',
          main: 'dist/index.mjs',
        },
        'packages/lib/dist/index.mjs': `export function greet(name) {
  return 'Hello from mjs, ' + name + '!';
}
`,
      })

      const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app', { bump: '1.0.0' })

      // Verify import was rewritten to the .mjs file
      const indexJs = output['dist/index.js'] as string
      expect(indexJs).toContain('../deps/__test__lib/dist/index.mjs')

      expect(stdout.trim()).toBe('Hello from mjs, World!')
    })

    it('resolves package with main pointing to .cjs file', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app', {
          dependencies: { '@test/lib': '*' },
          main: 'dist/index.js',
        }),
        'packages/app/dist/index.js': `import { greet } from '@test/lib';
console.log(greet('World'));
`,
        'packages/lib/package.json': {
          name: '@test/lib',
          version: '1.0.0',
          main: 'dist/index.cjs',
        },
        'packages/lib/dist/index.cjs': `function greet(name) {
  return 'Hello from cjs, ' + name + '!';
}
module.exports = { greet };
`,
      })

      const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app', { bump: '1.0.0' })

      // Verify import was rewritten to the .cjs file
      const indexJs = output['dist/index.js'] as string
      expect(indexJs).toContain('../deps/__test__lib/dist/index.cjs')

      expect(stdout.trim()).toBe('Hello from cjs, World!')
    })
  })

  describe('conditional exports', () => {
    it('handles dual-format package with import/require conditions', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app', {
          dependencies: { '@test/lib': '*' },
          type: 'module',
          main: 'dist/index.js',
        }),
        'packages/app/dist/index.js': `import { greet } from '@test/lib';
console.log(greet('World'));
`,
        'packages/lib/package.json': {
          name: '@test/lib',
          version: '1.0.0',
          exports: {
            '.': {
              import: './dist/index.mjs',
              require: './dist/index.cjs',
            },
          },
        },
        'packages/lib/dist/index.mjs': `export function greet(name) {
  return 'Hello from ESM, ' + name + '!';
}
`,
        'packages/lib/dist/index.cjs': `function greet(name) {
  return 'Hello from CJS, ' + name + '!';
}
module.exports = { greet };
`,
      })

      const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app', { bump: '1.0.0' })

      // Verify import was rewritten (resolve.exports picks the appropriate condition)
      const indexJs = output['dist/index.js'] as string
      expect(indexJs).toContain('../deps/__test__lib/dist/index')
      expect(indexJs).not.toContain("'@test/lib'")

      // The output should work (exact greeting depends on which condition was picked)
      expect(stdout.trim()).toMatch(/Hello from (ESM|CJS), World!/)
    })

    it('handles subpath exports resolving to .mjs files', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app', {
          dependencies: { '@test/lib': '*' },
          main: 'dist/index.js',
        }),
        'packages/app/dist/index.js': `import { helper } from '@test/lib/utils';
console.log(helper());
`,
        'packages/lib/package.json': {
          name: '@test/lib',
          version: '1.0.0',
          exports: {
            '.': './dist/index.js',
            './utils': './dist/utils/helper.mjs',
          },
        },
        'packages/lib/dist/index.js': `export const main = 'main';
`,
        'packages/lib/dist/utils/helper.mjs': `export function helper() {
  return 'Helper from .mjs!';
}
`,
      })

      const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app', { bump: '1.0.0' })

      // Verify subpath import was rewritten to the .mjs file
      const indexJs = output['dist/index.js'] as string
      expect(indexJs).toContain('../deps/__test__lib/dist/utils/helper.mjs')
      expect(indexJs).not.toContain("'@test/lib/utils'")

      expect(stdout.trim()).toBe('Helper from .mjs!')
    })

    it('handles subpath exports resolving to .cjs files', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app', {
          dependencies: { '@test/lib': '*' },
          main: 'dist/index.js',
        }),
        'packages/app/dist/index.js': `import { helper } from '@test/lib/utils';
console.log(helper());
`,
        'packages/lib/package.json': {
          name: '@test/lib',
          version: '1.0.0',
          exports: {
            '.': './dist/index.js',
            './utils': './dist/utils/helper.cjs',
          },
        },
        'packages/lib/dist/index.js': `export const main = 'main';
`,
        'packages/lib/dist/utils/helper.cjs': `function helper() {
  return 'Helper from .cjs!';
}
module.exports = { helper };
`,
      })

      const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app', { bump: '1.0.0' })

      // Verify subpath import was rewritten to the .cjs file
      const indexJs = output['dist/index.js'] as string
      expect(indexJs).toContain('../deps/__test__lib/dist/utils/helper.cjs')
      expect(indexJs).not.toContain("'@test/lib/utils'")

      expect(stdout.trim()).toBe('Helper from .cjs!')
    })
  })

  describe('mixed file formats in dependencies', () => {
    it('handles in-repo dependency chain with mixed .mjs and .cjs files', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app', {
          dependencies: { '@test/esm-lib': '*' },
          type: 'module',
          main: 'dist/index.mjs',
        }),
        'packages/app/dist/index.mjs': `import { fromEsm } from '@test/esm-lib';
console.log(fromEsm());
`,
        'packages/esm-lib/package.json': pj('@test/esm-lib', {
          dependencies: { '@test/cjs-lib': '*' },
          type: 'module',
          main: 'dist/index.mjs',
        }),
        'packages/esm-lib/dist/index.mjs': `import { fromCjs } from '@test/cjs-lib';
export function fromEsm() {
  return 'ESM->' + fromCjs();
}
`,
        'packages/cjs-lib/package.json': {
          name: '@test/cjs-lib',
          version: '1.0.0',
          type: 'commonjs',
          main: 'dist/index.cjs',
        },
        'packages/cjs-lib/dist/index.cjs': `function fromCjs() {
  return 'CJS';
}
module.exports = { fromCjs };
`,
      })

      const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app', {
        bump: '1.0.0',
        entryPoint: 'dist/index.mjs',
      })

      // Verify app's .mjs file has rewritten import
      const appIndex = output['dist/index.mjs'] as string
      expect(appIndex).toContain('../deps/__test__esm-lib/dist/index.mjs')
      expect(appIndex).not.toContain("'@test/esm-lib'")

      // Verify esm-lib's .mjs file has rewritten import to cjs-lib
      const esmLibIndex = output['deps/__test__esm-lib/dist/index.mjs'] as string
      expect(esmLibIndex).toContain('../__test__cjs-lib/dist/index.cjs')
      expect(esmLibIndex).not.toContain("'@test/cjs-lib'")

      expect(stdout.trim()).toBe('ESM->CJS')
    })
  })
})
