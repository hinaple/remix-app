import type {
  RemixAppContext,
  RemixAppMount,
  RemixBatteryStatus,
  RemixKeyboardStatus,
  RemixKeyEvent,
  RemixLifecycleEvent,
  RemixNetworkStatus,
  RemixScreenStatus,
} from "@remixapp/sdk";

type Unsubscribe = () => void;

export const mount: RemixAppMount = (container, context) => {
  container.classList.add("remix-example");

  const root = element("main", "example-shell");
  const header = element("header", "example-header");
  const title = element("h1", undefined, "remixApp example");
  const subtitle = element(
    "p",
    "example-subtitle",
    `${context.project.name} ${context.project.version}`,
  );
  header.append(title, subtitle);

  const status = element("p", "example-status", "Mounted");
  const panels = element("section", "example-grid");

  const devicePanel = createPanel("Device actions");
  devicePanel.body.append(
    createButton("Wake screen", async () => {
      await context.device.screen.wake();
      setStatus("Screen wake requested");
    }),
    createButton("Brightness 35%", async () => {
      await context.device.screen.setAutoBrightness(false);
      await context.device.screen.setBrightness(0.35);
      setStatus("Brightness set to 35%");
    }),
    createButton("Brightness 100%", async () => {
      await context.device.screen.setBrightness(1);
      setStatus("Brightness restored to 100%");
    }),
    createButton("Vibrate", async () => {
      await context.device.vibration.trigger(180);
      setStatus("Vibration requested");
    }),
  );

  const runtimePanel = createPanel("Runtime controls");
  runtimePanel.body.append(
    createButton("Enable keep CPU awake", async () => {
      await context.device.runtime.keepCpuAwake(true);
      setStatus("CPU keep-awake enabled");
    }),
    createButton("Set volume 50%", async () => {
      await context.device.audio.setVolume(0.5);
      const volume = await context.device.audio.getVolume();
      setStatus(`Media volume ${formatPercent(volume)}`);
    }),
    createButton("Reset project", async () => {
      await context.project.reset();
    }),
  );

  const statusPanel = createPanel("Live status");
  const batteryRow = createStatusRow("Battery", "reading...");
  const networkRow = createStatusRow("Network", "reading...");
  const screenRow = createStatusRow("Screen", "reading...");
  const keyboardRow = createStatusRow("Keyboard", "reading...");
  const eventRow = createStatusRow("Last event", "none");
  statusPanel.body.append(
    batteryRow.node,
    networkRow.node,
    screenRow.node,
    keyboardRow.node,
    eventRow.node,
  );

  const resourcePanel = createPanel("Resources");
  const resourceUrl = context.resources.url("notes/briefing.txt");
  const resourceLink = document.createElement("button");
  resourceLink.textContent = "Open briefing resource";
  resourceLink.addEventListener("click", async () => {
    alert(
      `Content of briefing.txt: \n${await fetch(resourceUrl).then((r) => r.text())}`,
    );
  });
  const resourceText = element("p", "example-resource", resourceUrl);
  resourcePanel.body.append(resourceLink, resourceText);

  const inputPanel = createPanel("Input");
  const input = document.createElement("input");
  inputPanel.body.append(input);

  panels.append(
    devicePanel.node,
    runtimePanel.node,
    statusPanel.node,
    resourcePanel.node,
    inputPanel.node,
  );
  root.append(header, status, panels);
  container.append(root);

  let hostActionCount = 0;
  context.host.panel.status.set([
    {
      id: "example-mounted",
      label: "Example",
      text: "Mounted",
    },
    {
      id: "example-event",
      label: "Last event",
      text: "none",
    },
  ]);
  context.host.panel.buttons.set([
    {
      label: "Example wake",
      action: async () => {
        await context.device.screen.wake();
        hostActionCount += 1;
        context.host.panel.status.setText(
          "example-event",
          `wake ${hostActionCount}`,
        );
      },
    },
    {
      label: "Example vibrate",
      action: async () => {
        await context.device.vibration.trigger(120);
        hostActionCount += 1;
        context.host.panel.status.setText(
          "example-event",
          `vibrate ${hostActionCount}`,
        );
      },
    },
  ]);

  const unsubscribers: Unsubscribe[] = [
    context.device.status.battery.on((value) => {
      batteryRow.set(formatBattery(value));
      context.host.panel.status.setText("example-mounted", "Battery updated");
    }),
    context.device.status.network.on((value) => {
      networkRow.set(formatNetwork(value));
    }),
    context.device.status.screen.on((value) => {
      screenRow.set(formatScreen(value));
    }),
    context.device.keyboard.on((value) => {
      keyboardRow.set(formatKeyboard(value));
    }),
    context.events.on("key", (event) => {
      eventRow.set(formatKeyEvent(event));
      context.host.panel.status.setText("example-event", formatKeyEvent(event));
    }),
    context.events.on("lifecycle", (event) => {
      eventRow.set(formatLifecycleEvent(event));
      context.host.panel.status.setText(
        "example-event",
        formatLifecycleEvent(event),
      );
    }),
  ];

  void readInitialStatus(
    context,
    batteryRow.set,
    networkRow.set,
    screenRow.set,
    keyboardRow.set,
  );

  function setStatus(value: string): void {
    status.textContent = value;
    context.host.panel.status.setText("example-mounted", value);
  }

  return () => {
    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }

    context.host.panel.buttons.clear();
    context.host.panel.status.clear();
    root.remove();
    container.classList.remove("remix-example");
  };
};

async function readInitialStatus(
  context: RemixAppContext,
  setBattery: (value: string) => void,
  setNetwork: (value: string) => void,
  setScreen: (value: string) => void,
  setKeyboard: (value: string) => void,
): Promise<void> {
  const [battery, network, screen, keyboard] = await Promise.all([
    context.device.status.battery.get(),
    context.device.status.network.get(),
    context.device.status.screen.get(),
    context.device.keyboard.get(),
  ]);

  setBattery(formatBattery(battery));
  setNetwork(formatNetwork(network));
  setScreen(formatScreen(screen));
  setKeyboard(formatKeyboard(keyboard));
}

function createPanel(title: string): { node: HTMLElement; body: HTMLElement } {
  const node = element("article", "example-panel");
  const heading = element("h2", undefined, title);
  const body = element("div", "example-panel-body");
  node.append(heading, body);
  return { node, body };
}

function createButton(
  label: string,
  action: () => void | Promise<void>,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", () => {
    button.disabled = true;
    Promise.resolve(action()).finally(() => {
      button.disabled = false;
    });
  });
  return button;
}

function createStatusRow(
  label: string,
  value: string,
): { node: HTMLElement; set(value: string): void } {
  const node = element("div", "example-status-row");
  const labelNode = element("span", undefined, label);
  const valueNode = element("strong", undefined, value);
  node.append(labelNode, valueNode);

  return {
    node,
    set: (nextValue) => {
      valueNode.textContent = nextValue;
    },
  };
}

function element<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tagName);

  if (className) {
    node.className = className;
  }

  if (text !== undefined) {
    node.textContent = text;
  }

  return node;
}

function formatBattery(status: RemixBatteryStatus): string {
  return `${formatPercent(status.level)} ${status.charging ? "charging" : "not charging"}`;
}

function formatNetwork(status: RemixNetworkStatus): string {
  return `${status.connected ? "connected" : "offline"} (${status.type})`;
}

function formatScreen(status: RemixScreenStatus): string {
  const parts = [
    status.interactive ? "interactive" : "not interactive",
    `keepOn=${status.keepOn}`,
    `auto=${status.autoBrightness}`,
    `orientation=${status.orientation}`,
  ];

  if (status.brightness !== undefined) {
    parts.push(`brightness=${formatPercent(status.brightness)}`);
  }

  if (status.timeout !== undefined) {
    parts.push(`timeout=${status.timeout}ms`);
  }

  return parts.join(" | ");
}

function formatKeyboard(status: RemixKeyboardStatus): string {
  return `${status.visible ? "visible" : "hidden"} height=${status.height}px`;
}

function formatKeyEvent(event: RemixKeyEvent): string {
  return `key ${event.key} ${event.action}`;
}

function formatLifecycleEvent(event: RemixLifecycleEvent): string {
  return `lifecycle ${event.state}`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
