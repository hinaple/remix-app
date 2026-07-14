import type {
  RemixHostPanelButton,
  RemixHostPanelContext,
  RemixHostPanelStatus,
} from "@remixapp/sdk";

export interface HostPanelActionOptions {
  setStatus?(message: string): void;
  setError?(message: string): void;
}

type StatusTags = [keyof HTMLElementTagNameMap, keyof HTMLElementTagNameMap];

export interface HostPanelContextOptions extends HostPanelActionOptions {
  statusRoot: HTMLElement | null;
  buttonRoot: HTMLElement | null;
  statusTags?: StatusTags;
}

export function createHostPanelContext(
  options: HostPanelContextOptions,
): RemixHostPanelContext {
  const statusItems = new Map<string, RemixHostPanelStatus>();
  const tags = options.statusTags ?? ["dt", "dd"];

  return {
    buttons: {
      set: (buttons) => {
        if (!options.buttonRoot) return;

        if (buttons.length === 0) {
          options.buttonRoot.hidden = true;
          return;
        }

        options.buttonRoot.hidden = false;
        options.buttonRoot?.replaceChildren(
          ...buttons.map((item) => createHostPanelButton(item, options)),
        );
      },
      clear: () => {
        options.buttonRoot?.replaceChildren();
      },
    },
    status: {
      set: (items) => {
        statusItems.clear();

        for (const item of items) {
          statusItems.set(item.id, item);
        }

        renderHostPanelStatus(options.statusRoot, statusItems, tags);
      },
      setText: (id, text) => {
        const item = statusItems.get(id);

        if (!item) {
          return;
        }

        statusItems.set(id, { ...item, text });
        renderHostPanelStatus(options.statusRoot, statusItems, tags);
      },
      remove: (id) => {
        statusItems.delete(id);
        renderHostPanelStatus(options.statusRoot, statusItems, tags);
      },
      clear: () => {
        statusItems.clear();
        renderHostPanelStatus(options.statusRoot, statusItems, tags);
      },
    },
  };
}

export function createNoopHostPanelContext(): RemixHostPanelContext {
  return {
    buttons: {
      set: () => {},
      clear: () => {},
    },
    status: {
      set: () => {},
      setText: () => {},
      remove: () => {},
      clear: () => {},
    },
  };
}

function createHostPanelButton(
  item: RemixHostPanelButton,
  options: HostPanelActionOptions,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = item.label;
  button.addEventListener("click", () => {
    void runHostPanelButtonAction(button, item, options);
  });
  return button;
}

async function runHostPanelButtonAction(
  button: HTMLButtonElement,
  item: RemixHostPanelButton,
  options: HostPanelActionOptions,
): Promise<void> {
  button.disabled = true;

  try {
    await item.action();
    options.setStatus?.(`Project action completed: ${item.label}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    options.setStatus?.(`Project action failed: ${message}`);
    options.setError?.(message);
    console.error(error);
  } finally {
    button.disabled = false;
  }
}

function renderHostPanelStatus(
  root: HTMLElement | null,
  items: Map<string, RemixHostPanelStatus>,
  tags: StatusTags,
): void {
  if (!root) {
    return;
  }

  if (items.size === 0) {
    root.hidden = true;
    return;
  }

  root.hidden = false;

  const nodes: HTMLElement[] = [];

  for (const item of items.values()) {
    const label = document.createElement(tags[0]);
    const text = document.createElement(tags[1]);
    label.textContent = item.label;
    text.textContent = item.text;
    nodes.push(label, text);
  }

  root.replaceChildren(...nodes);
}
