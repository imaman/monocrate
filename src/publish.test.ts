import { execSync, spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import getPort from 'get-port'
import { monocrate } from './index.js'
import { createTempDir } from './testing/monocrate-teskit.js'
import { folderify } from './testing/folderify.js'

interface VerdaccioServer {
  process: ChildProcess
  url: string
  configDir: string
}

async function startVerdaccio(): Promise<VerdaccioServer> {
  const configDir = createTempDir('verdaccio-config-')
  const storageDir = path.join(configDir, 'storage')
  fs.mkdirSync(storageDir, { recursive: true })

  const port = await getPort()
  const url = `http://localhost:${String(port)}`

  // Create Verdaccio config file (JSON format)
  const configPath = path.join(configDir, 'config.json')
  const config = {
    storage: storageDir,
    auth: {
      htpasswd: {
        file: path.join(configDir, 'htpasswd'),
        max_users: 100,
      },
    },
    uplinks: {
      npmjs: {
        url: 'https://registry.npmjs.org/',
      },
    },
    packages: {
      '@test/*': {
        access: '$all',
        publish: '$all',
      },
      '**': {
        access: '$all',
        publish: '$all',
        proxy: 'npmjs',
      },
    },
    log: {
      type: 'stdout',
      format: 'pretty',
      level: 'warn',
    },
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))

  // Create empty htpasswd file
  fs.writeFileSync(path.join(configDir, 'htpasswd'), '')

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
    // Remove npm_config_* environment variables that yarn sets,
    // so npm uses the .npmrc file from the output directory
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('npm_config_')) {
        delete process.env[key] // eslint-disable-line @typescript-eslint/no-dynamic-delete
      }
    }
    verdaccio = await startVerdaccio()
  }, 60000)

  afterAll(async () => {
    if (verdaccio !== undefined) {
      await stopVerdaccio(verdaccio)
    }
  }, 10000)

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
    // Extract host from URL for the _authToken line (npm requires host without protocol)
    const registryHost = new URL(verdaccio.url).host
    fs.writeFileSync(
      path.join(outputDir, '.npmrc'),
      `registry=${verdaccio.url}\n//${registryHost}/:_authToken=fake-token-for-testing\n`
    )

    await monocrate({
      cwd: monorepoRoot,
      pathToSubjectPackage: path.join(monorepoRoot, 'packages/mylib'),
      outputDir,
      monorepoRoot,
      publishToVersion: '99.99.99',
    })

    // Verify the package was published by checking npm view
    const viewResult = execSync(`npm view @test/mylib --registry=${verdaccio.url} --json`, {
      encoding: 'utf-8',
    })

    expect(JSON.parse(viewResult)).toMatchObject({
      name: '@test/mylib',
      version: '99.99.99',
    })

    // Verify the package can be installed and works
    const installDir = folderify({
      'package.json': { name: 'test-consumer', type: 'module' },
      'test.mjs': `import { hello } from '@test/mylib'; console.log(hello());`,
    })

    // execSync throws if the command fails, which will fail the test
    execSync(`npm install @test/mylib@99.99.99 --registry=${verdaccio.url}`, {
      cwd: installDir,
      stdio: 'pipe',
    })

    const output = execSync('node test.mjs', {
      cwd: installDir,
      encoding: 'utf-8',
    })

    expect(output.trim()).toBe('Hello from mylib!')
  }, 60000)
})
