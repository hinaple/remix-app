import type {
  RemixEventContext,
  RemixEventMap,
  RemixEventUnsubscribe,
} from "@remixapp/sdk";

import type { SubscriptionScope } from "./subscriptions.js";

export interface RuntimeEventSource<T> {
  on(listener: (event: T) => void): RemixEventUnsubscribe;
}

export class EventBus implements RemixEventContext {
  private readonly listeners = new Map<
    keyof RemixEventMap,
    Set<(event: never) => void>
  >();
  private readonly sources = new Map<
    keyof RemixEventMap,
    RuntimeEventSource<never>
  >();

  constructor(private readonly subscriptions: SubscriptionScope) {}

  on<K extends keyof RemixEventMap>(
    type: K,
    listener: (event: RemixEventMap[K]) => void,
  ): RemixEventUnsubscribe {
    const source = this.sources.get(type);

    if (source) {
      return source.on(listener as (event: never) => void);
    }

    const listeners =
      this.listeners.get(type) ?? new Set<(event: never) => void>();
    listeners.add(listener as (event: never) => void);
    this.listeners.set(type, listeners);

    return this.subscriptions.add(() => {
      listeners.delete(listener as (event: never) => void);
    });
  }

  bindSource<K extends keyof RemixEventMap>(
    type: K,
    source: RuntimeEventSource<RemixEventMap[K]>,
  ): void {
    this.sources.set(type, source as RuntimeEventSource<never>);
  }

  emit<K extends keyof RemixEventMap>(type: K, event: RemixEventMap[K]): void {
    this.listeners.get(type)?.forEach((listener) => {
      listener(event as never);
    });
  }
}
