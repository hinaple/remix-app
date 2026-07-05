import type { RemixKey } from './keys.js'

export interface RemixDeviceContext {
  screen: RemixScreenContext
  runtime: RemixRuntimeContext
  input: RemixInputContext
}

export interface RemixScreenContext {
  wake(): Promise<void>
  setKeepOn(enabled: boolean): Promise<void>
}

export interface RemixRuntimeContext {
  keepCpuAwake(enabled: boolean): Promise<void>
}

export interface RemixInputContext {
  captureBack(enabled: boolean): Promise<void>
  captureKeys(keys: RemixKey[]): Promise<void>
}
