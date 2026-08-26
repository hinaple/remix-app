import { defineConfig } from "@remixapp/sdk/config";

export default defineConfig({
  projectId: "remixapp-constants-example",
  name: "constants-example",
  version: "0.1.0",
  entry: "src/index.ts",
  styles: ["src/style.css"],
  constants: {
    deviceId: { required: true },
    displayName: { default: "Lobby Device" },
    accentColor: { default: "#7c5cff", required: true },
    brokerHost: { default: "127.0.0.1" },
    brokerPort: { default: "1883" },
    optionalNote: {},
  },
  screen: {
    keepOn: true,
    keyboard: {
      adjust: "resize",
      state: "hidden",
    },
  },
  input: {
    capturedKeys: ["VOLUME_UP", "VOLUME_DOWN"],
    captureBack: true,
  },
  mqtt: {
    connections: {
      demo: {
        url: "mqtt://{{Constants.brokerHost}}:{{Constants.brokerPort}}",
        clientId: "constants-example-{{Constants.deviceId}}",
        reconnect: true,
        subscriptions: [
          {
            filter: "devices/{{Constants.deviceId}}/messages",
          },
        ],
      },
    },
  },
  nativeEvents: {
    rules: [
      {
        on: "mqtt:message",
        actions: [
          {
            type: "device.screen.wake",
          },
          { type: "device.vibration.trigger", args: { duration: 1000 } },
        ],
      },
    ],
  },
});
