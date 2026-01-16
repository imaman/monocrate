import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { monocrate } from './index.js'

type Jsonable = Record<string, unknown>
type FolderifyRecipe = Record<string, string | Jsonable>

const tempDirs: string[] = []

function createTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

function folderify(recipe: FolderifyRecipe): string {
  const ret = createTempDir('monocrate-test-')
  const keys = Object.keys(recipe).map((p) => path.normalize(p))
  const set = new Set<string>(keys)

  for (const key of keys) {
    if (key === '.') {
      throw new Error(`bad input - the recipe contains a file name which is either empty ('') or a dot ('.')`)
    }
    for (let curr = path.dirname(key); curr !== '.'; curr = path.dirname(curr)) {
      if (set.has(curr)) {
        throw new Error(`bad input - a file (${key}) is nested under another file (${curr})`)
      }
    }
  }

  for (const [relativePath, content] of Object.entries(recipe)) {
    const file = path.join(ret, relativePath)
    const dir = path.dirname(file)
    fs.mkdirSync(dir, { recursive: true })
    if (typeof content === 'string') {
      fs.writeFileSync(file, content)
    } else {
      fs.writeFileSync(file, JSON.stringify(content, null, 2))
    }
  }

  return ret
}

function unfolderify(dir: string): FolderifyRecipe {
  const result: FolderifyRecipe = {}

  function walk(currentDir: string, prefix: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
      const fullPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath, relativePath)
      } else {
        const content = fs.readFileSync(fullPath, 'utf-8')
        if (entry.name.endsWith('.json')) {
          result[relativePath] = JSON.parse(content) as Jsonable
        } else {
          result[relativePath] = content
        }
      }
    }
  }

  walk(dir, '')
  return result
}

async function runMonocrate(
  monorepoRoot: string,
  sourcePackage: string
): Promise<{ stdout: string; output: FolderifyRecipe }> {
  const outputDir = createTempDir('monocrate-output-')

  const result = await monocrate({
    sourceDir: path.join(monorepoRoot, sourcePackage),
    outputDir,
    monorepoRoot,
  })

  if (!result.success) {
    throw new Error('monocrate failed')
  }

  const stdout = execSync(`node ${path.join(outputDir, 'index.js')}`, { encoding: 'utf-8' })
  const output = unfolderify(outputDir)

  return { stdout, output }
}

describe('monocrate e2e', () => {
  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  it('bundles a simple package with an in-repo dependency', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
      'packages/app/package.json': {
        name: '@test/app',
        version: '1.0.0',
        dependencies: {
          '@test/lib': 'workspace:*',
          chalk: '^5.0.0',
        },
      },
      'packages/app/src/index.ts': `
import { greet } from '@test/lib';
console.log(greet('World'));
`,
      'packages/lib/package.json': {
        name: '@test/lib',
        version: '1.0.0',
        dependencies: {
          lodash: '^4.17.21',
        },
      },
      'packages/lib/src/index.ts': `
export function greet(name: string): string {
  return 'Hello, ' + name + '!';
}
`,
    })

    const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app')

    expect(output['package.json']).toEqual({
      name: '@test/app',
      version: '1.0.0',
      main: 'index.js',
      dependencies: {
        chalk: '^5.0.0',
        lodash: '^4.17.21',
      },
    })

    expect(stdout.trim()).toBe('Hello, World!')
  })

  it('bundles only the requested package when monorepo has multiple packages', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
      // First app with its own lib and external dep
      'packages/app-alpha/package.json': {
        name: '@test/app-alpha',
        version: '1.0.0',
        dependencies: {
          '@test/lib-alpha': 'workspace:*',
          chalk: '^5.0.0',
        },
      },
      'packages/app-alpha/src/index.ts': `
import { getAlpha } from '@test/lib-alpha';
console.log('Alpha: ' + getAlpha());
`,
      'packages/lib-alpha/package.json': {
        name: '@test/lib-alpha',
        version: '1.0.0',
        dependencies: {
          lodash: '^4.17.21',
        },
      },
      'packages/lib-alpha/src/index.ts': `
export function getAlpha(): string {
  return 'ALPHA';
}
`,
      // Second app with its own lib and different external dep
      'packages/app-beta/package.json': {
        name: '@test/app-beta',
        version: '2.0.0',
        dependencies: {
          '@test/lib-beta': 'workspace:*',
          zod: '^3.0.0',
        },
      },
      'packages/app-beta/src/index.ts': `
import { getBeta } from '@test/lib-beta';
console.log('Beta: ' + getBeta());
`,
      'packages/lib-beta/package.json': {
        name: '@test/lib-beta',
        version: '2.0.0',
        dependencies: {
          uuid: '^9.0.0',
        },
      },
      'packages/lib-beta/src/index.ts': `
export function getBeta(): string {
  return 'BETA';
}
`,
    })

    // Bundle only app-alpha
    const alpha = await runMonocrate(monorepoRoot, 'packages/app-alpha')

    expect(alpha.output['package.json']).toEqual({
      name: '@test/app-alpha',
      version: '1.0.0',
      main: 'index.js',
      dependencies: {
        chalk: '^5.0.0',
        lodash: '^4.17.21',
      },
    })
    expect(alpha.stdout.trim()).toBe('Alpha: ALPHA')

    // Bundle only app-beta
    const beta = await runMonocrate(monorepoRoot, 'packages/app-beta')

    expect(beta.output['package.json']).toEqual({
      name: '@test/app-beta',
      version: '2.0.0',
      main: 'index.js',
      dependencies: {
        zod: '^3.0.0',
        uuid: '^9.0.0',
      },
    })
    expect(beta.stdout.trim()).toBe('Beta: BETA')
  })

  it('bundles deep chain of in-repo dependencies', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
      'packages/app/package.json': {
        name: '@test/app',
        version: '1.0.0',
        dependencies: {
          '@test/level1': 'workspace:*',
          express: '^4.18.0',
        },
      },
      'packages/app/src/index.ts': `
import { fromLevel1 } from '@test/level1';
console.log(fromLevel1());
`,
      'packages/level1/package.json': {
        name: '@test/level1',
        version: '1.0.0',
        dependencies: {
          '@test/level2': 'workspace:*',
          lodash: '^4.17.21',
        },
      },
      'packages/level1/src/index.ts': `
import { fromLevel2 } from '@test/level2';
export function fromLevel1(): string {
  return 'L1->' + fromLevel2();
}
`,
      'packages/level2/package.json': {
        name: '@test/level2',
        version: '1.0.0',
        dependencies: {
          '@test/level3': 'workspace:*',
          chalk: '^5.0.0',
        },
      },
      'packages/level2/src/index.ts': `
import { fromLevel3 } from '@test/level3';
export function fromLevel2(): string {
  return 'L2->' + fromLevel3();
}
`,
      'packages/level3/package.json': {
        name: '@test/level3',
        version: '1.0.0',
        dependencies: {
          '@test/level4': 'workspace:*',
          zod: '^3.0.0',
        },
      },
      'packages/level3/src/index.ts': `
import { fromLevel4 } from '@test/level4';
export function fromLevel3(): string {
  return 'L3->' + fromLevel4();
}
`,
      'packages/level4/package.json': {
        name: '@test/level4',
        version: '1.0.0',
        dependencies: {
          uuid: '^9.0.0',
        },
      },
      'packages/level4/src/index.ts': `
export function fromLevel4(): string {
  return 'L4';
}
`,
    })

    const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app')

    expect(output['package.json']).toEqual({
      name: '@test/app',
      version: '1.0.0',
      main: 'index.js',
      dependencies: {
        express: '^4.18.0',
        lodash: '^4.17.21',
        chalk: '^5.0.0',
        zod: '^3.0.0',
        uuid: '^9.0.0',
      },
    })

    expect(stdout.trim()).toBe('L1->L2->L3->L4')
  })

  it('works with pnpm workspaces', async () => {
    const monorepoRoot = folderify({
      'package.json': { name: 'pnpm-monorepo' },
      'pnpm-workspace.yaml': `packages:
  - 'packages/*'
`,
      'packages/app/package.json': {
        name: '@test/pnpm-app',
        version: '1.0.0',
        dependencies: {
          '@test/pnpm-lib': 'workspace:*',
          chalk: '^5.0.0',
        },
      },
      'packages/app/src/index.ts': `
import { pnpmGreet } from '@test/pnpm-lib';
console.log(pnpmGreet());
`,
      'packages/lib/package.json': {
        name: '@test/pnpm-lib',
        version: '1.0.0',
        dependencies: {
          lodash: '^4.17.21',
        },
      },
      'packages/lib/src/index.ts': `
export function pnpmGreet(): string {
  return 'pnpm works!';
}
`,
    })

    const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app')

    expect(output['package.json']).toEqual({
      name: '@test/pnpm-app',
      version: '1.0.0',
      main: 'index.js',
      dependencies: {
        chalk: '^5.0.0',
        lodash: '^4.17.21',
      },
    })

    expect(stdout.trim()).toBe('pnpm works!')
  })
})
