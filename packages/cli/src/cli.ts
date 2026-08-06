#!/usr/bin/env node
import { buildProject } from './build.js'
import { devProject } from './dev.js'
import { deployProject } from './deploy.js'
import { RemixCliError } from './errors.js'
import { AndroidToolsError } from '../android-tools/index.mjs'

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv

  if (!command || command === '--help' || command === '-h') {
    printHelp()
    return
  }

  if (command === 'dev') {
    await devProject(parseDevOptions(args))
    return
  }

  if (command === 'deploy') {
    await deployProject(parseDeployOptions(args))
    return
  }

  if (command !== 'build') {
    throw new RemixCliError(`Unknown command: ${command}`)
  }

  const options = parseBuildOptions(args)
  const outputFile = await buildProject(options)
  console.log(`Created ${outputFile}`)
}

function parseBuildOptions(args: string[]): { cwd: string; unpack: boolean } {
  let cwd = process.cwd()
  let unpack = false

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--cwd') {
      const value = args[index + 1]

      if (!value) {
        throw new RemixCliError('Missing value for --cwd')
      }

      cwd = value
      index += 1
      continue
    }

    if (arg === '--unpack') {
      unpack = true
      continue
    }

    throw new RemixCliError(`Unknown option: ${arg}`)
  }

  return { cwd, unpack }
}

function parseDeployOptions(args: string[]): {
  cwd: string
  device?: string
  build: boolean
} {
  let cwd = process.cwd()
  let device: string | undefined
  let build = true

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--cwd') {
      const value = args[index + 1]

      if (!value) {
        throw new RemixCliError('Missing value for --cwd')
      }

      cwd = value
      index += 1
      continue
    }

    if (arg === '--device') {
      const value = args[index + 1]

      if (!value) {
        throw new RemixCliError('Missing value for --device')
      }

      device = value
      index += 1
      continue
    }

    if (arg === '--no-build') {
      build = false
      continue
    }

    throw new RemixCliError(`Unknown option: ${arg}`)
  }

  return { cwd, device, build }
}

function parseDevOptions(args: string[]): {
  cwd: string
  host?: string | boolean
  port?: number
  open?: boolean
} {
  let cwd = process.cwd()
  let host: string | boolean | undefined
  let port: number | undefined
  let open: boolean | undefined

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--cwd') {
      const value = args[index + 1]

      if (!value) {
        throw new RemixCliError('Missing value for --cwd')
      }

      cwd = value
      index += 1
      continue
    }

    if (arg === '--host') {
      const value = args[index + 1]

      if (value && !value.startsWith('--')) {
        host = value
        index += 1
      } else {
        host = true
      }

      continue
    }

    if (arg === '--port') {
      const value = args[index + 1]

      if (!value) {
        throw new RemixCliError('Missing value for --port')
      }

      const parsed = Number(value)

      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new RemixCliError(`Invalid --port value: ${value}`)
      }

      port = parsed
      index += 1
      continue
    }

    if (arg === '--open') {
      open = true
      continue
    }

    throw new RemixCliError(`Unknown option: ${arg}`)
  }

  return { cwd, host, port, open }
}

function printHelp(): void {
  console.log(`remix-cli

Usage:
  remix-cli build [--cwd <path>] [--unpack]
  remix-cli deploy [--cwd <path>] [--device <serial>] [--no-build]
  remix-cli dev [--cwd <path>] [--host [host]] [--port <port>] [--open]
`)
}

main().catch((error: unknown) => {
  if (error instanceof RemixCliError || error instanceof AndroidToolsError) {
    console.error(`Error: ${error.message}`)
    process.exitCode = 1
    return
  }

  console.error(error)
  process.exitCode = 1
})
