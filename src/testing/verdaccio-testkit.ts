import type { ChildProcess } from 'node:child_process'
import { execSync, spawn } from 'node:child_process'
import { createTempDir } from './monocrate-teskit.js'
import getPort from 'get-port'
import path from 'node:path'
import fs from 'node:fs'
import { folderify } from './folderify.js'

interface VerdaccioServer {
  process: ChildProcess
  url: string
  configDir: string
}

export class VerdaccioTestkit {
  private server: VerdaccioServer | undefined = undefined

  async start() {
    this.server = await startVerdaccio()
  }

  get() {
    if (!this.server) {
      throw new Error(`Verdaccio server is not up. Did you call start()?`)
    }

    return this.server
  }

  async shutdown() {
    await stopVerdaccio(this.get())
  }

  npmRc() {
    // Verdaccio requires some form of auth token even with $all access
    // Extract host from URL for the _authToken line (npm requires host without protocol)
    const u = this.get().url
    return `registry=${u}\n//${new URL(u).host}/:_authToken=fake-token-for-testing\n`
  }

  runView(packageName: string): unknown {
    // Verify the package was published by checking npm view
    const viewResult = execSync(`npm view ${packageName} --registry=${this.get().url} --json`, {
      encoding: 'utf-8',
    })

    return JSON.parse(viewResult)
  }

  runInstall(dir: string, packageName: string) {
    // execSync throws if the command fails, which will fail the test
    execSync(`npm install ${packageName} --registry=${this.get().url}`, {
      cwd: dir,
      stdio: 'pipe',
    })
  }

  publishPackage(name: string, version: string, jsSourceCode: string) {
    const dir = folderify({
      '.npmrc': this.npmRc(),
      'package.json': { name, version, main: 'index.js' },
      'index.js': jsSourceCode,
    })
    // Publish a package directly to Verdaccio
    // execSync throws if the command fails, which will fail the test
    execSync(`npm publish --registry=${this.get().url}`, { cwd: dir, stdio: 'pipe' })
  }

  runConumser(depToInstall: string, jsSourceCode: string, fileType: 'mjs' | 'js' = 'mjs') {
    const fileName = `index.${fileType}`
    const dir = folderify({ 'package.json': { name: 'na', version: '1.0.0' }, [fileName]: jsSourceCode })
    this.runInstall(dir, depToInstall)
    return execSync(`node ${fileName}`, { cwd: dir, encoding: 'utf-8' }).trim()
  }
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
    packages: {
      '@*/*': {
        access: '$all',
        publish: '$all',
        unpublish: '$all',
      },
      '**': {
        access: '$all',
        publish: '$all',
        unpublish: '$all',
      },
    },
    log: {
      type: 'stdout',
      format: 'pretty',
      level: 'warn',
    },
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))

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
