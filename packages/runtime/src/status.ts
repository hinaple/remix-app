import type { RemixEventUnsubscribe, RemixReadableStatus } from "@remixapp/sdk";

import type { SubscriptionScope } from "./subscriptions.js";

export interface RuntimeWritableStatus<T> extends RemixReadableStatus<T> {
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

export class LazyStatusChannel<T> implements RemixReadableStatus<T> {
  private readonly listeners = new Set<(status: T) => void>();
  private listenerHandle: RuntimeListenerHandle | undefined;
  private starting: Promise<void> | undefined;
  private stopping: Promise<void> | undefined;

  constructor(
    private readonly subscriptions: SubscriptionScope,
    private readonly options: LazyStatusChannelOptions<T>,
  ) {}

  get(): Promise<T> {
    return this.options.get();
  }

  on(listener: (status: T) => void): RemixEventUnsubscribe {
    this.listeners.add(listener);

    if (this.listeners.size === 1) {
      void this.start();
    }

    return this.subscriptions.add(() => this.remove(listener));
  }

  private async start(): Promise<void> {
    if (this.listenerHandle) {
      return;
    }

    if (this.starting) {
      return this.starting;
    }

    this.starting = Promise.resolve().then(async () => {
      await this.stopping;
      this.listenerHandle = await this.options.listen((status) => {
        for (const listener of this.listeners) {
          listener(status);
        }
      });
      await this.options.start();
    });

    try {
      await this.starting;
    } finally {
      this.starting = undefined;
    }
  }

  private async remove(listener: (status: T) => void): Promise<void> {
    this.listeners.delete(listener);

    if (this.listeners.size !== 0) {
      return;
    }

    await this.stop();
  }

  private async stop(): Promise<void> {
    if (this.stopping) {
      return this.stopping;
    }

    this.stopping = Promise.resolve().then(async () => {
      await this.starting;
      await this.listenerHandle?.remove();
      this.listenerHandle = undefined;
      await this.options.stop();
    });

    try {
      await this.stopping;
    } finally {
      this.stopping = undefined;
    }
  }
}
