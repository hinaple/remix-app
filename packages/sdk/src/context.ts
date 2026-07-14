import type { RemixDeviceContext } from './device.js'
import type { RemixEventContext } from './events.js'
import type { RemixHostContext } from './host.js'
import type { RemixProjectContext } from './project.js'
import type { RemixResourceContext } from './resources.js'

/**
 * Project entry function called by the Host APK after loading `src/index.js`.
 *
 * Project modules should export this as `mount`. The Host provides a DOM
 * container and a `RemixAppContext` that exposes project metadata, resources,
 * device controls, and Host events.
 */
export type RemixAppMount = (
  container: HTMLElement,
  context: RemixAppContext
) => void | Promise<void> | RemixAppUnmount | Promise<RemixAppUnmount>

/**
 * Optional cleanup function returned by `RemixAppMount`.
 *
 * The Host calls this when the project is unloaded or replaced. Project code
 * should remove DOM nodes, unsubscribe events, and release project-owned
 * resources here.
 */
export type RemixAppUnmount = () => void | Promise<void>

/**
 * Runtime context passed from the Host APK to the project.
 *
 * This is the main SDK surface project code uses to access Host-provided
 * capabilities. Project code should use this context instead of importing
 * Capacitor plugins or `@remixapp/core` directly.
 */
export interface RemixAppContext {
  /**
   * Metadata and manifest information for the currently loaded project.
   */
  project: RemixProjectContext

  /**
   * Access to files inside the project's built `resources/` directory.
   */
  resources: RemixResourceContext

  /**
   * Host-provided device controls.
   */
  device: RemixDeviceContext

  /**
   * Host-provided event subscription API.
   */
  events: RemixEventContext

  /**
   * Host UI and administration controls exposed to project code.
   */
  host: RemixHostContext
}
