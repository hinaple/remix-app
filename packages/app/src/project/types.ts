import type { PluginListenerHandle } from "@capacitor/core";
import type { EventBus, SubscriptionScope } from "@remixapp/runtime";
import type {
  RemixAppMount,
  RemixAppUnmount,
  RemixHostPanelContext,
  RemixKeyEvent,
  RemixProjectManifest,
} from "@remixapp/sdk";

import type { HostKeyboardLayout } from "./keyboard-layout.js";

export interface ProjectModule {
  mount?: RemixAppMount;
}

export interface LoadedProject {
  baseUrl: string;
  events: EventBus;
  keyListener: PluginListenerHandle;
  keyboardLayout: HostKeyboardLayout;
  lifecycleListener: PluginListenerHandle;
  manifest: RemixProjectManifest;
  styleLinks: HTMLLinkElement[];
  subscriptions: SubscriptionScope;
  unmount?: RemixAppUnmount;
}

export interface RemixProjectStartResult {
  baseUrl: string;
  manifest: RemixProjectManifest;
}

export interface RemixProjectRuntimeOptions {
  onKey?: (event: RemixKeyEvent) => void;
  hostPanel?: RemixHostPanelContext;
}
