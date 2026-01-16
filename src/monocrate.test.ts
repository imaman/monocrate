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

    const outputDir = createTempDir('monocrate-output-')

    const result = await monocrate({
      sourceDir: path.join(monorepoRoot, 'packages/app'),
      outputDir,
      monorepoRoot,
    })

    expect(result.success).toBe(true)

    const output = unfolderify(outputDir)

    expect(output['package.json']).toEqual({
      name: '@test/app',
      version: '1.0.0',
      main: 'index.js',
      dependencies: {
        chalk: '^5.0.0',
        lodash: '^4.17.21',
      },
    })

    const stdout = execSync(`node ${path.join(outputDir, 'index.js')}`, { encoding: 'utf-8' })
    expect(stdout.trim()).toBe('Hello, World!')
  })
})
