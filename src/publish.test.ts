import { execSync, spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest'
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
  const ret = createTempDir('monocrate-publish-test-')
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

interface VerdaccioServer {
  process: ChildProcess
  url: string
  port: number
  configDir: string
}

function findAvailablePort(): number {
  return 4873 + Math.floor(Math.random() * 1000)
}

async function startVerdaccio(): Promise<VerdaccioServer> {
  const configDir = createTempDir('verdaccio-config-')
  const storageDir = path.join(configDir, 'storage')
  fs.mkdirSync(storageDir, { recursive: true })

  const port = findAvailablePort()

  // Create Verdaccio config file
  const configPath = path.join(configDir, 'config.yaml')
  const configContent = `
storage: ${storageDir}
auth:
  htpasswd:
    file: ${path.join(configDir, 'htpasswd')}
    max_users: 100
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
packages:
  '@test/*':
    access: $all
    publish: $all
  '**':
    access: $all
    publish: $all
    proxy: npmjs
log:
  type: stdout
  format: pretty
  level: warn
`
  fs.writeFileSync(configPath, configContent)

  // Create empty htpasswd file
  fs.writeFileSync(path.join(configDir, 'htpasswd'), '')

  const url = `http://localhost:${String(port)}`

  return new Promise((resolve, reject) => {
    const verdaccioProcess = spawn('npx', ['verdaccio', '--config', configPath, '--listen', String(port)], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    })

    let started = false
    const timeout = setTimeout(() => {
      if (!started) {
        verdaccioProcess.kill()
        reject(new Error('Verdaccio failed to start within timeout'))
      }
    }, 30000)

    const checkReady = (data: Buffer) => {
      const output = data.toString()
      if (output.includes('http address') || output.includes('listen on')) {
        started = true
        clearTimeout(timeout)
        // Give it a moment to be fully ready
        setTimeout(() => {
          resolve({
            process: verdaccioProcess,
            url,
            port,
            configDir,
          })
        }, 500)
      }
    }

    verdaccioProcess.stdout.on('data', checkReady)
    verdaccioProcess.stderr.on('data', checkReady)

    verdaccioProcess.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

function stopVerdaccio(verdaccio: VerdaccioServer): Promise<void> {
  return new Promise((resolve) => {
    verdaccio.process.on('exit', () => {
      resolve()
    })
    verdaccio.process.kill()
    // Force resolve after 5 seconds if process doesn't exit
    setTimeout(() => {
      resolve()
    }, 5000)
  })
}

describe('npm publishing with Verdaccio', () => {
  let verdaccio: VerdaccioServer | undefined

  beforeAll(async () => {
    verdaccio = await startVerdaccio()
  }, 60000)

  afterAll(async () => {
    if (verdaccio !== undefined) {
      await stopVerdaccio(verdaccio)
    }
  }, 10000)

  afterEach(() => {
    for (const dir of tempDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    }
    tempDirs.length = 0
  })

  it('publishes a simple package and it can be installed from the registry', async () => {
    if (verdaccio === undefined) {
      throw new Error('Verdaccio server not started')
    }

    const monorepoRoot = folderify({
      'package.json': { workspaces: ['packages/*'] },
      'packages/mylib/package.json': {
        name: '@test/mylib',
        version: '1.0.0',
        main: 'dist/index.js',
      },
      'packages/mylib/dist/index.js': `export function hello() { return 'Hello from mylib!'; }
`,
    })

    const outputDir = createTempDir('monocrate-output-')

    // Create .npmrc in output directory to point to Verdaccio
    // Verdaccio requires some form of auth token even with $all access
    // Using a fake token that Verdaccio will accept
    const registryHost = `localhost:${String(verdaccio.port)}`
    fs.writeFileSync(
      path.join(outputDir, '.npmrc'),
      `registry=${verdaccio.url}\n//${registryHost}/:_authToken=fake-token-for-testing\n`
    )

    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/mylib'),
      outputDir,
      monorepoRoot,
      publishToVersion: '1.0.0',
    })

    // Verify the package was published by checking npm view
    const viewResult = execSync(`npm view @test/mylib --registry=${verdaccio.url} --json`, {
      encoding: 'utf-8',
    })
    const packageInfo = JSON.parse(viewResult) as Record<string, unknown>

    expect(packageInfo.name).toBe('@test/mylib')
    expect(packageInfo.version).toBe('1.0.0')

    // Verify the package can be installed and works
    const installDir = createTempDir('npm-install-test-')
    fs.writeFileSync(
      path.join(installDir, 'package.json'),
      JSON.stringify({ name: 'test-consumer', type: 'module' })
    )

    execSync(`npm install @test/mylib@1.0.0 --registry=${verdaccio.url}`, {
      cwd: installDir,
      stdio: 'pipe',
    })

    // Run the installed package
    fs.writeFileSync(
      path.join(installDir, 'test.mjs'),
      `import { hello } from '@test/mylib'; console.log(hello());`
    )

    const output = execSync('node test.mjs', {
      cwd: installDir,
      encoding: 'utf-8',
    })

    expect(output.trim()).toBe('Hello from mylib!')
  }, 60000)
})
