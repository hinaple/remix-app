import type { RemixAppMount } from "@remixapp/sdk";

export const mount: RemixAppMount = async (container, context) => {
  const root = document.createElement("div");
  root.style.minHeight = "100vh";
  root.style.color = "#000000";
  root.style.background = "#ffffff";

  root.append(
    line("Constants Example"),
    document.createElement("hr"),
    line("Current constants"),
  );

  const definitions = context.project.manifest.constants ?? {};
  for (const id of Object.keys(definitions)) {
    root.append(line(id, context.constants[id] ?? "Not set"));
  }
  root.append(document.createElement("hr"));

  const connection = context.project.manifest.mqtt?.connections.demo;
  const nativeText = readNativeTemplateText(
    context.project.manifest.nativeEvents,
  );
  root.append(
    line("Resolved config"),
    line("MQTT URL", connection?.url ?? "Not available"),
    line("Client ID", connection?.clientId ?? "Not available"),
    line("Topic", connection?.subscriptions[0]?.filter ?? "Not available"),
    line("Native text", nativeText),
    document.createElement("hr"),
  );

  const msgList = document.createElement("div");
  root.append(line("MQTT msg logs:"), msgList);

  function addMsg(msg: string) {
    const span = document.createElement("span");
    span.textContent = msg;
    msgList.append(span);
  }

  container.append(root);
  window.scrollTo(0, 0);

  context.host.panel.status.set([
    {
      id: "constants-device",
      label: "Device",
      text: context.constants.deviceId,
    },
    {
      id: "constants-native-template",
      label: "Native text",
      text: nativeText,
    },
  ]);

  console.log("MQTT STATUS: ", await context.mqtt.getStatus("demo"));

  context.events.on("mqtt:status", (status) => {
    console.log("MQTT STATUS EVENT: ", status);
  });

  context.events.on("mqtt:message", (msg) => {
    console.log(msg);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(msg.payload);
    addMsg(text);
  });

  return () => {
    context.host.panel.status.clear();
    root.remove();
  };
};

function line(label: string, value?: string): HTMLDivElement {
  const node = document.createElement("div");
  const labelNode = document.createElement("span");
  labelNode.textContent = label;
  node.append(labelNode);

  if (value !== undefined) {
    const valueNode = document.createElement("span");
    valueNode.textContent = `: ${value}`;
    node.append(valueNode);
  }

  return node;
}

function readNativeTemplateText(nativeEvents: unknown): string {
  console.log(nativeEvents);
  if (!isRecord(nativeEvents)) return "Not available";
  const rules = nativeEvents.rules;
  if (!Array.isArray(rules) || !isRecord(rules[0])) return "Not available";
  const actions = rules[0].actions;
  if (!Array.isArray(actions) || !isRecord(actions[0])) return "Not available";
  const args = actions[0].args;
  if (!isRecord(args) || typeof args.text !== "string") {
    return "Not available";
  }
  return args.text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
