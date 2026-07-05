import type { UserConfigExport as ViteConfig } from 'vite'

import type { RemixKey } from './keys.js'

export interface RemixConfig {
  name: string
  version: string
  entry: string
  styles?: string[]
  kiosk?: boolean
  runtime?: RemixRuntimePolicy
  screen?: RemixScreenPolicy
  input?: RemixInputPolicy
  vite?: ViteConfig
}

export interface RemixProjectManifest {
  name: string
  version: string
  entry: 'src/index.js'
  styles: ['src/style.css']
  kiosk?: boolean
  runtime?: RemixRuntimePolicy
  screen?: RemixScreenPolicy
  input?: RemixInputPolicy
}

export interface RemixRuntimePolicy {
  foreground?: boolean
  keepCpuAwake?: boolean
}

export interface RemixScreenPolicy {
  keepOn?: boolean
  timeout?: number
}

export interface RemixInputPolicy {
  capturedKeys?: RemixKey[]
  captureBack?: boolean
}

export function defineConfig(config: RemixConfig): RemixConfig {
  return config
}
