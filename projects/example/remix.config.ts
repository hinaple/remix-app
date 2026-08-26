import { defineConfig } from "@remixapp/sdk/config";

export default defineConfig({
  projectId: "remixapp-default-example",
  name: "example",
  version: "0.1.0",
  entry: "src/index.ts",
  styles: ["src/style.css"],
  kiosk: true,
  screen: {
    // keepOn: true,
    // immersive: true,
    // hideSystemBars: true,
    // orientation: "portrait",
    // timeout: 10000,
    keyboard: {
      adjust: "resize",
      nativeAdjust: false,
      state: "hidden",
    },
  },
  input: {
    // capturedKeys: ["VOLUME_UP", "VOLUME_DOWN"],
    captureBack: true,
  },
  nativeEvents: {
    rules: [
      {
        on: "device:status:battery",
        when: {
          level: { lte: 0.15 },
          charging: false,
        },
        actions: [
          { type: "device.screen.wake" },
          {
            type: "device.vibration.trigger",
            args: { duration: 500 },
          },
          {
            type: "host.panel.status.setText",
            args: { id: "example-mounted", text: "Low battery" },
          },
        ],
      },
    ],
  },
});
