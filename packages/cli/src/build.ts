import fs from 'node:fs/promises'
import path from 'node:path'

import type { RemixProjectManifest } from '@remixapp/sdk'
import {
  build as viteBuild,
  mergeConfig,
  type ConfigEnv,
  type InlineConfig,
  type UserConfig,
  type UserConfigExport
} from 'vite'

import { loadRemixConfig, resolveViteConfig } from './config.js'
import { fail } from './errors.js'
import { packageFileName, relativeImport, unpackedPackageDirName } from './paths.js'
import { createZipArchive } from './zip.js'

export interface BuildOptions {
  cwd: string
  unpack?: boolean
}

interface BuildPaths {
  cwd: string
  remixDir: string
  tempEntryDir: string
  tempEntry: string
  viteOutDir: string
  packageDir: string
  packageSrcDir: string
  distDir: string
}

export async function buildProject(options: BuildOptions): Promise<string> {
  const cwd = path.resolve(options.cwd)
  const { config } = await loadRemixConfig(cwd)

  const entryFile = path.resolve(cwd, config.entry)
  const styleFiles = (config.styles ?? []).map((style) => path.resolve(cwd, style))

  await assertFile(entryFile, `Configured entry does not exist: ${config.entry}`)

  for (const [index, styleFile] of styleFiles.entries()) {
    await assertFile(styleFile, `Configured style does not exist at styles[${index}]: ${config.styles?.[index]}`)
  }

  const paths = getBuildPaths(cwd)
  await prepareBuildDirs(paths)
  await createTempEntry(paths.tempEntry, entryFile, styleFiles)
  await runViteBuild(paths, config.vite)
  await stagePackage(paths, config)

  const outputFile = options.unpack
    ? path.join(paths.distDir, unpackedPackageDirName(config.name, config.version))
    : path.join(paths.distDir, packageFileName(config.name, config.version))

  if (options.unpack) {
    await fs.rm(outputFile, { recursive: true, force: true })
    await fs.cp(paths.packageDir, outputFile, { recursive: true })
  } else {
    await createZipArchive(paths.packageDir, outputFile)
  }

  return outputFile
}

function getBuildPaths(cwd: string): BuildPaths {
  const remixDir = path.join(cwd, '.remix')
  const buildDir = path.join(remixDir, 'build')
  const tempEntryDir = path.join(buildDir, 'entry')
  const viteOutDir = path.join(buildDir, 'vite')
  const packageDir = path.join(buildDir, 'package')

  return {
    cwd,
    remixDir,
    tempEntryDir,
    tempEntry: path.join(tempEntryDir, 'index.ts'),
    viteOutDir,
    packageDir,
    packageSrcDir: path.join(packageDir, 'src'),
    distDir: path.join(cwd, 'dist')
  }
}

async function prepareBuildDirs(paths: BuildPaths): Promise<void> {
  await fs.rm(paths.packageDir, { recursive: true, force: true })
  await fs.rm(paths.viteOutDir, { recursive: true, force: true })
  await fs.rm(paths.tempEntryDir, { recursive: true, force: true })
  await fs.mkdir(paths.tempEntryDir, { recursive: true })
  await fs.mkdir(paths.packageSrcDir, { recursive: true })
  await fs.mkdir(paths.distDir, { recursive: true })
}

async function createTempEntry(tempEntry: string, entryFile: string, styleFiles: string[]): Promise<void> {
  const styleImports = styleFiles.map((styleFile) => `import '${relativeImport(tempEntry, styleFile)}'`)
  const entryImport = relativeImport(tempEntry, entryFile)
  const source = [...styleImports, `export * from '${entryImport}'`, ''].join('\n')

  await fs.writeFile(tempEntry, source, 'utf8')
}

async function runViteBuild(paths: BuildPaths, userViteConfig: UserConfigExport | undefined): Promise<void> {
  const env: ConfigEnv = {
    command: 'build',
    mode: 'production'
  }
  const resolvedUserConfig = await resolveViteConfig(userViteConfig, env)
  const requiredConfig: InlineConfig = {
    configFile: false,
    root: paths.cwd,
    base: './',
    publicDir: false,
    build: {
      target: 'es2022',
      outDir: paths.viteOutDir,
      emptyOutDir: true,
      cssCodeSplit: false,
      assetsDir: '',
      lib: {
        entry: paths.tempEntry,
        formats: ['es'],
        fileName: () => 'index.js',
        cssFileName: 'style'
      },
      rollupOptions: {
        output: {
          entryFileNames: 'index.js',
          chunkFileNames: '[name]-[hash].js',
          assetFileNames: '[name]-[hash][extname]'
        }
      }
    }
  }

  const viteConfig = mergeConfig(resolvedUserConfig, requiredConfig)
  await viteBuild(viteConfig)
}

async function stagePackage(
  paths: BuildPaths,
  config: {
    name: string
    version: string
    kiosk?: boolean
    runtime?: RemixProjectManifest['runtime']
    screen?: RemixProjectManifest['screen']
    input?: RemixProjectManifest['input']
  }
): Promise<void> {
  await fs.cp(paths.viteOutDir, paths.packageSrcDir, { recursive: true })

  const entryFile = path.join(paths.packageSrcDir, 'index.js')
  await assertFile(entryFile, 'Vite build did not generate required entry: src/index.js')

  await normalizeCss(paths.packageSrcDir)
  await copyResources(paths.cwd, paths.packageDir)
  await writeProjectManifest(paths.packageDir, config)
}

async function normalizeCss(packageSrcDir: string): Promise<void> {
  const entries = await fs.readdir(packageSrcDir, { withFileTypes: true })
  const cssFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.css'))
    .map((entry) => path.join(packageSrcDir, entry.name))
    .sort((a, b) => a.localeCompare(b))

  const styleFile = path.join(packageSrcDir, 'style.css')

  if (cssFiles.length === 0) {
    await fs.writeFile(styleFile, '', 'utf8')
    return
  }

  const css = await Promise.all(cssFiles.map((file) => fs.readFile(file, 'utf8')))
  await fs.writeFile(styleFile, `${css.join('\n')}\n`, 'utf8')

  for (const file of cssFiles) {
    if (file !== styleFile) {
      await fs.rm(file, { force: true })
    }
  }
}

async function copyResources(cwd: string, packageDir: string): Promise<void> {
  const source = path.join(cwd, 'resources')
  const target = path.join(packageDir, 'resources')

  if (!(await exists(source))) {
    return
  }

  const stat = await fs.stat(source)
  if (!stat.isDirectory()) {
    fail('resources exists but is not a directory')
  }

  await fs.cp(source, target, { recursive: true })
}

async function writeProjectManifest(
  packageDir: string,
  config: {
    name: string
    version: string
    kiosk?: boolean
    runtime?: RemixProjectManifest['runtime']
    screen?: RemixProjectManifest['screen']
    input?: RemixProjectManifest['input']
  }
): Promise<void> {
  const manifest: RemixProjectManifest = {
    name: config.name,
    version: config.version,
    entry: 'src/index.js',
    styles: ['src/style.css'],
    ...(config.kiosk === undefined ? {} : { kiosk: config.kiosk }),
    ...(config.runtime === undefined ? {} : { runtime: config.runtime }),
    ...(config.screen === undefined ? {} : { screen: config.screen }),
    ...(config.input === undefined ? {} : { input: config.input })
  }

  await fs.writeFile(path.join(packageDir, 'project.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}

async function assertFile(filePath: string, message: string): Promise<void> {
  try {
    const stat = await fs.stat(filePath)

    if (!stat.isFile()) {
      fail(message)
    }
  } catch {
    fail(message)
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}
