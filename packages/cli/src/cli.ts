#!/usr/bin/env node
import { buildProject } from './build.js'
import { RemixCliError } from './errors.js'

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv

  if (!command || command === '--help' || command === '-h') {
    printHelp()
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

function printHelp(): void {
  console.log(`remix-cli

Usage:
  remix-cli build [--cwd <path>] [--unpack]
`)
}

main().catch((error: unknown) => {
  if (error instanceof RemixCliError) {
    console.error(`Error: ${error.message}`)
    process.exitCode = 1
    return
  }

  console.error(error)
  process.exitCode = 1
})
