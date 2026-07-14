import type { RemixEventUnsubscribe } from "@remixapp/sdk";

export type Cleanup = () => void | Promise<void>;

export class SubscriptionScope {
  private readonly cleanups = new Set<() => Promise<void>>();

  add(cleanup: Cleanup): RemixEventUnsubscribe {
    let active = true;

    const run = async () => {
      if (!active) {
        return;
      }

      active = false;
      this.cleanups.delete(run);
      await cleanup();
    };

    this.cleanups.add(run);

    return () => {
      void run();
    };
  }

  async clear(): Promise<void> {
    const cleanups = [...this.cleanups];
    this.cleanups.clear();

    await Promise.all(cleanups.map((cleanup) => cleanup()));
  }
}
