import type {
  RemixEventContext,
  RemixEventMap,
  RemixEventUnsubscribe,
} from "@remixapp/sdk";

import type { SubscriptionScope } from "./subscriptions.js";

export class EventBus implements RemixEventContext {
  private readonly listeners = new Map<
    keyof RemixEventMap,
    Set<(event: never) => void>
  >();

  constructor(private readonly subscriptions: SubscriptionScope) {}

  on<K extends keyof RemixEventMap>(
    type: K,
    listener: (event: RemixEventMap[K]) => void,
  ): RemixEventUnsubscribe {
    const listeners =
      this.listeners.get(type) ?? new Set<(event: never) => void>();
    listeners.add(listener as (event: never) => void);
    this.listeners.set(type, listeners);

    return this.subscriptions.add(() => {
      listeners.delete(listener as (event: never) => void);
    });
  }

  emit<K extends keyof RemixEventMap>(type: K, event: RemixEventMap[K]): void {
    this.listeners.get(type)?.forEach((listener) => {
      listener(event as never);
    });
  }
}
