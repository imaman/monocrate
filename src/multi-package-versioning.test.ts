import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { monocrate } from './index.js'
import { pj } from './testing/monocrate-teskit.js'
import { folderify } from './testing/folderify.js'
import { VerdaccioTestkit } from './testing/verdaccio-testkit.js'

describe('multi-package versioning', () => {
  const verdaccio = new VerdaccioTestkit()

  beforeAll(async () => {
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

  it('publishes multiple packages at the same version derived from max(currentVersions)', async () => {
    verdaccio.publishPackage('mpv-alpha', '1.0.0', `export const name = 'alpha'`)
    verdaccio.publishPackage('mpv-beta', '2.0.0', `export const name = 'beta'`)
    verdaccio.publishPackage('mpv-gamma', '3.0.0', `export const name = 'gamma'`)
    verdaccio.publishPackage('mpv-delta', '2.5.0', `export const name = 'delta'`)

    const monorepoRoot = folderify({
      '.npmrc': verdaccio.npmRc(),
      'package.json': { workspaces: ['packages/*'] },
      'packages/alpha/package.json': pj('mpv-alpha', '0.0.0'),
      'packages/alpha/index.js': `export const value = 'alpha-new'`,
      'packages/beta/package.json': pj('mpv-beta', '0.0.0'),
      'packages/beta/index.js': `export const value = 'beta-new'`,
      'packages/gamma/package.json': pj('mpv-gamma', '0.0.0'),
      'packages/gamma/index.js': `export const value = 'gamma-new'`,
      'packages/delta/package.json': pj('mpv-delta', '0.0.0'),
      'packages/delta/index.js': `export const value = 'delta-new'`,
    })

    const result = await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: ['packages/alpha', 'packages/beta', 'packages/gamma', 'packages/delta'],
      monorepoRoot,
      publishToVersion: 'patch',
    })

    expect(result.resolvedVersion).toBe('3.0.1')
    expect(verdaccio.runView('mpv-alpha')).toMatchObject({ version: '3.0.1' })
    expect(verdaccio.runView('mpv-beta')).toMatchObject({ version: '3.0.1' })
    expect(verdaccio.runView('mpv-gamma')).toMatchObject({ version: '3.0.1' })
    expect(verdaccio.runView('mpv-delta')).toMatchObject({ version: '3.0.1' })
    expect(result.summaries).toHaveLength(4)
    expect(result.summaries.map((s) => s.packageName).sort()).toEqual(['mpv-alpha', 'mpv-beta', 'mpv-delta', 'mpv-gamma'])
  }, 120000)
})
