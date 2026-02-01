import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { monocrate } from './index.js'
import { RepoExplorer } from './repo-explorer.js'
import { AbsolutePath } from './paths.js'
import * as publishModule from './publish.js'
import { folderify } from './testing/folderify.js'
import { unfolderify } from './testing/unfolderify.js'
import { createTempDir, initGitRepo, pj, runMonocrate } from './testing/monocrate-teskit.js'

const name = 'root-package'

describe('monocrate', () => {
  describe('optional output directory', () => {
    it('creates a temp directory when outputDir is not provided', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app'),
        'packages/app/dist/index.js': `export const foo = 'foo';`,
      })

      const result = await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: path.join(monorepoRoot, 'packages/app'),
        monorepoRoot,
        publish: false,
        bump: '2.8.512',
      })

      // Verify a temp directory was created
      expect(result.outputDir).toContain('monocrate-')
      expect(fs.existsSync(result.outputDir)).toBe(true)

      // Verify the assembly was created there
      expect(unfolderify(result.outputDir)['package.json']).toEqual({
        name: '@test/app',
        version: '2.8.512',
        main: 'dist/index.js',
      })
    })

    it('uses provided outputRoot when specified', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app'),
        'packages/app/dist/index.js': `export const foo = 'foo';
`,
      })

      const specifiedOutputRoot = createTempDir('monocrate-explicit-output-')
      const { outputDir } = await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: path.join(monorepoRoot, 'packages/app'),
        outputRoot: specifiedOutputRoot,
        monorepoRoot,
        publish: false,
        bump: '2.8.512',
      })

      expect(path.dirname(outputDir)).toBe(specifiedOutputRoot)
    })
  })

  describe('monorepo discovery', () => {
    it('finds monorepo root with npm workspaces', () => {
      const monorepoRoot = folderify({
        'package.json': { name: 'my-monorepo', workspaces: ['packages/*'] },
        'packages/app/package.json': { name: '@test/app' },
      })

      const found = RepoExplorer.findMonorepoRoot(AbsolutePath(path.join(monorepoRoot, 'packages/app')))
      expect(found).toBe(monorepoRoot)
    })

    it('finds monorepo root with pnpm workspaces', () => {
      const monorepoRoot = folderify({
        'package.json': { name: 'pnpm-root' },
        'pnpm-workspace.yaml': `packages:
  - 'packages/*'
`,
        'packages/app/package.json': { name: '@test/app' },
      })

      const found = RepoExplorer.findMonorepoRoot(AbsolutePath(path.join(monorepoRoot, 'packages/app')))
      expect(found).toBe(monorepoRoot)
    })

    it('throws when no monorepo root is found', () => {
      const tempDir = createTempDir('no-monorepo-')
      fs.mkdirSync(path.join(tempDir, 'some-package'))

      expect(() => RepoExplorer.findMonorepoRoot(AbsolutePath(path.join(tempDir, 'some-package')))).toThrow(
        'Could not find monorepo root'
      )
    })
  })

  describe('error handling', () => {
    it('handles package with no dist directory (npm pack includes only package.json)', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app'),
        // No dist directory created - npm pack will still succeed with just package.json
      })

      const { outputDir } = await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/app',
        monorepoRoot,
        publish: false,
        bump: '2.8.512',
      })

      const output = unfolderify(outputDir)
      // npm pack always includes package.json
      expect(output).toHaveProperty('package.json')
      // dist won't exist since it wasn't created
      expect(output).not.toHaveProperty('dist/index.js')
    })

    it('throws when package.json is invalid JSON syntax', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': 'invalid json {{{',
      })

      await expect(
        monocrate({
          cwd: monorepoRoot,
          pathToSubjectPackages: 'packages/app',
          monorepoRoot,
          publish: false,
          bump: '2.8.512',
        })
      ).rejects.toThrow('Unexpected token')
    })

    it('throws when package.json fails schema validation', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        // Missing required 'name' field
        'packages/app/package.json': { version: '1.0.0', main: 'dist/index.js' },
      })

      await expect(
        monocrate({
          cwd: monorepoRoot,
          pathToSubjectPackages: 'packages/app',
          monorepoRoot,
          publish: false,
          bump: '2.8.512',
        })
      ).rejects.toThrow('Invalid package.json')
    })

    it('throws when source package directory has no package.json', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        // No packages/app/package.json
      })

      await expect(
        monocrate({
          cwd: monorepoRoot,
          pathToSubjectPackages: 'packages/app',
          publish: false,
          bump: '2.8.512',
        })
      ).rejects.toThrow(`Unrecognized package source dir: "${monorepoRoot}/packages/app"`)
    })
    it('throws when a package is located outside the monorepo root', async () => {
      // Create an external package outside the monorepo
      const externalPackage = folderify({
        'package.json': { name: '@test/external', version: '1.0.0', main: 'dist/index.js' },
        'dist/index.js': `export const external = 'external';`,
      })

      // Create monorepo with a symlink to the external package
      const monorepoRoot = folderify({
        'package.json': { workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app'),
        'packages/app/dist/index.js': `export const foo = 'foo';`,
      })

      // Create symlink to external package inside the monorepo
      fs.symlinkSync(externalPackage, path.join(monorepoRoot, 'packages/external'))

      await expect(
        monocrate({
          cwd: monorepoRoot,
          pathToSubjectPackages: path.join(monorepoRoot, 'packages/app'),
          monorepoRoot,
          publish: false,
          bump: '2.4.6',
        })
      ).rejects.toThrow(/Package "@test\/external" is located at .* which is outside the monorepo root/)
    })
    it('works with workspace object format (packages field)', async () => {
      const monorepoRoot = folderify({
        'package.json': { workspaces: { packages: ['packages/*'] } },
        'packages/app/package.json': pj('@test/app', { dependencies: { '@test/lib': 'workspace:*' } }),
        'packages/app/dist/index.js': `import { greet } from '@test/lib'; console.log(greet());`,
        'packages/lib/package.json': pj('@test/lib'),
        'packages/lib/dist/index.js': `export function greet() { return 'Hello!' }`,
      })
      const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app')

      expect(output['package.json']).toEqual({
        name: '@test/app',
        version: '2.8.512',
        main: 'dist/index.js',
      })

      expect(stdout.trim()).toBe('Hello!')
    })
  })

  describe('package.json transformation', () => {
    it('preserves exports field in package.json', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app', undefined, {
          types: 'dist/index.d.ts',
          exports: {
            '.': {
              types: './dist/index.d.ts',
              import: './dist/index.js',
            },
          },
        }),
        'packages/app/dist/index.js': `export const foo = 'foo';
`,
        'packages/app/dist/index.d.ts': `export declare const foo: string;
`,
      })

      const { outputDir } = await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/app',
        publish: false,
        bump: '2.8.512',
      })

      const pkgJson = unfolderify(outputDir)['package.json'] as Record<string, unknown>

      expect(pkgJson.exports).toEqual({
        '.': {
          types: './dist/index.d.ts',
          import: './dist/index.js',
        },
      })
    })

    it('preserves metadata fields like description and keywords', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': {
          name: '@test/app',
          version: '1.0.0',
          main: 'dist/index.js',
          description: 'Test package',
          keywords: ['test', 'example'],
          author: 'Test Author',
          license: 'MIT',
        },
        'packages/app/dist/index.js': `export const foo = 'foo';`,
      })

      const { outputDir } = await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/app',
        publish: false,
        bump: '2.8.512',
      })

      const output = unfolderify(outputDir)
      const pkgJson = output['package.json'] as Record<string, unknown>

      expect(pkgJson.description).toBe('Test package')
      expect(pkgJson.keywords).toEqual(['test', 'example'])
      expect(pkgJson.author).toBe('Test Author')
      expect(pkgJson.license).toBe('MIT')
    })
  })

  describe('monocrate e2e', () => {
    it('assembles a simple package with an in-repo dependency', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': {
          name: '@test/app',
          version: '1.0.0',
          main: 'dist/index.js',
          types: 'dist/index.d.ts',
          dependencies: {
            '@test/lib': 'workspace:*',
            chalk: '^5.0.0',
          },
        },
        'packages/app/dist/index.js': `import { greet } from '@test/lib'; console.log(greet('World'));`,
        'packages/app/dist/index.d.ts': `import { greet } from '@test/lib';`,
        'packages/lib/package.json': {
          name: '@test/lib',
          version: '1.0.0',
          main: 'dist/index.js',
          types: 'dist/index.d.ts',
          dependencies: {
            lodash: '^4.17.21',
          },
        },
        'packages/lib/dist/index.js': `export function greet(name) { return 'Hello, ' + name + '!'; }`,
        'packages/lib/dist/index.d.ts': `export declare function greet(name: string): string;`,
      })

      const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app', { bump: '4.256.16384' })

      expect(output['package.json']).toEqual({
        name: '@test/app',
        version: '4.256.16384',
        main: 'dist/index.js',
        types: 'dist/index.d.ts',
        dependencies: {
          chalk: '^5.0.0',
          lodash: '^4.17.21',
        },
      })

      expect(stdout.trim()).toBe('Hello, World!')
    })

    it('assembles only the requested package when monorepo has multiple packages', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        // First app with its own lib and external dep
        'packages/app-alpha/package.json': {
          name: '@test/app-alpha',
          version: '1.0.0',
          main: 'dist/index.js',
          dependencies: {
            '@test/lib-alpha': 'workspace:*',
            chalk: '^5.0.0',
          },
        },
        'packages/app-alpha/dist/index.js': `import { getAlpha } from '@test/lib-alpha'; console.log('Alpha: ' + getAlpha());`,
        'packages/lib-alpha/package.json': {
          name: '@test/lib-alpha',
          version: '1.0.0',
          main: 'dist/index.js',
          dependencies: {
            lodash: '^4.17.21',
          },
        },
        'packages/lib-alpha/dist/index.js': `export function getAlpha() { return 'ALPHA' }`,
        // Second app with its own lib and different external dep
        'packages/app-beta/package.json': {
          name: '@test/app-beta',
          version: '2.0.0',
          main: 'dist/index.js',
          dependencies: {
            '@test/lib-beta': 'workspace:*',
            zod: '^3.0.0',
          },
        },
        'packages/app-beta/dist/index.js': `import { getBeta } from '@test/lib-beta'; console.log('Beta: ' + getBeta());`,
        'packages/lib-beta/package.json': {
          name: '@test/lib-beta',
          version: '2.0.0',
          main: 'dist/index.js',
          dependencies: {
            uuid: '^9.0.0',
          },
        },
        'packages/lib-beta/dist/index.js': `export function getBeta() { return 'BETA'; }`,
      })

      // Assemble only app-alpha
      const alpha = await runMonocrate(monorepoRoot, 'packages/app-alpha', { bump: '4.16.64' })

      expect(alpha.output['package.json']).toEqual({
        name: '@test/app-alpha',
        version: '4.16.64',
        main: 'dist/index.js',
        dependencies: {
          chalk: '^5.0.0',
          lodash: '^4.17.21',
        },
      })
      expect(alpha.stdout.trim()).toBe('Alpha: ALPHA')

      // Assemble only app-beta
      const beta = await runMonocrate(monorepoRoot, 'packages/app-beta', { bump: '5.25.125' })

      expect(beta.output['package.json']).toEqual({
        name: '@test/app-beta',
        version: '5.25.125',
        main: 'dist/index.js',
        dependencies: {
          zod: '^3.0.0',
          uuid: '^9.0.0',
        },
      })
      expect(beta.stdout.trim()).toBe('Beta: BETA')
    }, 30000)

    it('assembles deep chain of in-repo dependencies', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': {
          name: '@test/app',
          version: '1.0.0',
          main: 'dist/index.js',
          dependencies: {
            '@test/level1': 'workspace:*',
            express: '^4.18.0',
          },
        },
        'packages/app/dist/index.js': `import { fromLevel1 } from '@test/level1';
console.log(fromLevel1());
`,
        'packages/level1/package.json': {
          name: '@test/level1',
          version: '1.0.0',
          main: 'dist/index.js',
          dependencies: {
            '@test/level2': 'workspace:*',
            lodash: '^4.17.21',
          },
        },
        'packages/level1/dist/index.js': `import { fromLevel2 } from '@test/level2';
export function fromLevel1() {
  return 'L1->' + fromLevel2();
}
`,
        'packages/level2/package.json': {
          name: '@test/level2',
          version: '1.0.0',
          main: 'dist/index.js',
          dependencies: {
            '@test/level3': 'workspace:*',
            chalk: '^5.0.0',
          },
        },
        'packages/level2/dist/index.js': `import { fromLevel3 } from '@test/level3';
export function fromLevel2() {
  return 'L2->' + fromLevel3();
}
`,
        'packages/level3/package.json': {
          name: '@test/level3',
          version: '1.0.0',
          main: 'dist/index.js',
          dependencies: {
            '@test/level4': 'workspace:*',
            zod: '^3.0.0',
          },
        },
        'packages/level3/dist/index.js': `import { fromLevel4 } from '@test/level4';
export function fromLevel3() {
  return 'L3->' + fromLevel4();
}
`,
        'packages/level4/package.json': {
          name: '@test/level4',
          version: '1.0.0',
          main: 'dist/index.js',
          dependencies: {
            uuid: '^9.0.0',
          },
        },
        'packages/level4/dist/index.js': `export function fromLevel4() {
  return 'L4';
}
`,
      })

      const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app', { bump: '4.16.64' })

      expect(output['package.json']).toEqual({
        name: '@test/app',
        version: '4.16.64',
        main: 'dist/index.js',
        dependencies: {
          express: '^4.18.0',
          lodash: '^4.17.21',
          chalk: '^5.0.0',
          zod: '^3.0.0',
          uuid: '^9.0.0',
        },
      })

      expect(stdout.trim()).toBe('L1->L2->L3->L4')
    }, 30000)

    it('works with pnpm workspaces', async () => {
      const monorepoRoot = folderify({
        'package.json': { name: 'pnpm-monorepo' },
        'pnpm-workspace.yaml': `packages:
  - 'packages/*'
`,
        'packages/app/package.json': {
          name: '@test/pnpm-app',
          version: '1.0.0',
          main: 'dist/index.js',
          dependencies: {
            '@test/pnpm-lib': 'workspace:*',
            chalk: '^5.0.0',
          },
        },
        'packages/app/dist/index.js': `import { pnpmGreet } from '@test/pnpm-lib';
console.log(pnpmGreet());
`,
        'packages/lib/package.json': {
          name: '@test/pnpm-lib',
          version: '1.0.0',
          main: 'dist/index.js',
          dependencies: {
            lodash: '^4.17.21',
          },
        },
        'packages/lib/dist/index.js': `export function pnpmGreet() {
  return 'pnpm works!';
}
`,
      })

      const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app', { bump: '9.81.729' })

      expect(output['package.json']).toEqual({
        name: '@test/pnpm-app',
        version: '9.81.729',
        main: 'dist/index.js',
        dependencies: {
          chalk: '^5.0.0',
          lodash: '^4.17.21',
        },
      })

      expect(stdout.trim()).toBe('pnpm works!')
    })

    it('excludes devDependencies from the output', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': {
          name: '@test/app',
          version: '1.0.0',
          main: 'dist/index.js',
          dependencies: {
            '@test/lib': 'workspace:*',
            chalk: '^5.0.0',
          },
          devDependencies: {
            vitest: '^1.0.0',
            typescript: '^5.0.0',
          },
        },
        'packages/app/dist/index.js': `import { greet } from '@test/lib';
console.log(greet('World'));
`,
        'packages/lib/package.json': {
          name: '@test/lib',
          version: '1.0.0',
          main: 'dist/index.js',
          dependencies: {
            lodash: '^4.17.21',
          },
          devDependencies: {
            '@types/lodash': '^4.14.0',
          },
        },
        'packages/lib/dist/index.js': `export function greet(name) {
  return 'Hello, ' + name + '!';
}
`,
      })

      const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app', { bump: '3.9.27' })

      expect(output['package.json']).toEqual({
        name: '@test/app',
        version: '3.9.27',
        main: 'dist/index.js',
        dependencies: {
          chalk: '^5.0.0',
          lodash: '^4.17.21',
        },
      })

      expect(stdout.trim()).toBe('Hello, World!')
    })

    it('excludes in-repo devDependencies from the packaged output', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app', {
          dependencies: { '@test/lib': 'workspace:*' },
          devDependencies: { '@test/build-tool': 'workspace:*' },
        }),
        'packages/app/dist/index.js': `export const app = 'app';`,
        'packages/lib/package.json': pj('@test/lib'),
        'packages/lib/dist/index.js': `export const lib = 'lib';`,
        'packages/build-tool/package.json': pj('@test/build-tool'),
        'packages/build-tool/dist/index.js': `export const build = 'build';`,
      })

      const { output } = await runMonocrate(monorepoRoot, 'packages/app', { bump: '1.0.0' })

      // lib (production dependency) should be included
      expect(output).toHaveProperty('deps/packages/lib/package.json')

      // build-tool (devDependency) should NOT be included in packaged output
      expect(output).not.toHaveProperty('deps/packages/build-tool/package.json')
    })

    it('preserves line numbers in stack traces', async () => {
      // Line 1: export function throwError() {
      // Line 2:   throw new Error('intentional error');
      // Line 3: }
      const libSource = `export function throwError() {
  throw new Error('intentional error');
}
`
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': {
          name: '@test/app',
          version: '1.0.0',
          main: 'dist/index.js',
          dependencies: {
            '@test/lib': 'workspace:*',
          },
        },
        'packages/app/dist/index.js': `import { throwError } from '@test/lib';
throwError();
`,
        'packages/lib/package.json': {
          name: '@test/lib',
          version: '1.0.0',
          main: 'dist/index.js',
        },
        'packages/lib/dist/index.js': libSource,
      })

      const { stderr } = await runMonocrate(monorepoRoot, 'packages/app')

      // Verify the stack trace contains the error message and the line number in the output
      // The throw statement is on line 2 of the lib dist file
      expect(stderr).toContain('intentional error')
      // The error occurs in the deps directory where the in-repo dep is placed
      expect(stderr).toContain('index.js:2')
    })

    it('rewrites imports in both .js and .d.ts files', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/a/package.json': pj('@myorg/a', undefined, {
          dependencies: { '@myorg/b': '*', lodash: '^4.0.0' },
          types: 'dist/index.d.ts',
        }),
        'packages/a/dist/index.js': `import { foo } from '@myorg/b';
export const bar = foo;
`,
        'packages/a/dist/index.d.ts': `import { foo } from '@myorg/b';
export declare const bar: typeof foo;
`,
        'packages/b/package.json': pj('@myorg/b', undefined, {
          dependencies: { lodash: '^4.0.0' },
          types: 'dist/index.d.ts',
        }),
        'packages/b/dist/index.js': `export const foo = 'foo';
`,
        'packages/b/dist/index.d.ts': `export declare const foo: string;
`,
      })

      const { outputDir } = await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/a',
        publish: false,
        bump: '2.8.512',
      })

      const output = unfolderify(outputDir)

      console.error(JSON.stringify(output, null, 2))
      // Verify .js file has rewritten import
      expect(output['dist/index.js']).toContain('../deps/packages/b/dist/index.js')
      expect(output['dist/index.js']).not.toContain("'@myorg/b'")

      // Verify .d.ts file has rewritten import
      expect(output['dist/index.d.ts']).toContain('../deps/packages/b/dist/index.js')
      expect(output['dist/index.d.ts']).not.toContain("'@myorg/b'")
    })

    it('rewrites export declarations', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/a/package.json': pj('@myorg/a', { dependencies: { '@myorg/b': '*' } }),
        'packages/a/dist/index.js': `export { foo } from '@myorg/b';
export * from '@myorg/b';
`,
        'packages/b/package.json': pj('@myorg/b'),
        'packages/b/dist/index.js': `export const foo = 'foo';
export const bar = 'bar';
`,
      })

      const { outputDir } = await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/a',
        publish: false,
        bump: '2.8.512',
      })

      const output = unfolderify(outputDir)

      // Verify export declarations have rewritten module specifiers
      const indexJs = output['dist/index.js'] as string
      expect(indexJs).toContain('../deps/packages/b/dist/index.js')
      expect(indexJs).not.toContain("'@myorg/b'")
    })

    it('leaves third-party imports unchanged', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/a/package.json': pj('@myorg/a', { dependencies: { '@myorg/b': '*', lodash: '^4.0.0' } }),
        'packages/a/dist/index.js': `import { foo } from '@myorg/b';
import _ from 'lodash';
import * as path from 'node:path';
export const bar = foo;
`,
        'packages/b/package.json': pj('@myorg/b'),
        'packages/b/dist/index.js': `export const foo = 'foo';
`,
      })

      const { outputDir } = await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/a',
        publish: false,
        bump: '2.8.512',
      })

      const output = unfolderify(outputDir)
      const indexJs = output['dist/index.js'] as string

      // Third-party imports should be unchanged
      expect(indexJs).toContain("from 'lodash'")
      expect(indexJs).toContain("from 'node:path'")
    })

    it('rewrites imports in nested files at different depths', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/a/package.json': pj('@myorg/a', { dependencies: { '@myorg/b': '*' } }),
        'packages/a/dist/index.js': `import { foo } from '@myorg/b';
export { helper } from './utils/helper.js';
export const bar = foo;
`,
        'packages/a/dist/utils/helper.js': `import { foo } from '@myorg/b';
export const helper = foo + '-helper';
`,
        'packages/b/package.json': pj('@myorg/b'),
        'packages/b/dist/index.js': `export const foo = 'foo';
`,
      })

      const { outputDir } = await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/a',
        publish: false,
        bump: '2.8.512',
      })

      const output = unfolderify(outputDir)

      // Root level file should have '../deps/...'
      expect(output['dist/index.js']).toContain('../deps/packages/b/dist/index.js')

      // Nested file should have '../../deps/...'
      expect(output['dist/utils/helper.js']).toContain('../../deps/packages/b/dist/index.js')
    })

    it('handles packages in different monorepo directories', async () => {
      const monorepoRoot = folderify({
        'package.json': { name: 'my-monorepo', workspaces: ['packages/*', 'libs/*'] },
        'packages/a/package.json': pj('@myorg/a', { dependencies: { '@myorg/b': '*', '@myorg/utils': '*' } }),
        'packages/a/dist/index.js': `import { foo } from '@myorg/b';
import { util } from '@myorg/utils';
export const bar = foo + util;
`,
        'packages/b/package.json': pj('@myorg/b'),
        'packages/b/dist/index.js': `export const foo = 'foo';
`,
        'libs/utils/package.json': pj('@myorg/utils'),
        'libs/utils/dist/index.js': `export const util = 'util';
`,
      })

      const { outputDir } = await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/a',
        publish: false,
        bump: '2.8.512',
      })

      const output = unfolderify(outputDir)
      const indexJs = output['dist/index.js'] as string

      // Both imports should be rewritten with correct paths
      expect(indexJs).toContain('../deps/packages/b/dist/index.js')
      expect(indexJs).toContain('../deps/libs/utils/dist/index.js')

      // Verify the deps directory structure mirrors the monorepo
      expect(output).toHaveProperty('deps/packages/b/dist/index.js')
      expect(output).toHaveProperty('deps/libs/utils/dist/index.js')
    }, 15000)

    it('verifies output directory structure matches spec', async () => {
      const monorepoRoot = folderify({
        'package.json': { name: 'my-monorepo', workspaces: ['packages/*', 'libs/*'] },
        'packages/a/package.json': pj('@myorg/a', undefined, {
          dependencies: { '@myorg/b': '*' },
          types: 'dist/index.d.ts',
        }),
        'packages/a/dist/index.js': `import { foo } from '@myorg/b';
export const bar = foo;
`,
        'packages/a/dist/index.d.ts': `import { foo } from '@myorg/b';
export declare const bar: typeof foo;
`,
        'packages/a/dist/utils/helper.js': `export const x = 1;
`,
        'packages/a/dist/utils/helper.d.ts': `export declare const x: number;
`,
        'packages/b/package.json': pj('@myorg/b', undefined, { types: 'dist/index.d.ts' }),
        'packages/b/dist/index.js': `export const foo = 'foo';
`,
        'packages/b/dist/index.d.ts': `export declare const foo: string;
`,
      })

      const { outputDir } = await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/a',
        publish: false,
        bump: '2.8.512',
      })

      const output = unfolderify(outputDir)

      // Verify root structure
      expect(output).toHaveProperty('package.json')
      expect(output).toHaveProperty('dist/index.js')
      expect(output).toHaveProperty('dist/index.d.ts')
      expect(output).toHaveProperty('dist/utils/helper.js')
      expect(output).toHaveProperty('dist/utils/helper.d.ts')

      // Verify deps structure
      expect(output).toHaveProperty('deps/packages/b/dist/index.js')
      expect(output).toHaveProperty('deps/packages/b/dist/index.d.ts')
    })

    it('handles source package importing itself by name', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/a/package.json': pj('@myorg/a'),
        'packages/a/dist/index.js': `import { helper } from '@myorg/a/utils/helper';
export const result = helper;
`,
        'packages/a/dist/utils/helper.js': `export const helper = 'helper';
`,
      })

      const { outputDir } = await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/a',
        publish: false,
        bump: '2.8.512',
      })

      const output = unfolderify(outputDir)
      const indexJs = output['dist/index.js'] as string

      // Self-import should be rewritten to relative path
      expect(indexJs).toContain('./utils/helper')
      expect(indexJs).not.toContain("'@myorg/a/utils/helper'")
    })

    it('handles subpath imports like @myorg/b/submodule', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/a/package.json': pj('@myorg/a', { dependencies: { '@myorg/b': '*' } }),
        'packages/a/dist/index.js': `import { helper } from '@myorg/b/utils/helper';
export const result = helper;
`,
        // Package b uses exports field to map subpaths to dist directory
        'packages/b/package.json': pj('@myorg/b', {
          exports: {
            '.': './dist/index.js',
            './utils/*': './dist/utils/*',
          },
        }),
        'packages/b/dist/index.js': `export const foo = 'foo';
`,
        'packages/b/dist/utils/helper.js': `export const helper = 'helper';
`,
      })

      const { outputDir } = await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/a',
        publish: false,
        bump: '2.8.512',
      })

      const output = unfolderify(outputDir)
      const indexJs = output['dist/index.js'] as string

      // Subpath import should be rewritten with preserved subpath
      expect(indexJs).toContain('../deps/packages/b/dist/utils/helper')
      expect(indexJs).not.toContain("'@myorg/b/utils/helper'")
    })

    it('handles dynamic imports', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/a/package.json': pj('@myorg/a', { dependencies: { '@myorg/b': '*' } }),
        'packages/a/dist/index.js': `const b = await import('@myorg/b');
export const foo = b.foo;
`,
        'packages/b/package.json': pj('@myorg/b'),
        'packages/b/dist/index.js': `export const foo = 'foo';
`,
      })

      const { outputDir } = await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/a',
        publish: false,
        bump: '2.8.512',
      })

      const output = unfolderify(outputDir)
      const indexJs = output['dist/index.js'] as string

      // Dynamic import should be rewritten
      expect(indexJs).toContain('../deps/packages/b/dist/index.js')
      expect(indexJs).not.toContain("import('@myorg/b')")
    })

    it('errors on computed dynamic imports', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/a/package.json': pj('@myorg/a', { dependencies: { '@myorg/b': '*' } }),
        'packages/a/dist/index.js': `const modulePath = '@myorg/b';
const b = await import(modulePath);
export const foo = b.foo;
`,
        'packages/b/package.json': pj('@myorg/b'),
        'packages/b/dist/index.js': `export const foo = 'foo';
`,
      })

      await expect(
        monocrate({
          cwd: monorepoRoot,
          pathToSubjectPackages: 'packages/a',
          publish: false,
          bump: '2.8.512',
        })
      ).rejects.toThrow('Computed import not supported: import(modulePath)')
    })

    it('handles cross-dependency imports between in-repo deps', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@myorg/app', { dependencies: { '@myorg/lib-a': '*' } }),
        'packages/app/dist/index.js': `import { a } from '@myorg/lib-a';
console.log(a);
`,
        'packages/lib-a/package.json': pj('@myorg/lib-a', { dependencies: { '@myorg/lib-b': '*' } }),
        'packages/lib-a/dist/index.js': `import { b } from '@myorg/lib-b';
export const a = 'a-' + b;
`,
        'packages/lib-b/package.json': pj('@myorg/lib-b'),
        'packages/lib-b/dist/index.js': `export const b = 'b';
`,
      })

      const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app')

      // Verify the deps files also have their imports rewritten
      const libAIndex = output['deps/packages/lib-a/dist/index.js'] as string
      expect(libAIndex).toContain('../lib-b/dist/index.js')
      expect(libAIndex).not.toContain("'@myorg/lib-b'")

      // Verify execution works
      expect(stdout.trim()).toBe('a-b')
    }, 15000)
  })

  describe('files property support', () => {
    it('uses files property to determine what to copy', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': {
          name: '@test/app',
          version: '1.0.0',
          main: 'dist/index.js',
          files: ['dist', 'bin'],
        },
        'packages/app/dist/index.js': `console.log('Hello from dist');
`,
        'packages/app/bin/cli.js': `#!/usr/bin/env node
console.log('Hello from bin');
`,
        'packages/app/src/index.ts': `// Source file should not be copied
`,
      })

      const { outputDir } = await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/app',
        publish: false,
        bump: '2.8.512',
      })

      const output = unfolderify(outputDir)

      // Files from `files` property should be copied
      expect(output).toHaveProperty('dist/index.js')
      expect(output).toHaveProperty('bin/cli.js')

      // Source files not in `files` should not be copied
      expect(output).not.toHaveProperty('src/index.ts')
    })

    it('copies files at package root when specified in files', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': {
          name: '@test/app',
          version: '1.0.0',
          main: 'dist/index.js',
          files: ['dist', 'types.d.ts'],
        },
        'packages/app/dist/index.js': `export const foo = 'foo';
`,
        'packages/app/types.d.ts': `export declare const foo: string;
`,
      })

      const { outputDir } = await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/app',
        publish: false,
        bump: '2.8.512',
      })

      const output = unfolderify(outputDir)

      expect(output).toHaveProperty('dist/index.js')
      expect(output).toHaveProperty('types.d.ts')
    })

    it('uses files property for in-repo dependencies too', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': {
          name: '@test/app',
          version: '1.0.0',
          main: 'dist/index.js',
          dependencies: { '@test/lib': 'workspace:*' },
        },
        'packages/app/dist/index.js': `import { greet } from '@test/lib'; console.log(greet());`,
        'packages/lib/package.json': {
          name: '@test/lib',
          version: '1.0.0',
          main: 'dist/index.js',
          files: ['dist', 'extra'],
        },
        'packages/lib/dist/index.js': `export function greet() { return 'Hello!'; }`,
        'packages/lib/extra/utils.js': `export const helper = 'helper';`,
        'packages/lib/src/index.ts': `// Source should not be copied`,
      })

      const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app', { bump: '3.9.27' })

      expect(output).toMatchObject({
        'dist/index.js': `import { greet } from '../deps/packages/lib/dist/index.js'; console.log(greet());`,
        'package.json': {
          main: 'dist/index.js',
          name: '@test/app',
          version: '3.9.27',
        },
        'deps/packages/lib/dist/index.js': `export function greet() { return 'Hello!'; }`,
        'deps/packages/lib/extra/utils.js': `export const helper = 'helper';`,
        'deps/packages/lib/package.json': {
          files: ['dist', 'extra'],
          main: 'dist/index.js',
          name: '@test/lib',
          version: '1.0.0',
        },
      })
      expect(stdout.trim()).toBe('Hello!')
    })

    it('falls back to dist dir when files property is not specified', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': {
          name: '@test/app',
          version: '1.0.0',
          main: 'dist/index.js',
          // No files property
        },
        'packages/app/dist/index.js': `console.log('Hello');
`,
        'packages/app/dist/utils.js': `export const x = 1;
`,
      })

      const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app')

      expect(output).toHaveProperty('dist/index.js')
      expect(output).toHaveProperty('dist/utils.js')
      expect(stdout.trim()).toBe('Hello')
    })

    it('handles non-standard output directory specified in main', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': {
          name: '@test/app',
          version: '1.0.0',
          main: 'lib/index.js',
          files: ['lib'],
        },
        'packages/app/lib/index.js': `console.log('Hello from lib');
`,
      })

      const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app', { entryPoint: 'lib/index.js' })

      expect(output).toHaveProperty('lib/index.js')
      expect(stdout.trim()).toBe('Hello from lib')
    })

    it('skips non-existent entries in files array gracefully', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': {
          name: '@test/app',
          version: '1.0.0',
          main: 'dist/index.js',
          files: ['dist', 'docs', 'optional'],
        },
        'packages/app/dist/index.js': `console.log('Hello');
`,
        // docs and optional directories don't exist
      })

      const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app')

      // Should still work with just dist
      expect(output).toHaveProperty('dist/index.js')
      expect(output).not.toHaveProperty('docs')
      expect(output).not.toHaveProperty('optional')
      expect(stdout.trim()).toBe('Hello')
    })

    it('preserves files property in output package.json', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': {
          name: '@test/app',
          version: '1.0.0',
          main: 'dist/index.js',
          files: ['dist', 'bin'],
        },
        'packages/app/dist/index.js': `export const x = 1;
`,
        'packages/app/bin/cli.js': `#!/usr/bin/env node
`,
      })

      const { outputDir } = await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/app',
        publish: false,
        bump: '2.8.512',
      })

      const output = unfolderify(outputDir)
      const pkgJson = output['package.json'] as Record<string, unknown>

      expect(pkgJson.files).toEqual(['dist', 'bin'])
    })

    // TODO(imaman): publish to a test registry
  })

  // TODO(imaman): move this to a separate test file
  describe('version conflict detection', () => {
    it('throws with detailed error message when packages require different versions', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app', {
          dependencies: { '@test/lib': 'workspace:*', lodash: '^4.17.0' },
        }),
        'packages/app/dist/index.js': `import { greet } from '@test/lib'; console.log(greet());`,
        'packages/lib/package.json': pj('@test/lib', { dependencies: { lodash: '^3.10.0' } }),
        'packages/lib/dist/index.js': `export function greet() { return 'Hello!'; }`,
      })

      await expect(
        monocrate({
          cwd: monorepoRoot,
          pathToSubjectPackages: 'packages/app',
          publish: false,
          bump: '2.8.512',
        })
      ).rejects.toThrow(
        'Third-party dependency version conflicts detected:\n' +
          '  - lodash: ^3.10.0 (by @test/lib), ^4.17.0 (by @test/app)'
      )
    })

    it('lists all conflicting dependencies when multiple conflicts exist', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app', {
          dependencies: { '@test/lib': 'workspace:*', lodash: '^4.17.0', chalk: '^5.0.0' },
        }),
        'packages/app/dist/index.js': `import { greet } from '@test/lib'; console.log(greet());`,
        'packages/lib/package.json': pj('@test/lib', { dependencies: { lodash: '^3.10.0', chalk: '^4.0.0' } }),
        'packages/lib/dist/index.js': `export function greet() { return 'Hello!'; }`,
      })

      await expect(
        monocrate({
          cwd: monorepoRoot,
          pathToSubjectPackages: 'packages/app',
          publish: false,
          bump: '2.8.512',
        })
      ).rejects.toThrow('  - lodash: ^3.10.0 (by @test/lib), ^4.17.0 (by @test/app)')
    })

    it('allows same dependency with identical versions across packages', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app', {
          dependencies: { '@test/lib': 'workspace:*', lodash: '^4.17.21' },
        }),
        'packages/app/dist/index.js': `import { greet } from '@test/lib'; console.log(greet());`,
        'packages/lib/package.json': pj('@test/lib', { dependencies: { lodash: '^4.17.21' } }),
        'packages/lib/dist/index.js': `export function greet() { return 'Hello!'; }`,
      })

      const { stdout } = await runMonocrate(monorepoRoot, 'packages/app')
      expect(stdout.trim()).toBe('Hello!')
    })

    it('detects conflicts in deep dependency chains', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app', {
          dependencies: { '@test/level1': 'workspace:*', zod: '^3.0.0' },
        }),
        'packages/app/dist/index.js': `import { fromLevel1 } from '@test/level1'; console.log(fromLevel1());`,
        'packages/level1/package.json': pj('@test/level1', {
          dependencies: { '@test/level2': 'workspace:*' },
        }),
        'packages/level1/dist/index.js': `import { fromLevel2 } from '@test/level2'; export function fromLevel1() { return fromLevel2(); }`,
        'packages/level2/package.json': pj('@test/level2', { dependencies: { zod: '^2.0.0' } }),
        'packages/level2/dist/index.js': `export function fromLevel2() { return 'level2'; }`,
      })

      await expect(
        monocrate({
          cwd: monorepoRoot,
          pathToSubjectPackages: 'packages/app',
          publish: false,
          bump: '2.8.512',
        })
      ).rejects.toThrow('  - zod: ^2.0.0 (by @test/level2), ^3.0.0 (by @test/app)')
    })
  })

  describe('.npmrc file handling', () => {
    it('includes .npmrc file when present in package directory', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app'),
        'packages/app/dist/index.js': `console.log('Hello');`,
        'packages/app/.npmrc': 'registry=https://custom.registry.com',
      })

      expect(await runMonocrate(monorepoRoot, 'packages/app')).toMatchObject({
        output: { '.npmrc': 'registry=https://custom.registry.com' },
      })
    })

    it('does not fail when .npmrc is not present', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('app'),
        'packages/app/dist/index.js': `export function whatever() {}`,
      })
      expect((await runMonocrate(monorepoRoot, 'packages/app')).output).not.toHaveProperty('.npmrc')
    })

    it('includes .npmrc from in-repo dependencies', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('app', undefined, { dependencies: { lib: 'workspace:*' } }),
        'packages/app/dist/index.js': `import { greet } from '@test/lib'; console.log(greet());`,
        'packages/lib/package.json': pj('lib'),
        'packages/lib/dist/index.js': `export function greet() { return 'Hello!'; }`,
        'packages/lib/.npmrc': 'registry=https://lib.registry.com',
      })

      expect(await runMonocrate(monorepoRoot, 'packages/app')).toMatchObject({
        output: {
          'deps/packages/lib/.npmrc': 'registry=https://lib.registry.com',
        },
      })
    })
  })

  describe('--mirror-to option', () => {
    it('mirrors source files to the specified directory preserving path structure', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app'),
        'packages/app/src/index.ts': `export const foo = 'foo';`,
        'packages/app/dist/index.js': `export const foo = 'foo';`,
      })

      // Initialize git repo so git ls-files works
      initGitRepo(monorepoRoot)

      const mirrorDir = createTempDir('mirror-')

      await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/app',
        publish: false,
        bump: '1.0.0',
        mirrorTo: mirrorDir,
      })

      const mirrored = unfolderify(mirrorDir)

      // Should mirror files preserving path structure
      expect(mirrored).toEqual({
        'packages/app/package.json': { name: '@test/app', version: '0.9.9', main: 'dist/index.js' },
        'packages/app/src/index.ts': `export const foo = 'foo';`,
        'packages/app/dist/index.js': `export const foo = 'foo';`,
      })
    })

    it('mirrors all packages in the closure including dependencies', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app', {
          dependencies: { '@test/lib': 'workspace:*' },
        }),
        'packages/app/src/index.ts': `import { greet } from '@test/lib';`,
        'packages/app/dist/index.js': `import { greet } from '@test/lib';`,
        'packages/lib/package.json': pj('@test/lib'),
        'packages/lib/src/index.ts': `export function greet() { return 'Hello!'; }`,
        'packages/lib/dist/index.js': `export function greet() { return 'Hello!'; }`,
      })

      initGitRepo(monorepoRoot)

      const mirrorDir = createTempDir('mirror-')

      await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/app',
        publish: false,
        bump: '1.0.0',
        mirrorTo: mirrorDir,
      })

      const mirrored = unfolderify(mirrorDir)

      // Should mirror both app and its dependency lib
      expect(mirrored).toHaveProperty('packages/app/package.json')
      expect(mirrored).toHaveProperty('packages/app/src/index.ts')
      expect(mirrored).toHaveProperty('packages/lib/package.json')
      expect(mirrored).toHaveProperty('packages/lib/src/index.ts')
    })

    it('excludes gitignored files from mirroring', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        '.gitignore': 'node_modules\n*.log\n',
        'packages/app/package.json': pj('@test/app'),
        'packages/app/src/index.ts': `export const foo = 'foo';`,
        'packages/app/dist/index.js': `export const foo = 'foo';`,
        'packages/app/debug.log': 'some debug logs',
      })

      initGitRepo(monorepoRoot)

      const mirrorDir = createTempDir('mirror-')

      await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/app',
        publish: false,
        bump: '1.0.0',
        mirrorTo: mirrorDir,
      })

      const mirrored = unfolderify(mirrorDir)

      // Should include non-ignored files
      expect(mirrored).toHaveProperty('packages/app/package.json')
      expect(mirrored).toHaveProperty('packages/app/src/index.ts')

      // Should exclude gitignored files
      expect(mirrored).not.toHaveProperty('packages/app/debug.log')
    })

    it('wipes target directory before copying', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app'),
        'packages/app/src/index.ts': `export const foo = 'foo';`,
        'packages/app/dist/index.js': `export const foo = 'foo';`,
      })

      initGitRepo(monorepoRoot)

      const mirrorDir = createTempDir('mirror-')

      // Create a pre-existing file in the mirror directory
      fs.mkdirSync(path.join(mirrorDir, 'packages/app'), { recursive: true })
      fs.writeFileSync(path.join(mirrorDir, 'packages/app/old-file.txt'), 'old content')

      await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/app',
        publish: false,
        bump: '1.0.0',
        mirrorTo: mirrorDir,
      })

      const mirrored = unfolderify(mirrorDir)

      // New files should be present
      expect(mirrored).toHaveProperty('packages/app/package.json')
      expect(mirrored).toHaveProperty('packages/app/src/index.ts')

      // Old file should be gone (directory was wiped)
      expect(mirrored).not.toHaveProperty('packages/app/old-file.txt')
    })

    it('mirrors packages from multiple subject packages', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app1/package.json': pj('@test/app1', {
          dependencies: { '@test/shared': 'workspace:*' },
        }),
        'packages/app1/src/index.ts': `app1 source`,
        'packages/app1/dist/index.js': `app1 dist`,
        'packages/app2/package.json': pj('@test/app2', {
          dependencies: { '@test/shared': 'workspace:*' },
        }),
        'packages/app2/src/index.ts': `app2 source`,
        'packages/app2/dist/index.js': `app2 dist`,
        'packages/shared/package.json': pj('@test/shared'),
        'packages/shared/src/index.ts': `shared source`,
        'packages/shared/dist/index.js': `shared dist`,
      })

      initGitRepo(monorepoRoot)

      const mirrorDir = createTempDir('mirror-')

      await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: ['packages/app1', 'packages/app2'],
        publish: false,
        bump: '1.0.0',
        mirrorTo: mirrorDir,
      })

      const mirrored = unfolderify(mirrorDir)

      // All three packages should be mirrored
      expect(mirrored).toHaveProperty('packages/app1/package.json')
      expect(mirrored).toHaveProperty('packages/app1/src/index.ts')
      expect(mirrored).toHaveProperty('packages/app2/package.json')
      expect(mirrored).toHaveProperty('packages/app2/src/index.ts')
      expect(mirrored).toHaveProperty('packages/shared/package.json')
      expect(mirrored).toHaveProperty('packages/shared/src/index.ts')
    }, 30000)

    it('errors if there are untracked files', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app'),
        'packages/app/src/index.ts': `export const foo = 'foo';`,
        'packages/app/dist/index.js': `export const foo = 'foo';`,
      })

      // Initialize git and commit files
      initGitRepo(monorepoRoot)

      // Create an untracked file
      fs.writeFileSync(path.join(monorepoRoot, 'packages/app/leftover-temp.ts'), 'some temp content')

      const mirrorDir = createTempDir('mirror-')

      await expect(
        monocrate({
          cwd: monorepoRoot,
          pathToSubjectPackages: 'packages/app',
          publish: false,
          bump: '1.0.0',
          mirrorTo: mirrorDir,
        })
      ).rejects.toThrow(/Cannot mirror: found 1 untracked file\(s\).*leftover-temp\.ts/)
    })

    it('mirrors devDependencies in addition to production dependencies', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app', {
          devDependencies: { '@test/build-tool': 'workspace:*' },
        }),
        'packages/app/dist/index.js': `export const foo = 'foo';`,
        'packages/build-tool/package.json': pj('@test/build-tool'),
        'packages/build-tool/dist/index.js': `export function build() { return 'building'; }`,
      })

      initGitRepo(monorepoRoot)

      const mirrorDir = createTempDir('mirror-')

      await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/app',
        publish: false,
        bump: '1.0.0',
        mirrorTo: mirrorDir,
      })

      const mirrored = unfolderify(mirrorDir)

      expect(mirrored).toEqual({
        'packages/app/package.json': { name: '@test/app', version: '0.9.9', main: 'dist/index.js', devDependencies: { '@test/build-tool': 'workspace:*' } },
        'packages/app/dist/index.js': `export const foo = 'foo';`,
        'packages/build-tool/package.json': { name: '@test/build-tool', version: '0.9.9', main: 'dist/index.js' },
        'packages/build-tool/dist/index.js': `export function build() { return 'building'; }`,
      })
    })

    it('mirrors transitive dependencies across prod and dev boundaries', async () => {
      // Test that:
      // - prod deps of devdeps are included (app --devDep--> build-tool --dep--> shared)
      // - devdeps of prod deps are included (app --dep--> lib --devDep--> test-util)
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app', {
          dependencies: { '@test/lib': 'workspace:*' },
          devDependencies: { '@test/build-tool': 'workspace:*' },
        }),
        'packages/app/dist/index.js': `export const app = 'app';`,
        'packages/lib/package.json': pj('@test/lib', {
          devDependencies: { '@test/test-util': 'workspace:*' },
        }),
        'packages/lib/dist/index.js': `export const lib = 'lib';`,
        'packages/build-tool/package.json': pj('@test/build-tool', {
          dependencies: { '@test/shared': 'workspace:*' },
        }),
        'packages/build-tool/dist/index.js': `export const build = 'build';`,
        'packages/shared/package.json': pj('@test/shared'),
        'packages/shared/dist/index.js': `export const shared = 'shared';`,
        'packages/test-util/package.json': pj('@test/test-util'),
        'packages/test-util/dist/index.js': `export const testUtil = 'test';`,
      })

      initGitRepo(monorepoRoot)

      const mirrorDir = createTempDir('mirror-')

      await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/app',
        publish: false,
        bump: '1.0.0',
        mirrorTo: mirrorDir,
      })

      const mirrored = unfolderify(mirrorDir)

      // All 5 packages should be mirrored
      expect(Object.keys(mirrored).filter((k) => k.endsWith('package.json')).sort()).toEqual([
        'packages/app/package.json',
        'packages/build-tool/package.json',
        'packages/lib/package.json',
        'packages/shared/package.json',
        'packages/test-util/package.json',
      ])
    })

    it('does not mirror when mirrorTo is not specified', async () => {
      const monorepoRoot = folderify({
        'package.json': { name, workspaces: ['packages/*'] },
        'packages/app/package.json': pj('@test/app'),
        'packages/app/src/index.ts': `export const foo = 'foo';`,
        'packages/app/dist/index.js': `export const foo = 'foo';`,
      })

      // No mirrorTo option
      const result = await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/app',
        publish: false,
        bump: '1.0.0',
      })

      // Should complete without error, outputDir should exist
      expect(fs.existsSync(result.outputDir)).toBe(true)
    })
  })
})
