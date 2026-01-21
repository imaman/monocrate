import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { monocrate } from './index.js'
import { folderify } from './testing/folderify.js'
import { createTempDir } from './testing/monocrate-teskit.js'
import { VerdaccioTestkit } from './testing/verdaccio-testkit.js'

describe('npm publishing with Verdaccio', () => {
  const verdaccio = new VerdaccioTestkit()

  beforeAll(async () => {
    await verdaccio.start()
  }, 60000)

  afterAll(async () => {
    await verdaccio.shutdown()
  }, 10000)

  it('publishes a simple package and it can be installed from the registry', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
      'packages/mylib/package.json': {
        name: '@test/mylib',
        version: '1.0.0',
        main: 'dist/index.js',
      },
      'packages/mylib/dist/index.js': `export function hello() { return 'Hello from mylib!'; }`,
    })

    const outputDir = createTempDir('monocrate-output-')
    verdaccio.createNpmRc(outputDir)

    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/mylib'),
      outputDir,
      monorepoRoot,
      publishToVersion: '99.99.99',
    })

    expect(verdaccio.runView('@test/mylib')).toMatchObject({
      name: '@test/mylib',
      version: '99.99.99',
    })

    const installDir = folderify({
      'package.json': { name: 'test-consumer', type: 'module' },
      'test.mjs': `import { hello } from '@test/mylib'; console.log(hello());`,
    })

    verdaccio.runInstall(installDir, '@test/mylib@99.99.99')

    const output = execSync('node test.mjs', { cwd: installDir, encoding: 'utf-8' })
    expect(output.trim()).toBe('Hello from mylib!')
  }, 60000)

  it('publishes a package with in-repo dependency and rewritten imports work correctly', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
      'packages/app/package.json': {
        name: '@test/app',
        version: '1.0.0',
        main: 'dist/index.js',
        dependencies: {
          '@test/lib': 'workspace:*',
        },
      },
      'packages/app/dist/index.js': `import { greet } from '@test/lib';
export function sayHello(name) { return greet(name); }`,
      'packages/lib/package.json': {
        name: '@test/lib',
        version: '1.0.0',
        main: 'dist/index.js',
      },
      'packages/lib/dist/index.js': `export function greet(name) { return 'Hello, ' + name + '!'; }`,
    })

    const outputDir = createTempDir('monocrate-output-')
    verdaccio.createNpmRc(outputDir)

    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/app'),
      outputDir,
      monorepoRoot,
      publishToVersion: '88.88.88',
    })

    expect(verdaccio.runView('@test/app')).toMatchObject({
      name: '@test/app',
      version: '88.88.88',
    })

    // Install and verify the published package works with rewritten imports
    const installDir = folderify({
      'package.json': { name: 'test-consumer', type: 'module' },
      'test.mjs': `import { sayHello } from '@test/app'; console.log(sayHello('World'));`,
    })

    verdaccio.runInstall(installDir, '@test/app@88.88.88')

    const output = execSync('node test.mjs', { cwd: installDir, encoding: 'utf-8' })
    expect(output.trim()).toBe('Hello, World!')
  }, 60000)

  it('publishes multiple versions of the same package', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
      'packages/versioned/package.json': {
        name: '@test/versioned',
        version: '1.0.0',
        main: 'dist/index.js',
      },
      'packages/versioned/dist/index.js': `export const version = '1';`,
    })

    // Publish version 1.0.0
    const outputDir1 = createTempDir('monocrate-output-')
    verdaccio.createNpmRc(outputDir1)

    const result1 = await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/versioned'),
      outputDir: outputDir1,
      monorepoRoot,
      publishToVersion: '1.0.0',
    })

    expect(result1.resolvedVersion).toBe('1.0.0')
    expect(verdaccio.runView('@test/versioned@1.0.0')).toMatchObject({ version: '1.0.0' })

    // Publish version 1.0.1
    const outputDir2 = createTempDir('monocrate-output-')
    verdaccio.createNpmRc(outputDir2)

    const result2 = await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/versioned'),
      outputDir: outputDir2,
      monorepoRoot,
      publishToVersion: '1.0.1',
    })

    expect(result2.resolvedVersion).toBe('1.0.1')
    expect(verdaccio.runView('@test/versioned@1.0.1')).toMatchObject({ version: '1.0.1' })

    // Publish version 2.0.0
    const outputDir3 = createTempDir('monocrate-output-')
    verdaccio.createNpmRc(outputDir3)

    const result3 = await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/versioned'),
      outputDir: outputDir3,
      monorepoRoot,
      publishToVersion: '2.0.0',
    })

    expect(result3.resolvedVersion).toBe('2.0.0')
    expect(verdaccio.runView('@test/versioned@2.0.0')).toMatchObject({ version: '2.0.0' })

    // Verify all versions are available
    const allVersions = verdaccio.runView('@test/versioned') as Record<string, unknown>
    expect(allVersions.versions).toContain('1.0.0')
    expect(allVersions.versions).toContain('1.0.1')
    expect(allVersions.versions).toContain('2.0.0')
  }, 120000)

  it('merges third-party dependencies from main package and in-repo deps', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
      'packages/app/package.json': {
        name: '@test/app-with-deps',
        version: '1.0.0',
        main: 'dist/index.js',
        dependencies: {
          '@test/lib-with-deps': 'workspace:*',
          'is-odd': '^3.0.1',
        },
      },
      'packages/app/dist/index.js': `import { checkEven } from '@test/lib-with-deps';
import isOdd from 'is-odd';
export function analyze(n) {
  return { isOdd: isOdd(n), isEven: checkEven(n) };
}`,
      'packages/lib/package.json': {
        name: '@test/lib-with-deps',
        version: '1.0.0',
        main: 'dist/index.js',
        dependencies: {
          'is-even': '^1.0.0',
        },
      },
      'packages/lib/dist/index.js': `import isEven from 'is-even';
export function checkEven(n) { return isEven(n); }`,
    })

    const outputDir = createTempDir('monocrate-output-')
    verdaccio.createNpmRc(outputDir)

    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/app'),
      outputDir,
      monorepoRoot,
      publishToVersion: '77.77.77',
    })

    // Verify package.json has merged dependencies
    const viewResult = verdaccio.runView('@test/app-with-deps') as Record<string, unknown>
    expect(viewResult).toMatchObject({
      name: '@test/app-with-deps',
      version: '77.77.77',
    })
    expect(viewResult.dependencies).toMatchObject({
      'is-odd': '^3.0.1',
      'is-even': '^1.0.0',
    })

    // Install and verify all dependencies are available and work
    const installDir = folderify({
      'package.json': { name: 'test-consumer', type: 'module' },
      'test.mjs': `import { analyze } from '@test/app-with-deps';
const result = analyze(5);
console.log(JSON.stringify(result));`,
    })

    verdaccio.runInstall(installDir, '@test/app-with-deps@77.77.77')

    // Verify node_modules contains both third-party deps
    expect(fs.existsSync(path.join(installDir, 'node_modules', 'is-odd'))).toBe(true)
    expect(fs.existsSync(path.join(installDir, 'node_modules', 'is-even'))).toBe(true)

    const output = execSync('node test.mjs', { cwd: installDir, encoding: 'utf-8' })
    expect(JSON.parse(output.trim())).toEqual({ isOdd: true, isEven: false })
  }, 90000)
})
