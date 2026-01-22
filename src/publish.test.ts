import * as path from 'node:path'
import * as fs from 'node:fs'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { monocrate } from './index.js'
import { pj } from './testing/monocrate-teskit.js'
import { folderify } from './testing/folderify.js'
import { VerdaccioTestkit } from './testing/verdaccio-testkit.js'

describe('npm publishing with Verdaccio', () => {
  const verdaccio = new VerdaccioTestkit()

  beforeAll(async () => {
    // Remove npm_config_* environment variables that yarn sets,
    // so npm uses the .npmrc file from the output directory
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('npm_config_')) {
        delete process.env[key] // eslint-disable-line @typescript-eslint/no-dynamic-delete
      }
    }
    await verdaccio.start()
  }, 60000)

  afterAll(async () => {
    await verdaccio.shutdown()
  }, 10000)

  it('publishes a simple package and it can be installed from the registry', async () => {
    const monorepoRoot = folderify({
      '.npmrc': verdaccio.npmRc(),
      'package.json': { workspaces: ['packages/*'] },
      'packages/mylib/package.json': { name: '@test/mylib', version: '1.0.0', main: 'dist/index.js' },
      'packages/mylib/dist/index.js': `export function hello() { return 'Hello from mylib!'; }`,
    })

    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackages: path.join(monorepoRoot, 'packages/mylib'),
      monorepoRoot,
      publishToVersion: '99.99.99',
    })
    expect(await verdaccio.runView('@test/mylib')).toMatchObject({ name: '@test/mylib', version: '99.99.99' })
    expect(
      verdaccio.runConumser(`@test/mylib@99.99.99`, `import { hello } from '@test/mylib'; console.log(hello())`)
    ).toBe('Hello from mylib!')
  }, 60000)

  it('publishes a simple non-scoped package', async () => {
    const monorepoRoot = folderify({
      '.npmrc': verdaccio.npmRc(),
      'package.json': { workspaces: ['packages/*'] },
      'packages/mylib/package.json': { name: 'mylib', version: '1.0.0', main: 'dist/index.js' },
      'packages/mylib/dist/index.js': `export function hello() { return 'Hello from mylib!'; }`,
    })

    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackages: path.join(monorepoRoot, 'packages/mylib'),
      monorepoRoot,
      publishToVersion: '99.99.99',
    })
    expect(await verdaccio.runView('mylib')).toMatchObject({ name: 'mylib', version: '99.99.99' })
    expect(verdaccio.runConumser(`mylib@99.99.99`, `import { hello } from 'mylib'; console.log(hello())`)).toBe(
      'Hello from mylib!'
    )
  }, 60000)
  it('publishes a package with in-repo dependency and rewritten imports work correctly', async () => {
    const monorepoRoot = folderify({
      '.npmrc': verdaccio.npmRc(),

      'package.json': { workspaces: ['packages/*'] },
      'packages/app/package.json': {
        name: '@test/app',
        version: '1.0.0',
        main: 'dist/index.js',
        dependencies: { '@test/lib': 'workspace:*' },
      },
      'packages/app/dist/index.js': `import { greet } from '@test/lib'; export function sayHello(name) { return greet(name); }`,
      'packages/lib/package.json': { name: '@test/lib', version: '1.0.0', main: 'dist/index.js' },
      'packages/lib/dist/index.js': `export function greet(name) { return 'Hello, ' + name + '!'; }`,
    })

    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackages: path.join(monorepoRoot, 'packages/app'),
      monorepoRoot,
      publishToVersion: '88.88.88',
    })
    expect(verdaccio.runView('@test/app')).toMatchObject({ name: '@test/app', version: '88.88.88' })
    expect(
      verdaccio.runConumser(
        '@test/app@88.88.88',
        `import { sayHello } from '@test/app'; console.log(sayHello('World'))`
      )
    ).toBe('Hello, World!')
  }, 60000)

  it('publishes multiple versions of the same package', async () => {
    const pkgName = `foo`
    const monorepoRoot = folderify({
      '.npmrc': verdaccio.npmRc(),
      'package.json': { workspaces: ['packages/*'] },
      'packages/foo/package.json': pj(pkgName, '1.0.0'),
      'packages/foo/dist/index.js': `export const foo = 'FOO'`,
    })

    expect(
      await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/foo',
        monorepoRoot,
        publishToVersion: '1.4.1',
      })
    ).toMatchObject({ resolvedVersion: '1.4.1' })
    expect(verdaccio.runView(pkgName)).toMatchObject({ version: '1.4.1' })

    expect(
      await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/foo',
        monorepoRoot,
        publishToVersion: '2.7.1',
      })
    ).toMatchObject({ resolvedVersion: '2.7.1' })
    expect(verdaccio.runView(pkgName)).toMatchObject({ version: '2.7.1' })

    expect(
      await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackages: 'packages/foo',
        monorepoRoot,
        publishToVersion: '3.1.4',
      })
    ).toMatchObject({ resolvedVersion: '3.1.4' })

    // Verify all versions are available
    expect(verdaccio.runView(pkgName)).toMatchObject({ version: '3.1.4', versions: ['1.4.1', '2.7.1', '3.1.4'] })
  }, 120000)

  it('merges third-party dependencies from main package and in-repo deps', async () => {
    // Publish two libs directly to Verdaccio to serve as "third-party" deps.
    verdaccio.publishPackage(
      'naturals',
      '3.9.27',
      'export const divisorsOf = n => Array.from({ length: n }, (_, i) => i+1).filter(x => n % x === 0)'
    )
    verdaccio.publishPackage('is-even', '2.4.8', 'export default function isEven(n) { return n % 2 === 0; }')

    const monorepoRoot = folderify({
      '.npmrc': verdaccio.npmRc(),
      'package.json': { workspaces: ['packages/*'] },
      'packages/foo/package.json': pj('foo', '1.0.0', { dependencies: { boo: 'workspace:*', naturals: '^3.0.0' } }),
      'packages/foo/index.js': [
        `import { classify } from 'boo'`,
        `import { divisorsOf } from 'naturals'`,
        `export function analyze(n) { return n + ' is ' + classify(n) + ". Divisors: " + divisorsOf(n).join(', ') }`,
      ].join('\n'),
      'packages/boo/package.json': pj('boo', '1.0.0', { dependencies: { 'is-even': '~2.4.0' } }),
      'packages/boo/index.js': `import isEven from 'is-even'; export function classify(n) { return isEven(n) ? 'even' : 'odd'; }`,
    })

    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackages: 'packages/foo',
      monorepoRoot,
      publishToVersion: '77.77.77',
    })

    expect(verdaccio.runView('foo')).toMatchObject({
      name: 'foo',
      version: '77.77.77',
      dependencies: { 'is-even': '~2.4.0', naturals: '^3.0.0' },
    })

    expect(verdaccio.runConumser('foo', `import { analyze } from 'foo'`, `console.log(analyze(24))`)).toBe(
      '24 is even. Divisors: 1, 2, 3, 4, 6, 8, 12, 24'
    )
  }, 90000)

  it('published version increments as dictated by the "bump" value', async () => {
    const monorepoRoot = folderify({
      '.npmrc': verdaccio.npmRc(),
      'package.json': { workspaces: ['packages/*'] },
      'packages/mypkg/package.json': pj('mypkg', '0.0.0'),
      'packages/mypkg/dist/index.js': `export const whatever = () => {}`,
    })

    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackages: path.join(monorepoRoot, 'packages/mypkg'),
      monorepoRoot,
      publishToVersion: '2.4.0',
    })

    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackages: path.join(monorepoRoot, 'packages/mypkg'),
      monorepoRoot,
      publishToVersion: 'minor',
    })
    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackages: path.join(monorepoRoot, 'packages/mypkg'),
      monorepoRoot,
      publishToVersion: 'major',
    })
    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackages: path.join(monorepoRoot, 'packages/mypkg'),
      monorepoRoot,
      publishToVersion: '4.1.8',
    })
    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackages: path.join(monorepoRoot, 'packages/mypkg'),
      monorepoRoot,
      publishToVersion: 'patch',
    })
    expect(verdaccio.runView('mypkg')).toMatchObject({
      version: '4.1.9',
      versions: ['2.4.0', '2.5.0', '3.0.0', '4.1.8', '4.1.9'],
    })
  }, 120000)

  it('verify the packaged code changes indeed changes with each published version', async () => {
    const monorepoRoot = folderify({
      '.npmrc': verdaccio.npmRc(),
      'package.json': { workspaces: ['packages/*'] },
      'packages/calculator/package.json': pj('calculator', '1.0.0', { main: 'index.mjs' }),
      'packages/calculator/index.mjs': `//`,
    })
    const indexPath = path.join(monorepoRoot, 'packages/calculator/index.mjs')

    const opts = {
      cwd: monorepoRoot,
      pathToSubjectPackages: 'packages/calculator',
      monorepoRoot,
      publishToVersion: 'major',
    }

    // Version 1.0.0: addition
    fs.writeFileSync(indexPath, `export function compute(a, b) { return a + b; }`)
    await monocrate(opts)

    // Version 2.0.0: multiplication
    fs.writeFileSync(indexPath, `export function compute(a, b) { return a * b; }`)
    await monocrate(opts)

    // Version 3.0.0: power
    fs.writeFileSync(indexPath, `export function compute(a, b) { return Math.pow(a, b); }`)
    await monocrate(opts)

    expect(
      verdaccio.runConumser('calculator@1.0.0', `import { compute } from 'calculator'; console.log(compute(3, 4))`)
    ).toBe('7')
    expect(
      verdaccio.runConumser('calculator@2.0.0', `import { compute } from 'calculator'; console.log(compute(3, 4))`)
    ).toBe('12')
    expect(
      verdaccio.runConumser('calculator@3.0.0', `import { compute } from 'calculator'; console.log(compute(3, 4))`)
    ).toBe('81')
  }, 120000)

  it('publishes multiple packages with shared version derived from max current version', async () => {
    // Publish initial versions: core at 1.2.0, utils at 1.3.0, cli at 1.1.0
    const monorepoRoot = folderify({
      '.npmrc': verdaccio.npmRc(),
      'package.json': { workspaces: ['packages/*'] },
      'packages/core/package.json': pj('@test/core', '1.2.0'),
      'packages/core/dist/index.js': `export const core = 'core';`,
      'packages/utils/package.json': pj('@test/utils', '1.3.0'),
      'packages/utils/dist/index.js': `export const utils = 'utils';`,
      'packages/cli/package.json': pj('@test/cli', '1.1.0'),
      'packages/cli/dist/index.js': `export const cli = 'cli';`,
    })

    // Publish each at different versions first
    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackages: path.join(monorepoRoot, 'packages/core'),
      monorepoRoot,
      publishToVersion: '1.2.0',
    })
    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackages: path.join(monorepoRoot, 'packages/utils'),
      monorepoRoot,
      publishToVersion: '1.3.0',
    })
    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackages: path.join(monorepoRoot, 'packages/cli'),
      monorepoRoot,
      publishToVersion: '1.1.0',
    })

    // Now publish all three with patch increment
    // Max is 1.3.0, so patch should give 1.3.1
    const result = await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackages: [
        path.join(monorepoRoot, 'packages/core'),
        path.join(monorepoRoot, 'packages/utils'),
        path.join(monorepoRoot, 'packages/cli'),
      ],
      monorepoRoot,
      publishToVersion: 'patch',
    })

    expect(result.resolvedVersion).toBe('1.3.1')
    expect(result.packages).toHaveLength(3)

    // All three should be published at 1.3.1
    expect(verdaccio.runView('@test/core')).toMatchObject({ version: '1.3.1' })
    expect(verdaccio.runView('@test/utils')).toMatchObject({ version: '1.3.1' })
    expect(verdaccio.runView('@test/cli')).toMatchObject({ version: '1.3.1' })
  }, 180000)

  it('publishes multiple packages with explicit version', async () => {
    const monorepoRoot = folderify({
      '.npmrc': verdaccio.npmRc(),
      'package.json': { workspaces: ['packages/*'] },
      'packages/alpha/package.json': pj('alpha', '1.0.0'),
      'packages/alpha/dist/index.js': `export const alpha = 'alpha';`,
      'packages/beta/package.json': pj('beta', '1.0.0'),
      'packages/beta/dist/index.js': `export const beta = 'beta';`,
    })

    const result = await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackages: [
        path.join(monorepoRoot, 'packages/alpha'),
        path.join(monorepoRoot, 'packages/beta'),
      ],
      monorepoRoot,
      publishToVersion: '5.0.0',
    })

    expect(result.resolvedVersion).toBe('5.0.0')

    // Both should be published at 5.0.0
    expect(verdaccio.runView('alpha')).toMatchObject({ version: '5.0.0' })
    expect(verdaccio.runView('beta')).toMatchObject({ version: '5.0.0' })
  }, 120000)
})
