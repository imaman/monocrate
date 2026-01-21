import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { monocrate } from './index.js'
import { findMonorepoRoot } from './monorepo.js'
import { AbsolutePath } from './paths.js'

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

interface PackageJsonOptions {
  name: string
  dependencies?: Record<string, string>
  transform?: (pkg: Jsonable) => void
}

/**
 * Creates a package.json object with sensible defaults for npm pack compatibility.
 * Required fields (name, version) are always included.
 */
function makePackageJson(options: PackageJsonOptions): Jsonable {
  const pkg: Jsonable = {
    name: options.name,
    version: '1.0.0',
    main: 'dist/index.js',
  }

  if (options.dependencies !== undefined) {
    pkg.dependencies = options.dependencies
  }

  if (options.transform !== undefined) {
    options.transform(pkg)
  }

  return pkg
}

async function runMonocrate(monorepoRoot: string, sourcePackage: string, entryPoint = 'dist/index.js') {
  const outputDir = createTempDir('monocrate-output-')

  await monocrate({
    cwd: monorepoRoot,
    pathToSubjectPackage: path.join(monorepoRoot, sourcePackage),
    outputDir,
    monorepoRoot,
  })

  let stdout = ''
  let stderr = ''
  try {
    stdout = execSync(`node --enable-source-maps ${path.join(outputDir, entryPoint)}`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    })
  } catch (error) {
    stderr = (error as { stderr?: string }).stderr ?? stderr
  }
  const output = unfolderify(outputDir)

  return { stdout, stderr, output }
}

describe('optional output directory', () => {
  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  it('creates a temp directory when outputDir is not provided', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
      'packages/app/package.json': makePackageJson({ name: '@test/app' }),
      'packages/app/dist/index.js': `export const foo = 'foo';
`,
    })

    const outputDir = await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/app'),
      monorepoRoot,
    })

    // Verify a temp directory was created
    expect(outputDir).toContain('monocrate-')
    expect(fs.existsSync(outputDir)).toBe(true)

    // Verify the assembly was created there
    const output = unfolderify(outputDir)
    expect(output['package.json']).toEqual({
      name: '@test/app',
      version: '1.0.0',
      main: 'dist/index.js',
    })

    // Clean up the temp directory
    tempDirs.push(outputDir)
  })

  it('uses provided outputDir when specified', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
      'packages/app/package.json': makePackageJson({ name: '@test/app' }),
      'packages/app/dist/index.js': `export const foo = 'foo';
`,
    })

    const outputDir = createTempDir('monocrate-explicit-output-')
    const result = await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/app'),
      outputDir,
      monorepoRoot,
    })

    expect(result).toBe(outputDir)
  })
})

describe('monorepo discovery', () => {
  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  it('finds monorepo root with npm workspaces', () => {
    const monorepoRoot = folderify({
      'package.json': { name: 'my-monorepo', workspaces: ['packages/*'] },
      'packages/app/package.json': { name: '@test/app' },
    })

    const found = findMonorepoRoot(AbsolutePath(path.join(monorepoRoot, 'packages/app')))
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

    const found = findMonorepoRoot(AbsolutePath(path.join(monorepoRoot, 'packages/app')))
    expect(found).toBe(monorepoRoot)
  })

  it('throws when no monorepo root is found', () => {
    const tempDir = createTempDir('no-monorepo-')
    fs.mkdirSync(path.join(tempDir, 'some-package'))

    expect(() => findMonorepoRoot(AbsolutePath(path.join(tempDir, 'some-package')))).toThrow(
      'Could not find monorepo root'
    )
  })
})

describe('error handling', () => {
  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  it('handles package with no dist directory (npm pack includes only package.json)', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
      'packages/app/package.json': makePackageJson({ name: '@test/app' }),
      // No dist directory created - npm pack will still succeed with just package.json
    })

    const outputDir = createTempDir('monocrate-output-')
    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/app'),
      outputDir,
      monorepoRoot,
    })

    const output = unfolderify(outputDir)
    // npm pack always includes package.json
    expect(output).toHaveProperty('package.json')
    // dist won't exist since it wasn't created
    expect(output).not.toHaveProperty('dist/index.js')
  })

  it('throws when package.json is invalid JSON syntax', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
      'packages/app/package.json': 'invalid json {{{',
    })

    const outputDir = createTempDir('monocrate-output-')
    await expect(
      monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackage: path.join(monorepoRoot, 'packages/app'),
        outputDir,
        monorepoRoot,
      })
    ).rejects.toThrow('Unexpected token')
  })

  it('throws when package.json fails schema validation', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
      // Missing required 'name' field
      'packages/app/package.json': { version: '1.0.0', main: 'dist/index.js' },
    })

    const outputDir = createTempDir('monocrate-output-')
    await expect(
      monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackage: path.join(monorepoRoot, 'packages/app'),
        outputDir,
        monorepoRoot,
      })
    ).rejects.toThrow('Invalid package.json')
  })

  it('throws when source package directory has no package.json', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
      // No packages/app/package.json
    })

    const outputDir = createTempDir('monocrate-output-')
    await expect(
      monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackage: path.join(monorepoRoot, 'packages/app'),
        outputDir,
        monorepoRoot,
      })
    ).rejects.toThrow(`Could not find a monorepo package at ${monorepoRoot}/packages/app`)
  })

  it('works with workspace object format (packages field)', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: { packages: ['packages/*'] } },
      'packages/app/package.json': makePackageJson({
        name: '@test/app',
        dependencies: { '@test/lib': 'workspace:*' },
      }),
      'packages/app/dist/index.js': `import { greet } from '@test/lib'; console.log(greet());`,
      'packages/lib/package.json': makePackageJson({ name: '@test/lib' }),
      'packages/lib/dist/index.js': `export function greet() { return 'Hello!' }`,
    })

    const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app')

    expect(output['package.json']).toEqual({
      name: '@test/app',
      version: '1.0.0',
      main: 'dist/index.js',
    })

    expect(stdout.trim()).toBe('Hello!')
  })
})

describe('package.json transformation', () => {
  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  it('preserves exports field in package.json', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
      'packages/app/package.json': makePackageJson({
        name: '@test/app',
        transform: (pkg) => {
          pkg.types = 'dist/index.d.ts'
          pkg.exports = {
            '.': {
              types: './dist/index.d.ts',
              import: './dist/index.js',
            },
          }
        },
      }),
      'packages/app/dist/index.js': `export const foo = 'foo';
`,
      'packages/app/dist/index.d.ts': `export declare const foo: string;
`,
    })

    const outputDir = createTempDir('monocrate-output-')
    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/app'),
      outputDir,
      monorepoRoot,
    })

    const output = unfolderify(outputDir)
    const pkgJson = output['package.json'] as Record<string, unknown>

    expect(pkgJson.exports).toEqual({
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.js',
      },
    })
  })

  it('preserves metadata fields like description and keywords', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
      'packages/app/package.json': {
        name: '@test/app',
        version: '1.0.0',
        main: 'dist/index.js',
        description: 'Test package',
        keywords: ['test', 'example'],
        author: 'Test Author',
        license: 'MIT',
      },
      'packages/app/dist/index.js': `export const foo = 'foo';
`,
    })

    const outputDir = createTempDir('monocrate-output-')
    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/app'),
      outputDir,
      monorepoRoot,
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
  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  it('assembles a simple package with an in-repo dependency', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
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
      'packages/app/dist/index.js': `import { greet } from '@test/lib';
console.log(greet('World'));
`,
      'packages/app/dist/index.d.ts': `import { greet } from '@test/lib';
`,
      'packages/lib/package.json': {
        name: '@test/lib',
        version: '1.0.0',
        main: 'dist/index.js',
        types: 'dist/index.d.ts',
        dependencies: {
          lodash: '^4.17.21',
        },
      },
      'packages/lib/dist/index.js': `export function greet(name) {
  return 'Hello, ' + name + '!';
}
`,
      'packages/lib/dist/index.d.ts': `export declare function greet(name: string): string;
`,
    })

    const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app')

    expect(output['package.json']).toEqual({
      name: '@test/app',
      version: '1.0.0',
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
      'package.json': { workspaces: ['packages/*'] },
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
      'packages/app-alpha/dist/index.js': `import { getAlpha } from '@test/lib-alpha';
console.log('Alpha: ' + getAlpha());
`,
      'packages/lib-alpha/package.json': {
        name: '@test/lib-alpha',
        version: '1.0.0',
        main: 'dist/index.js',
        dependencies: {
          lodash: '^4.17.21',
        },
      },
      'packages/lib-alpha/dist/index.js': `export function getAlpha() {
  return 'ALPHA';
}
`,
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
      'packages/app-beta/dist/index.js': `import { getBeta } from '@test/lib-beta';
console.log('Beta: ' + getBeta());
`,
      'packages/lib-beta/package.json': {
        name: '@test/lib-beta',
        version: '2.0.0',
        main: 'dist/index.js',
        dependencies: {
          uuid: '^9.0.0',
        },
      },
      'packages/lib-beta/dist/index.js': `export function getBeta() {
  return 'BETA';
}
`,
    })

    // Assemble only app-alpha
    const alpha = await runMonocrate(monorepoRoot, 'packages/app-alpha')

    expect(alpha.output['package.json']).toEqual({
      name: '@test/app-alpha',
      version: '1.0.0',
      main: 'dist/index.js',
      dependencies: {
        chalk: '^5.0.0',
        lodash: '^4.17.21',
      },
    })
    expect(alpha.stdout.trim()).toBe('Alpha: ALPHA')

    // Assemble only app-beta
    const beta = await runMonocrate(monorepoRoot, 'packages/app-beta')

    expect(beta.output['package.json']).toEqual({
      name: '@test/app-beta',
      version: '2.0.0',
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
      'package.json': { workspaces: ['packages/*'] },
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

    const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app')

    expect(output['package.json']).toEqual({
      name: '@test/app',
      version: '1.0.0',
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

    const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app')

    expect(output['package.json']).toEqual({
      name: '@test/pnpm-app',
      version: '1.0.0',
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
      'package.json': { workspaces: ['packages/*'] },
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

    const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app')

    expect(output['package.json']).toEqual({
      name: '@test/app',
      version: '1.0.0',
      main: 'dist/index.js',
      dependencies: {
        chalk: '^5.0.0',
        lodash: '^4.17.21',
      },
    })

    expect(stdout.trim()).toBe('Hello, World!')
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
      'package.json': { workspaces: ['packages/*'] },
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
      'package.json': { workspaces: ['packages/*'] },
      'packages/a/package.json': makePackageJson({
        name: '@myorg/a',
        dependencies: { '@myorg/b': '*', lodash: '^4.0.0' },
        transform: (pkg) => {
          pkg.types = 'dist/index.d.ts'
        },
      }),
      'packages/a/dist/index.js': `import { foo } from '@myorg/b';
export const bar = foo;
`,
      'packages/a/dist/index.d.ts': `import { foo } from '@myorg/b';
export declare const bar: typeof foo;
`,
      'packages/b/package.json': makePackageJson({
        name: '@myorg/b',
        dependencies: { lodash: '^4.0.0' },
        transform: (pkg) => {
          pkg.types = 'dist/index.d.ts'
        },
      }),
      'packages/b/dist/index.js': `export const foo = 'foo';
`,
      'packages/b/dist/index.d.ts': `export declare const foo: string;
`,
    })

    const outputDir = createTempDir('monocrate-output-')
    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/a'),
      outputDir,
      monorepoRoot,
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
      'package.json': { workspaces: ['packages/*'] },
      'packages/a/package.json': makePackageJson({
        name: '@myorg/a',
        dependencies: { '@myorg/b': '*' },
      }),
      'packages/a/dist/index.js': `export { foo } from '@myorg/b';
export * from '@myorg/b';
`,
      'packages/b/package.json': makePackageJson({ name: '@myorg/b' }),
      'packages/b/dist/index.js': `export const foo = 'foo';
export const bar = 'bar';
`,
    })

    const outputDir = createTempDir('monocrate-output-')
    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/a'),
      outputDir,
      monorepoRoot,
    })

    const output = unfolderify(outputDir)

    // Verify export declarations have rewritten module specifiers
    const indexJs = output['dist/index.js'] as string
    expect(indexJs).toContain('../deps/packages/b/dist/index.js')
    expect(indexJs).not.toContain("'@myorg/b'")
  })

  it('leaves third-party imports unchanged', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
      'packages/a/package.json': makePackageJson({
        name: '@myorg/a',
        dependencies: { '@myorg/b': '*', lodash: '^4.0.0' },
      }),
      'packages/a/dist/index.js': `import { foo } from '@myorg/b';
import _ from 'lodash';
import * as path from 'node:path';
export const bar = foo;
`,
      'packages/b/package.json': makePackageJson({ name: '@myorg/b' }),
      'packages/b/dist/index.js': `export const foo = 'foo';
`,
    })

    const outputDir = createTempDir('monocrate-output-')
    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/a'),
      outputDir,
      monorepoRoot,
    })

    const output = unfolderify(outputDir)
    const indexJs = output['dist/index.js'] as string

    // Third-party imports should be unchanged
    expect(indexJs).toContain("from 'lodash'")
    expect(indexJs).toContain("from 'node:path'")
  })

  it('rewrites imports in nested files at different depths', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
      'packages/a/package.json': makePackageJson({
        name: '@myorg/a',
        dependencies: { '@myorg/b': '*' },
      }),
      'packages/a/dist/index.js': `import { foo } from '@myorg/b';
export { helper } from './utils/helper.js';
export const bar = foo;
`,
      'packages/a/dist/utils/helper.js': `import { foo } from '@myorg/b';
export const helper = foo + '-helper';
`,
      'packages/b/package.json': makePackageJson({ name: '@myorg/b' }),
      'packages/b/dist/index.js': `export const foo = 'foo';
`,
    })

    const outputDir = createTempDir('monocrate-output-')
    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/a'),
      outputDir,
      monorepoRoot,
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
      'packages/a/package.json': makePackageJson({
        name: '@myorg/a',
        dependencies: { '@myorg/b': '*', '@myorg/utils': '*' },
      }),
      'packages/a/dist/index.js': `import { foo } from '@myorg/b';
import { util } from '@myorg/utils';
export const bar = foo + util;
`,
      'packages/b/package.json': makePackageJson({ name: '@myorg/b' }),
      'packages/b/dist/index.js': `export const foo = 'foo';
`,
      'libs/utils/package.json': makePackageJson({ name: '@myorg/utils' }),
      'libs/utils/dist/index.js': `export const util = 'util';
`,
    })

    const outputDir = createTempDir('monocrate-output-')
    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/a'),
      outputDir,
      monorepoRoot,
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
      'packages/a/package.json': makePackageJson({
        name: '@myorg/a',
        dependencies: { '@myorg/b': '*' },
        transform: (pkg) => {
          pkg.types = 'dist/index.d.ts'
        },
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
      'packages/b/package.json': makePackageJson({
        name: '@myorg/b',
        transform: (pkg) => {
          pkg.types = 'dist/index.d.ts'
        },
      }),
      'packages/b/dist/index.js': `export const foo = 'foo';
`,
      'packages/b/dist/index.d.ts': `export declare const foo: string;
`,
    })

    const outputDir = createTempDir('monocrate-output-')
    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/a'),
      outputDir,
      monorepoRoot,
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
      'package.json': { workspaces: ['packages/*'] },
      'packages/a/package.json': makePackageJson({ name: '@myorg/a' }),
      'packages/a/dist/index.js': `import { helper } from '@myorg/a/utils/helper';
export const result = helper;
`,
      'packages/a/dist/utils/helper.js': `export const helper = 'helper';
`,
    })

    const outputDir = createTempDir('monocrate-output-')
    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/a'),
      outputDir,
      monorepoRoot,
    })

    const output = unfolderify(outputDir)
    const indexJs = output['dist/index.js'] as string

    // Self-import should be rewritten to relative path
    expect(indexJs).toContain('./utils/helper')
    expect(indexJs).not.toContain("'@myorg/a/utils/helper'")
  })

  it('handles subpath imports like @myorg/b/submodule', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
      'packages/a/package.json': makePackageJson({
        name: '@myorg/a',
        dependencies: { '@myorg/b': '*' },
      }),
      'packages/a/dist/index.js': `import { helper } from '@myorg/b/utils/helper';
export const result = helper;
`,
      // Package b uses exports field to map subpaths to dist directory
      'packages/b/package.json': makePackageJson({
        name: '@myorg/b',
        transform: (pkg) => {
          pkg.exports = {
            '.': './dist/index.js',
            './utils/*': './dist/utils/*',
          }
        },
      }),
      'packages/b/dist/index.js': `export const foo = 'foo';
`,
      'packages/b/dist/utils/helper.js': `export const helper = 'helper';
`,
    })

    const outputDir = createTempDir('monocrate-output-')
    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/a'),
      outputDir,
      monorepoRoot,
    })

    const output = unfolderify(outputDir)
    const indexJs = output['dist/index.js'] as string

    // Subpath import should be rewritten with preserved subpath
    expect(indexJs).toContain('../deps/packages/b/dist/utils/helper')
    expect(indexJs).not.toContain("'@myorg/b/utils/helper'")
  })

  it('handles dynamic imports', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
      'packages/a/package.json': makePackageJson({
        name: '@myorg/a',
        dependencies: { '@myorg/b': '*' },
      }),
      'packages/a/dist/index.js': `const b = await import('@myorg/b');
export const foo = b.foo;
`,
      'packages/b/package.json': makePackageJson({ name: '@myorg/b' }),
      'packages/b/dist/index.js': `export const foo = 'foo';
`,
    })

    const outputDir = createTempDir('monocrate-output-')
    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/a'),
      outputDir,
      monorepoRoot,
    })

    const output = unfolderify(outputDir)
    const indexJs = output['dist/index.js'] as string

    // Dynamic import should be rewritten
    expect(indexJs).toContain('../deps/packages/b/dist/index.js')
    expect(indexJs).not.toContain("import('@myorg/b')")
  })

  it('handles cross-dependency imports between in-repo deps', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
      'packages/app/package.json': makePackageJson({
        name: '@myorg/app',
        dependencies: { '@myorg/lib-a': '*' },
      }),
      'packages/app/dist/index.js': `import { a } from '@myorg/lib-a';
console.log(a);
`,
      'packages/lib-a/package.json': makePackageJson({
        name: '@myorg/lib-a',
        dependencies: { '@myorg/lib-b': '*' },
      }),
      'packages/lib-a/dist/index.js': `import { b } from '@myorg/lib-b';
export const a = 'a-' + b;
`,
      'packages/lib-b/package.json': makePackageJson({ name: '@myorg/lib-b' }),
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
  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  it('uses files property to determine what to copy', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
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

    const outputDir = createTempDir('monocrate-output-')
    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/app'),
      outputDir,
      monorepoRoot,
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
      'package.json': { workspaces: ['packages/*'] },
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

    const outputDir = createTempDir('monocrate-output-')
    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/app'),
      outputDir,
      monorepoRoot,
    })

    const output = unfolderify(outputDir)

    expect(output).toHaveProperty('dist/index.js')
    expect(output).toHaveProperty('types.d.ts')
  })

  it('uses files property for in-repo dependencies too', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
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

    const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app')

    expect(output).toMatchObject({
      'dist/index.js': `import { greet } from '../deps/packages/lib/dist/index.js'; console.log(greet());`,
      'package.json': {
        main: 'dist/index.js',
        name: '@test/app',
        version: '1.0.0',
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
      'package.json': { workspaces: ['packages/*'] },
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
      'package.json': { workspaces: ['packages/*'] },
      'packages/app/package.json': {
        name: '@test/app',
        version: '1.0.0',
        main: 'lib/index.js',
        files: ['lib'],
      },
      'packages/app/lib/index.js': `console.log('Hello from lib');
`,
    })

    const { stdout, output } = await runMonocrate(monorepoRoot, 'packages/app', 'lib/index.js')

    expect(output).toHaveProperty('lib/index.js')
    expect(stdout.trim()).toBe('Hello from lib')
  })

  it('skips non-existent entries in files array gracefully', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
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
      'package.json': { workspaces: ['packages/*'] },
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

    const outputDir = createTempDir('monocrate-output-')
    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/app'),
      outputDir,
      monorepoRoot,
    })

    const output = unfolderify(outputDir)
    const pkgJson = output['package.json'] as Record<string, unknown>

    expect(pkgJson.files).toEqual(['dist', 'bin'])
  })

  // TODO(imaman): publish to a test registry
})

// TODO(imaman): move this to a separate test file
describe('version conflict detection', () => {
  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  it('throws with detailed error message when packages require different versions', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
      'packages/app/package.json': makePackageJson({
        name: '@test/app',
        dependencies: { '@test/lib': 'workspace:*', lodash: '^4.17.0' },
      }),
      'packages/app/dist/index.js': `import { greet } from '@test/lib'; console.log(greet());`,
      'packages/lib/package.json': makePackageJson({
        name: '@test/lib',
        dependencies: { lodash: '^3.10.0' },
      }),
      'packages/lib/dist/index.js': `export function greet() { return 'Hello!'; }`,
    })

    const outputDir = createTempDir('monocrate-output-')
    await expect(
      monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackage: path.join(monorepoRoot, 'packages/app'),
        outputDir,
        monorepoRoot,
      })
    ).rejects.toThrow(
      'Third-party dependency version conflicts detected:\n' +
        '  - lodash: ^3.10.0 (by @test/lib), ^4.17.0 (by @test/app)'
    )
  })

  it('lists all conflicting dependencies when multiple conflicts exist', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
      'packages/app/package.json': makePackageJson({
        name: '@test/app',
        dependencies: { '@test/lib': 'workspace:*', lodash: '^4.17.0', chalk: '^5.0.0' },
      }),
      'packages/app/dist/index.js': `import { greet } from '@test/lib'; console.log(greet());`,
      'packages/lib/package.json': makePackageJson({
        name: '@test/lib',
        dependencies: { lodash: '^3.10.0', chalk: '^4.0.0' },
      }),
      'packages/lib/dist/index.js': `export function greet() { return 'Hello!'; }`,
    })

    const outputDir = createTempDir('monocrate-output-')
    await expect(
      monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackage: path.join(monorepoRoot, 'packages/app'),
        outputDir,
        monorepoRoot,
      })
    ).rejects.toThrow('lodash')
  })

  it('allows same dependency with identical versions across packages', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
      'packages/app/package.json': makePackageJson({
        name: '@test/app',
        dependencies: { '@test/lib': 'workspace:*', lodash: '^4.17.21' },
      }),
      'packages/app/dist/index.js': `import { greet } from '@test/lib'; console.log(greet());`,
      'packages/lib/package.json': makePackageJson({
        name: '@test/lib',
        dependencies: { lodash: '^4.17.21' },
      }),
      'packages/lib/dist/index.js': `export function greet() { return 'Hello!'; }`,
    })

    const { stdout } = await runMonocrate(monorepoRoot, 'packages/app')

    expect(stdout.trim()).toBe('Hello!')
  })

  it('detects conflicts in deep dependency chains', async () => {
    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
      'packages/app/package.json': makePackageJson({
        name: '@test/app',
        dependencies: { '@test/level1': 'workspace:*', zod: '^3.0.0' },
      }),
      'packages/app/dist/index.js': `import { fromLevel1 } from '@test/level1'; console.log(fromLevel1());`,
      'packages/level1/package.json': makePackageJson({
        name: '@test/level1',
        dependencies: { '@test/level2': 'workspace:*' },
      }),
      'packages/level1/dist/index.js': `import { fromLevel2 } from '@test/level2'; export function fromLevel1() { return fromLevel2(); }`,
      'packages/level2/package.json': makePackageJson({
        name: '@test/level2',
        dependencies: { zod: '^2.0.0' },
      }),
      'packages/level2/dist/index.js': `export function fromLevel2() { return 'level2'; }`,
    })

    const outputDir = createTempDir('monocrate-output-')
    await expect(
      monocrate({
        cwd: monorepoRoot,
        pathToSubjectPackage: path.join(monorepoRoot, 'packages/app'),
        outputDir,
        monorepoRoot,
      })
    ).rejects.toThrow('zod')
  })
})
