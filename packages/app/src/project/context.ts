import type { EventBus } from "@remixapp/runtime";
import type {
  RemixAppContext,
  RemixConstantsContext,
  RemixHostPanelContext,
  RemixProjectManifest,
} from "@remixapp/sdk";

import { createDeviceContext } from "./device-context.js";
import {
  createHostPanelActionContext,
  type ProjectActionClient,
} from "./action-client.js";
import type { NativeProjectEventBindings } from "./native-events.js";

export interface ProjectContextOptions {
  manifest: RemixProjectManifest;
  baseUrl: string;
  events: EventBus;
  nativeEvents: NativeProjectEventBindings;
  actions: ProjectActionClient;
  constants: RemixConstantsContext;
}

export function createProjectContext(
  options: ProjectContextOptions,
): RemixAppContext {
  return {
    project: {
      name: options.manifest.name,
      version: options.manifest.version,
      manifest: options.manifest,
      reset: () => options.actions.invoke("project.reset"),
    },
    constants: Object.freeze({ ...options.constants }),
    resources: {
      url: (resourcePath) =>
        new URL(resourcePath, new URL("resources/", options.baseUrl)).href,
    },
    device: createDeviceContext(
      options.actions,
      options.nativeEvents.status,
      options.nativeEvents.keyboard,
    ),
    events: options.events,
    mqtt: options.nativeEvents.mqtt,
    host: {
      panel: createHostPanelActionContext(options.actions),
    },
  };
}

export function clearHostPanel(
  hostPanel: RemixHostPanelContext | undefined,
): void {
  hostPanel?.buttons.clear();
  hostPanel?.status.clear();
}
