import type { RemixDeviceContext } from './device.js'
import type { RemixEventContext } from './events.js'
import type { RemixProjectContext } from './project.js'
import type { RemixResourceContext } from './resources.js'

export type RemixAppMount = (
  container: HTMLElement,
  context: RemixAppContext
) => void | Promise<void> | RemixAppUnmount | Promise<RemixAppUnmount>

export type RemixAppUnmount = () => void | Promise<void>

export interface RemixAppContext {
  project: RemixProjectContext
  resources: RemixResourceContext
  device: RemixDeviceContext
  events: RemixEventContext
}
