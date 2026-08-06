import type { EventBus, SubscriptionScope } from "@remixapp/runtime";
import type {
  RemixAppMount,
  RemixAppUnmount,
  RemixHostPanelContext,
  RemixKeyEvent,
  RemixProjectManifest,
} from "@remixapp/sdk";

import type { HostKeyboardLayout } from "./keyboard-layout.js";
import type { ProjectActionClient } from "./action-client.js";

export interface ProjectModule {
  mount?: RemixAppMount;
}

export interface LoadedProject {
  actions: ProjectActionClient;
  baseUrl: string;
  events: EventBus;
  keyboardLayout: HostKeyboardLayout;
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
