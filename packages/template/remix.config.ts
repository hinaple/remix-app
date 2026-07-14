import { defineConfig } from "@remixapp/sdk/config";

export default defineConfig({
  name: "template",
  version: "0.1.0",
  entry: "src/index.ts",
  styles: ["src/style.css"],
  kiosk: true,
  runtime: {
    foreground: true,
    keepCpuAwake: true,
  },
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
