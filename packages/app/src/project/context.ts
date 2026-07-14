import type { EventBus, SubscriptionScope } from "@remixapp/runtime";
import type {
  RemixAppContext,
  RemixHostPanelContext,
  RemixProjectManifest,
} from "@remixapp/sdk";

import { createDeviceContext } from "./device-context.js";

export interface ProjectContextOptions {
  manifest: RemixProjectManifest;
  baseUrl: string;
  events: EventBus;
  reset(): Promise<void>;
  hostPanel: RemixHostPanelContext;
  subscriptions: SubscriptionScope;
}

export function createProjectContext(
  options: ProjectContextOptions,
): RemixAppContext {
  return {
    project: {
      name: options.manifest.name,
      version: options.manifest.version,
      manifest: options.manifest,
      reset: options.reset,
    },
    resources: {
      url: (resourcePath) =>
        new URL(resourcePath, new URL("resources/", options.baseUrl)).href,
    },
    device: createDeviceContext(options.subscriptions),
    events: options.events,
    host: {
      panel: options.hostPanel,
    },
  };
}

export function clearHostPanel(
  hostPanel: RemixHostPanelContext | undefined,
): void {
  hostPanel?.buttons.clear();
  hostPanel?.status.clear();
}
