import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, test } from 'vitest'
import { monocrate } from './monocrate.js'
import { folderify } from './testing/folderify.js'
import { pj } from './testing/monocrate-teskit.js'

describe('publishName feature', () => {
  test('uses publishName when specified in monocrate config', async () => {
    const repoDir = folderify({
      'package.json': { name: 'root', workspaces: ['packages/*'] },
      'packages/my-package/package.json': pj('@workspace/my-package', '1.0.0', {
        monocrate: { publishName: '@published/my-package' },
      }),
      'packages/my-package/dist/index.js': 'export const foo = "bar";\n',
    })

    const { outputDir } = await monocrate({
      cwd: repoDir,
      pathToSubjectPackages: path.join(repoDir, 'packages/my-package'),
      monorepoRoot: repoDir,
      publish: false,
    })

    const outputPackageJson = JSON.parse(fs.readFileSync(path.join(outputDir, 'package.json'), 'utf-8')) as Record<
      string,
      unknown
    >

    expect(outputPackageJson.name).toBe('@published/my-package')
    expect(outputPackageJson.monocrate).toBeUndefined()
  })

  test('uses original name when publishName is not specified', async () => {
    const repoDir = folderify({
      'package.json': { name: 'root', workspaces: ['packages/*'] },
      'packages/my-package/package.json': pj('@workspace/my-package', '1.0.0'),
      'packages/my-package/dist/index.js': 'export const foo = "bar";\n',
    })

    const { outputDir } = await monocrate({
      cwd: repoDir,
      pathToSubjectPackages: path.join(repoDir, 'packages/my-package'),
      monorepoRoot: repoDir,
      publish: false,
    })

    const outputPackageJson = JSON.parse(fs.readFileSync(path.join(outputDir, 'package.json'), 'utf-8')) as Record<
      string,
      unknown
    >

    expect(outputPackageJson.name).toBe('@workspace/my-package')
  })

  test('throws error when publishName conflicts with existing package name', async () => {
    const repoDir = folderify({
      'package.json': { name: 'root', workspaces: ['packages/*'] },
      'packages/package-a/package.json': pj('package-a', '1.0.0'),
      'packages/package-a/dist/index.js': 'export const a = "a";\n',
      'packages/package-b/package.json': pj('package-b', '1.0.0', {
        monocrate: { publishName: 'package-a' },
      }),
      'packages/package-b/dist/index.js': 'export const b = "b";\n',
    })

    await expect(
      monocrate({
        cwd: repoDir,
        pathToSubjectPackages: path.join(repoDir, 'packages/package-b'),
        monorepoRoot: repoDir,
        publish: false,
      })
    ).rejects.toThrow('has publishName "package-a" which conflicts with an existing package name')
  })

  test('throws error when two packages have the same publishName', async () => {
    const repoDir = folderify({
      'package.json': { name: 'root', workspaces: ['packages/*'] },
      'packages/package-a/package.json': pj('package-a', '1.0.0', {
        monocrate: { publishName: '@published/shared-name' },
      }),
      'packages/package-a/dist/index.js': 'export const a = "a";\n',
      'packages/package-b/package.json': pj('package-b', '1.0.0', {
        monocrate: { publishName: '@published/shared-name' },
      }),
      'packages/package-b/dist/index.js': 'export const b = "b";\n',
    })

    await expect(
      monocrate({
        cwd: repoDir,
        pathToSubjectPackages: path.join(repoDir, 'packages/package-a'),
        monorepoRoot: repoDir,
        publish: false,
      })
    ).rejects.toThrow('both have publishName "@published/shared-name"')
  })

  test('works with multiple packages having different publishNames', async () => {
    const repoDir = folderify({
      'package.json': { name: 'root', workspaces: ['packages/*'] },
      'packages/package-a/package.json': pj('@workspace/package-a', '1.0.0', {
        monocrate: { publishName: '@published/package-a' },
      }),
      'packages/package-a/dist/index.js': 'export const a = "a";\n',
      'packages/package-b/package.json': pj('@workspace/package-b', '1.0.0', {
        monocrate: { publishName: '@published/package-b' },
      }),
      'packages/package-b/dist/index.js': 'export const b = "b";\n',
    })

    const { outputDir: outputDir1 } = await monocrate({
      cwd: repoDir,
      pathToSubjectPackages: path.join(repoDir, 'packages/package-a'),
      monorepoRoot: repoDir,
      publish: false,
    })

    const { outputDir: outputDir2 } = await monocrate({
      cwd: repoDir,
      pathToSubjectPackages: path.join(repoDir, 'packages/package-b'),
      monorepoRoot: repoDir,
      publish: false,
    })

    const output1PackageJson = JSON.parse(fs.readFileSync(path.join(outputDir1, 'package.json'), 'utf-8')) as Record<
      string,
      unknown
    >
    const output2PackageJson = JSON.parse(fs.readFileSync(path.join(outputDir2, 'package.json'), 'utf-8')) as Record<
      string,
      unknown
    >

    expect(output1PackageJson.name).toBe('@published/package-a')
    expect(output2PackageJson.name).toBe('@published/package-b')
  })

  test('monocrate field is stripped from output package.json', async () => {
    const repoDir = folderify({
      'package.json': { name: 'root', workspaces: ['packages/*'] },
      'packages/my-package/package.json': pj('@workspace/my-package', '1.0.0', {
        description: 'Test package',
        monocrate: { publishName: '@published/my-package' },
      }),
      'packages/my-package/dist/index.js': 'export const foo = "bar";\n',
    })

    const { outputDir } = await monocrate({
      cwd: repoDir,
      pathToSubjectPackages: path.join(repoDir, 'packages/my-package'),
      monorepoRoot: repoDir,
      publish: false,
    })

    const outputPackageJson = JSON.parse(fs.readFileSync(path.join(outputDir, 'package.json'), 'utf-8')) as Record<
      string,
      unknown
    >

    expect(outputPackageJson.monocrate).toBeUndefined()
    expect(outputPackageJson.description).toBe('Test package')
  })
})
