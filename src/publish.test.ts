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
      'package.json': { workspaces: ['packages/*'] },
      'packages/mylib/package.json': { name: '@test/mylib', version: '1.0.0', main: 'dist/index.js' },
      'packages/mylib/dist/index.js': `export function hello() { return 'Hello from mylib!'; }`,
    })

    const f = verdaccio.get().npmrcPath
    console.log(`f=${f} inside=${fs.readFileSync(f, 'utf-8')}`)
    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/mylib'),
      monorepoRoot,
      bump: '99.99.99',
      publish: true,
      npmRcFile: verdaccio.get().npmrcPath,
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
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/mylib'),
      monorepoRoot,
      bump: '99.99.99',
      publish: true,
      npmRcFile: verdaccio.get().npmrcPath,
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
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/app'),
      monorepoRoot,
      bump: '88.88.88',
      publish: true,
      npmRcFile: verdaccio.get().npmrcPath,
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
        pathToSubjectPackage: 'packages/foo',
        monorepoRoot,
        bump: '1.4.1',
        publish: true,
        npmRcFile: verdaccio.get().npmrcPath,
      })
    ).toMatchObject({ resolvedVersion: '1.4.1' })
    expect(verdaccio.runView(pkgName)).toMatchObject({ version: '1.4.1' })

    expect(
      await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackage: 'packages/foo',
        monorepoRoot,
        bump: '2.7.1',
        publish: true,
        npmRcFile: verdaccio.get().npmrcPath,
      })
    ).toMatchObject({ resolvedVersion: '2.7.1' })
    expect(verdaccio.runView(pkgName)).toMatchObject({ version: '2.7.1' })

    expect(
      await monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackage: 'packages/foo',
        monorepoRoot,
        bump: '3.1.4',
        publish: true,
        npmRcFile: verdaccio.get().npmrcPath,
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
      'packages/foo/dist/index.js': [
        `import { classify } from 'boo'`,
        `import { divisorsOf } from 'naturals'`,
        `export function analyze(n) { return n + ' is ' + classify(n) + ". Divisors: " + divisorsOf(n).join(', ') }`,
      ].join('\n'),
      'packages/boo/package.json': pj('boo', '1.0.0', { dependencies: { 'is-even': '~2.4.0' } }),
      'packages/boo/dist/index.js': `import isEven from 'is-even'; export function classify(n) { return isEven(n) ? 'even' : 'odd'; }`,
    })

    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: 'packages/foo',
      monorepoRoot,
      bump: '77.77.77',
      publish: true,
      npmRcFile: verdaccio.get().npmrcPath,
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
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/mypkg'),
      monorepoRoot,
      bump: '2.4.0',
      publish: true,
      npmRcFile: verdaccio.get().npmrcPath,
    })

    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/mypkg'),
      monorepoRoot,
      bump: 'minor',
      publish: true,
      npmRcFile: verdaccio.get().npmrcPath,
    })
    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/mypkg'),
      monorepoRoot,
      bump: 'major',
      publish: true,
      npmRcFile: verdaccio.get().npmrcPath,
    })
    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/mypkg'),
      monorepoRoot,
      bump: '4.1.8',
      publish: true,
      npmRcFile: verdaccio.get().npmrcPath,
    })
    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/mypkg'),
      monorepoRoot,
      bump: 'patch',
      publish: true,
      npmRcFile: verdaccio.get().npmrcPath,
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
      'packages/calculator/package.json': pj('calculator', '1.0.0'),
      'packages/calculator/dist/index.js': `//`,
    })
    const indexPath = path.join(monorepoRoot, 'packages/calculator/dist/index.js')

    const opts = {
      cwd: monorepoRoot,
      pathToSubjectPackage: 'packages/calculator',
      monorepoRoot,
      bump: 'major',
      publish: true,
      npmRcFile: verdaccio.get().npmrcPath,
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
})
