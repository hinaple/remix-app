import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.fainthit.remix",
  appName: "Remix",
  webDir: "dist",
  plugins: {
    SystemBars: {
      hidden: true,
      insetsHandling: "disable",
    },
  },
};

export default config;
