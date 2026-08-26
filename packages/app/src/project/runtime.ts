import {
  EventBus,
  SubscriptionScope,
  createNoopHostPanelContext,
} from "@remixapp/runtime";

import { createProjectContext, clearHostPanel } from "./context.js";
import { ProjectActionClient } from "./action-client.js";
import { RemixCore } from "@remixapp/core";
import {
  createHostKeyboardLayout,
  type HostKeyboardLayout,
} from "./keyboard-layout.js";
import { loadManifest } from "./manifest.js";
import { loadProjectModule } from "./module-loader.js";
import { clearProjectMountHost, createProjectMountHost } from "./mount-host.js";
import { bindNativeProjectEvents } from "./native-events.js";
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
    const { manifest, configuration } = await loadManifest();
    const subscriptions = new SubscriptionScope();
    const events = new EventBus(subscriptions);
    const hostPanel = this.options.hostPanel ?? createNoopHostPanelContext();
    const actions = new ProjectActionClient(() => this.reset(), hostPanel);
    let styleLinks: HTMLLinkElement[] = [];
    let keyboardLayout: HostKeyboardLayout | undefined;

    try {
      const nativeEvents = await bindNativeProjectEvents(
        subscriptions,
        events,
        actions,
        this.options.onKey,
      );
      const context = createProjectContext({
        manifest,
        constants: Object.fromEntries(
          configuration.constants.flatMap((constant) =>
            constant.value === undefined ? [] : [[constant.id, constant.value]],
          ),
        ),
        baseUrl: normalizedBaseUrl,
        events,
        nativeEvents,
        actions,
      });

      await applyProjectPolicy(manifest, actions);
      keyboardLayout = await createHostKeyboardLayout(this.container, manifest);
      const mountHost = createProjectMountHost(this.container);
      styleLinks = await loadStyles(
        mountHost.shadowRoot,
        normalizedBaseUrl,
        manifest,
      );

      const module = await loadProjectModule(normalizedBaseUrl, manifest);
      const unmount = await module.mount(mountHost.mountContainer, context);
      await RemixCore.setProjectRuntimeState({ mounted: true });
      this.current = {
        actions,
        baseUrl: normalizedBaseUrl,
        events,
        keyboardLayout,
        manifest,
        styleLinks,
        subscriptions,
        ...(typeof unmount === "function" ? { unmount } : {}),
      };
      events.emit("project:lifecycle", { state: "mounted" });
      return {
        baseUrl: normalizedBaseUrl,
        manifest,
        configuration,
      };
    } catch (error) {
      await RemixCore.setProjectRuntimeState({ mounted: false }).catch(
        () => undefined,
      );
      await keyboardLayout?.dispose();
      await subscriptions.clear();
      await clearProjectPolicy(actions);
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
    await RemixCore.setProjectRuntimeState({ mounted: false }).catch(
      () => undefined,
    );
    current.events.emit("project:lifecycle", { state: "destroyed" });

    try {
      await current.unmount?.();
    } finally {
      try {
        await current.subscriptions.clear();
      } finally {
        try {
          await current.keyboardLayout.dispose();
        } finally {
          try {
            await clearProjectPolicy(current.actions);
          } finally {
            clearHostPanel(this.options.hostPanel);
            removeStyles(current.styleLinks);
            clearProjectMountHost(this.container);
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
