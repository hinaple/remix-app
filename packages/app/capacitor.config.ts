import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.fainthit.remix",
  appName: "Remix",
  webDir: "dist",
  android: {
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SystemBars: {
      hidden: true,
      insetsHandling: "disable",
    },
  },
};

export default config;
