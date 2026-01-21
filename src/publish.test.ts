import { execSync } from 'node:child_process'
import * as path from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { monocrate } from './index.js'
import { createTempDir } from './testing/monocrate-teskit.js'
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

    const outputDir = createTempDir()
    verdaccio.createNpmRc(outputDir)

    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/mylib'),
      outputDir,
      monorepoRoot,
      publishToVersion: '99.99.99',
    })
    expect(await verdaccio.runView('@test/mylib')).toMatchObject({ name: '@test/mylib', version: '99.99.99' })

    // Verify the package can be installed and works
    const installDir = folderify({
      'package.json': { name: 'test-consumer', type: 'module' },
      'test.mjs': `import { hello } from '@test/mylib'; console.log(hello());`,
    })
    verdaccio.runInstall(installDir, '@test/mylib@99.99.99')
    expect(execSync('node test.mjs', { cwd: installDir, encoding: 'utf-8' }).trim()).toBe('Hello from mylib!')
  }, 60000)
})
