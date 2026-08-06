import { RemixCore } from "@remixapp/core";
import {
  normalizeRemixActionCall,
  type RemixActionArgsMap,
  type RemixActionType,
  type RemixHostPanelContext,
} from "@remixapp/sdk";

export class ProjectActionClient {
  constructor(
    private readonly reset: () => Promise<void>,
    private readonly hostPanel: RemixHostPanelContext,
  ) {}

  invoke<Type extends RemixActionType>(
    type: Type,
    ...args: RemixActionArgsMap[Type] extends Record<string, never>
      ? []
      : [RemixActionArgsMap[Type]]
  ): Promise<void>;
  async invoke(
    type: RemixActionType,
    ...argsList: [RemixActionArgsMap[RemixActionType]?]
  ): Promise<void> {
    const args = argsList[0];
    const action = normalizeRemixActionCall({ type, args });

    if (action.executor === "native") {
      await RemixCore.executeAction({ type: action.type, args: action.args });
      return;
    }

    await this.executeWeb(action.type, action.args);
  }

  invokeWebSync(
    type:
      | "host.panel.buttons.set"
      | "host.panel.buttons.clear"
      | "host.panel.status.set"
      | "host.panel.status.setText"
      | "host.panel.status.remove"
      | "host.panel.status.clear",
    args?: Record<string, unknown>,
  ): void {
    const action = normalizeRemixActionCall({ type, args });
    const result = this.executeWebHandler(action.type, action.args);

    if (result instanceof Promise) {
      void result.catch((error: unknown) => {
        console.error(`Failed to execute WebView action ${type}`, error);
      });
    }
  }

  async executeWeb(type: string, args: Record<string, unknown>): Promise<void> {
    const action = normalizeRemixActionCall({ type, args });

    if (action.executor !== "webview") {
      throw new Error(`Action is not a WebView action: ${type}`);
    }

    await this.executeWebHandler(action.type, action.args);
  }

  private executeWebHandler(
    type: RemixActionType,
    args: Record<string, unknown>,
  ): void | Promise<void> {
    switch (type) {
      case "project.reset":
        return this.reset();
      case "host.panel.buttons.set":
        this.hostPanel.buttons.set(
          args.buttons as RemixActionArgsMap["host.panel.buttons.set"]["buttons"],
        );
        return;
      case "host.panel.buttons.clear":
        this.hostPanel.buttons.clear();
        return;
      case "host.panel.status.set":
        this.hostPanel.status.set(
          args.status as RemixActionArgsMap["host.panel.status.set"]["status"],
        );
        return;
      case "host.panel.status.setText":
        this.hostPanel.status.setText(args.id as string, args.text as string);
        return;
      case "host.panel.status.remove":
        this.hostPanel.status.remove(args.id as string);
        return;
      case "host.panel.status.clear":
        this.hostPanel.status.clear();
        return;
      default:
        throw new Error(`No WebView handler registered for action: ${type}`);
    }
  }
}

export function createHostPanelActionContext(
  actions: ProjectActionClient,
): RemixHostPanelContext {
  return {
    buttons: {
      set: (buttons) =>
        actions.invokeWebSync("host.panel.buttons.set", { buttons }),
      clear: () => actions.invokeWebSync("host.panel.buttons.clear"),
    },
    status: {
      set: (status) => actions.invokeWebSync("host.panel.status.set", { status }),
      setText: (id, text) =>
        actions.invokeWebSync("host.panel.status.setText", { id, text }),
      remove: (id) => actions.invokeWebSync("host.panel.status.remove", { id }),
      clear: () => actions.invokeWebSync("host.panel.status.clear"),
    },
  };
}
