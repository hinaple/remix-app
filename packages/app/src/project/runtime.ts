import { RemixCore } from "@remixapp/core";
import {
  EventBus,
  SubscriptionScope,
  createNoopHostPanelContext,
} from "@remixapp/runtime";

import { createProjectContext, clearHostPanel } from "./context.js";
import {
  createHostKeyboardLayout,
  type HostKeyboardLayout,
} from "./keyboard-layout.js";
import { loadManifest } from "./manifest.js";
import { loadProjectModule } from "./module-loader.js";
import { clearProjectMountHost, createProjectMountHost } from "./mount-host.js";
import { normalizeBaseUrl } from "./paths.js";
import { applyProjectPolicy, clearProjectPolicy } from "./policy.js";
import { loadStyles, removeStyles } from "./styles.js";
import type {
  LoadedProject,
  RemixProjectRuntimeOptions,
  RemixProjectStartResult,
} from "./types.js";

export class RemixProjectRuntime {
  private current: LoadedProject | undefined;

  constructor(
    private readonly container: HTMLElement,
    private readonly options: RemixProjectRuntimeOptions = {},
  ) {}

  async start(baseUrl: string): Promise<RemixProjectStartResult> {
    await this.stop();
    clearHostPanel(this.options.hostPanel);

    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const manifest = await loadManifest(normalizedBaseUrl);
    const subscriptions = new SubscriptionScope();
    const events = new EventBus(subscriptions);
    const keyListener = await RemixCore.addListener("key", (event) => {
      this.options.onKey?.(event);
      events.emit("key", event);
    });
    const lifecycleListener = await RemixCore.addListener(
      "lifecycle",
      (event) => {
        events.emit("lifecycle", event);
      },
    );
    let styleLinks: HTMLLinkElement[] = [];
    let keyboardLayout: HostKeyboardLayout | undefined;
    const context = createProjectContext({
      manifest,
      baseUrl: normalizedBaseUrl,
      events,
      reset: () => this.reset(),
      hostPanel: this.options.hostPanel ?? createNoopHostPanelContext(),
      subscriptions,
    });

    try {
      await applyProjectPolicy(manifest);
      keyboardLayout = await createHostKeyboardLayout(this.container, manifest);
      const mountHost = createProjectMountHost(this.container);
      styleLinks = await loadStyles(
        mountHost.shadowRoot,
        normalizedBaseUrl,
        manifest,
      );

      const module = await loadProjectModule(normalizedBaseUrl, manifest);
      const unmount = await module.mount(mountHost.mountContainer, context);
      this.current = {
        baseUrl: normalizedBaseUrl,
        events,
        keyListener,
        keyboardLayout,
        lifecycleListener,
        manifest,
        styleLinks,
        subscriptions,
        ...(typeof unmount === "function" ? { unmount } : {}),
      };
      events.emit("lifecycle", { state: "mounted" });
      return {
        baseUrl: normalizedBaseUrl,
        manifest,
      };
    } catch (error) {
      await keyListener.remove();
      await lifecycleListener.remove();
      await keyboardLayout?.dispose();
      await subscriptions.clear();
      await clearProjectPolicy();
      clearHostPanel(this.options.hostPanel);
      removeStyles(styleLinks);
      clearProjectMountHost(this.container);
      throw error;
    }
  }

  async stop(): Promise<void> {
    const current = this.current;

    if (!current) {
      return;
    }

    this.current = undefined;
    current.events.emit("lifecycle", { state: "destroyed" });

    try {
      await current.unmount?.();
    } finally {
      try {
        await current.subscriptions.clear();
      } finally {
        try {
          await current.keyListener.remove();
        } finally {
          try {
            await current.lifecycleListener.remove();
          } finally {
            try {
              await current.keyboardLayout.dispose();
            } finally {
              try {
                await clearProjectPolicy();
              } finally {
                clearHostPanel(this.options.hostPanel);
                removeStyles(current.styleLinks);
                clearProjectMountHost(this.container);
              }
            }
          }
        }
      }
    }
  }

  async reset(): Promise<void> {
    const baseUrl = this.current?.baseUrl;

    if (!baseUrl) {
      throw new Error("Cannot reset because no project is mounted");
    }

    await this.stop();
    await this.start(baseUrl);
  }
}
