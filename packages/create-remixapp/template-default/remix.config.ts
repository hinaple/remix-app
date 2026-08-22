import { defineConfig } from "@remixapp/sdk/config";

export default defineConfig({
  name: __REMIXAPP_NAME__,
  version: __REMIXAPP_VERSION__,
  entry: "src/index.ts",
  styles: ["src/style.css"],
  kiosk: true,
  screen: {
    keepOn: true,
    immersive: true,
    hideSystemBars: true,
    orientation: "portrait",
    timeout: 30000,
  },
  input: {
    capturedKeys: ["VOLUME_UP", "VOLUME_DOWN"],
    captureBack: true,
  },
});
