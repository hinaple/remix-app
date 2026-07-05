import type { RemixProjectManifest } from './config.js'

export interface RemixProjectContext {
  name: string
  version: string
  manifest: RemixProjectManifest
}
