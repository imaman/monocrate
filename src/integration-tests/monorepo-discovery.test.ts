import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, it, expect } from 'vitest'
import { RepoExplorer } from '../repo-explorer.js'
import { AbsolutePath } from '../paths.js'
import { folderify } from '../testing/folderify.js'
import { createTempDir } from '../testing/monocrate-teskit.js'

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

  it('excludes a single package with a negative pattern', async () => {
    const monorepoRoot = folderify({
      'package.json': { name: 'my-monorepo', workspaces: ['packages/*', '!packages/excluded'] },
      'packages/app/package.json': { name: '@test/app' },
      'packages/lib/package.json': { name: '@test/lib' },
      'packages/excluded/package.json': { name: '@test/excluded' },
    })

    const explorer = await RepoExplorer.create(AbsolutePath(monorepoRoot))
    expect(explorer.listNames().sort()).toEqual(['@test/app', '@test/lib'])
  })

  it('excludes packages regardless of negative pattern position in array', async () => {
    const monorepoRoot = folderify({
      'package.json': { name: 'my-monorepo', workspaces: ['!packages/excluded', 'packages/*'] },
      'packages/app/package.json': { name: '@test/app' },
      'packages/excluded/package.json': { name: '@test/excluded' },
    })

    const explorer = await RepoExplorer.create(AbsolutePath(monorepoRoot))
    expect(explorer.listNames()).toEqual(['@test/app'])
  })

  it('excludes packages with glob wildcard in negative pattern', async () => {
    const monorepoRoot = folderify({
      'package.json': { name: 'my-monorepo', workspaces: ['packages/*', '!packages/*-internal'] },
      'packages/pkg-public/package.json': { name: '@test/pkg-public' },
      'packages/pkg-internal/package.json': { name: '@test/pkg-internal' },
      'packages/util-public/package.json': { name: '@test/util-public' },
      'packages/util-internal/package.json': { name: '@test/util-internal' },
    })

    const explorer = await RepoExplorer.create(AbsolutePath(monorepoRoot))
    expect(explorer.listNames().sort()).toEqual(['@test/pkg-public', '@test/util-public'])
  })

  it('excludes packages with negative pattern in pnpm-workspace.yaml', async () => {
    const monorepoRoot = folderify({
      'package.json': { name: 'pnpm-root' },
      'pnpm-workspace.yaml': `packages:
  - 'packages/*'
  - '!packages/excluded'
`,
      'packages/app/package.json': { name: '@test/app' },
      'packages/lib/package.json': { name: '@test/lib' },
      'packages/excluded/package.json': { name: '@test/excluded' },
    })

    const explorer = await RepoExplorer.create(AbsolutePath(monorepoRoot))
    expect(explorer.listNames().sort()).toEqual(['@test/app', '@test/lib'])
  })
})
