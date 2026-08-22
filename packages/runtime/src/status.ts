import type { RemixEventUnsubscribe, RemixReadableStatus } from "@remixapp/sdk";

import type { SubscriptionScope } from "./subscriptions.js";

export interface RuntimeStatusChannel<T> extends RemixReadableStatus<T> {
  on(listener: (status: T) => void): RemixEventUnsubscribe;
}

export interface RuntimeWritableStatus<T> extends RuntimeStatusChannel<T> {
  emit(): void;
}

export interface RuntimeListenerHandle {
  remove(): void | Promise<void>;
}

export interface LazyStatusChannelOptions<T> {
  get(): Promise<T>;
  start(): Promise<void>;
  stop(): Promise<void>;
  listen(listener: (status: T) => void): Promise<RuntimeListenerHandle>;
}

export function createMemoryStatusChannel<T>(
  subscriptions: SubscriptionScope,
  read: () => T,
): RuntimeWritableStatus<T> {
  const listeners = new Set<(status: T) => void>();

  return {
    get: async () => read(),
    on: (listener) => {
      listeners.add(listener);
      listener(read());

      return subscriptions.add(() => {
        listeners.delete(listener);
      });
    },
    emit: () => {
      const status = read();

      for (const listener of listeners) {
        listener(status);
      }
    },
  };
}

export class LazyStatusChannel<T> implements RuntimeStatusChannel<T> {
  private readonly listeners = new Set<(status: T) => void>();
  private listenerHandle: RuntimeListenerHandle | undefined;
  private transition: Promise<void> = Promise.resolve();

  constructor(
    private readonly subscriptions: SubscriptionScope,
    private readonly options: LazyStatusChannelOptions<T>,
  ) {}

  get(): Promise<T> {
    return this.options.get();
  }

  on(listener: (status: T) => void): RemixEventUnsubscribe {
    this.listeners.add(listener);
    void this.reconcile().catch((error: unknown) => {
      console.error("Failed to start native status updates", error);
    });

    return this.subscriptions.add(() => this.remove(listener));
  }

  private async remove(listener: (status: T) => void): Promise<void> {
    this.listeners.delete(listener);
    await this.reconcile();
  }

  private reconcile(): Promise<void> {
    const transition = this.transition
      .catch(() => undefined)
      .then(() => this.applyDesiredState());
    this.transition = transition;
    return transition;
  }

  private async applyDesiredState(): Promise<void> {
    while (true) {
      if (this.listeners.size > 0 && !this.listenerHandle) {
        const handle = await this.options.listen((status) => {
          for (const listener of this.listeners) {
            listener(status);
          }
        });

        try {
          await this.options.start();
          this.listenerHandle = handle;
        } catch (error) {
          try {
            await handle.remove();
          } finally {
            await this.options.stop();
          }
          throw error;
        }
        continue;
      }

      if (this.listeners.size === 0 && this.listenerHandle) {
        const handle = this.listenerHandle;
        this.listenerHandle = undefined;

        try {
          await handle.remove();
        } finally {
          await this.options.stop();
        }
        continue;
      }

      return;
    }
  }
}
