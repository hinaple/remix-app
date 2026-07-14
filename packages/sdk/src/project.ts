import type { RemixProjectManifest } from './config.js'

/**
 * Metadata for the currently loaded project.
 */
export interface RemixProjectContext {
  /**
   * Project name from `project.json`.
   */
  name: string

  /**
   * Project version from `project.json`.
   */
  version: string

  /**
   * Full normalized manifest used by the Host to load this project.
   */
  manifest: RemixProjectManifest

  /**
   * Stops and starts the current project again without restarting the Host APK.
   *
   * The Host owns the exact cleanup and re-mount sequence. Project code can
   * use this after returning to an initial scene or recovering from a local
   * project state error.
   */
  reset(): Promise<void>
}
