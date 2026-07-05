import type { RemixKey } from './keys.js'

export interface RemixEventContext {
  on<K extends keyof RemixEventMap>(
    type: K,
    listener: (event: RemixEventMap[K]) => void
  ): RemixEventUnsubscribe
}

export type RemixEventUnsubscribe = () => void

export interface RemixEventMap {
  key: RemixKeyEvent
  lifecycle: RemixLifecycleEvent
}

export interface RemixKeyEvent {
  key: RemixKey
  action: 'down' | 'up'
  repeat?: boolean
}

export interface RemixLifecycleEvent {
  state: 'mounted' | 'paused' | 'resumed' | 'destroyed'
}
