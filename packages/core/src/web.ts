import { WebPlugin } from "@capacitor/core";

import type {
  RemixBatteryStatus,
  RemixCorePlugin,
  RemixDevicePolicyState,
  RemixInstalledProject,
  RemixInstallProjectPackageResult,
  RemixKeyboardStatus,
  RemixLaunchProjectInstall,
  RemixMediaVolume,
  RemixNetworkStatus,
  RemixPickedProjectPackage,
  RemixKioskResult,
  RemixScreenStatus,
} from "./definitions.js";

export class RemixCoreWeb extends WebPlugin implements RemixCorePlugin {
  async wakeScreen(): Promise<void> {}

  async setKeepScreenOn(): Promise<void> {}

  async setAutoBrightness(): Promise<void> {}

  async setScreenBrightness(): Promise<void> {}

  async setScreenTimeout(): Promise<void> {}

  async setSystemUiMode(): Promise<void> {}

  async setScreenOrientation(): Promise<void> {}

  async setSoftInputMode(): Promise<void> {}

  async setForegroundService(): Promise<void> {}

  async setKeepCpuAwake(): Promise<void> {}

  async setKioskMode(options: { enabled: boolean }): Promise<RemixKioskResult> {
    void options;
    return { active: false, permitted: false };
  }

  async captureBack(): Promise<void> {}

  async captureKeys(): Promise<void> {}

  async getDevicePolicyState(): Promise<RemixDevicePolicyState> {
    return {
      deviceOwner: false,
      adminActive: false,
      lockTaskPermitted: false,
      lockTaskActive: false,
    };
  }

  async getBatteryStatus(): Promise<RemixBatteryStatus> {
    return { level: 1, charging: false };
  }

  async getNetworkStatus(): Promise<RemixNetworkStatus> {
    return {
      connected: navigator.onLine,
      type: navigator.onLine ? "unknown" : "none",
    };
  }

  async getScreenStatus(): Promise<RemixScreenStatus> {
    return {
      interactive: document.visibilityState === "visible",
      keepOn: false,
      autoBrightness: false,
      brightness: 1,
      orientation: "unspecified",
    };
  }

  async getKeyboardStatus(): Promise<RemixKeyboardStatus> {
    return { visible: false, height: 0 };
  }

  async startBatteryStatusUpdates(): Promise<void> {}

  async stopBatteryStatusUpdates(): Promise<void> {}

  async startNetworkStatusUpdates(): Promise<void> {}

  async stopNetworkStatusUpdates(): Promise<void> {}

  async startScreenStatusUpdates(): Promise<void> {}

  async stopScreenStatusUpdates(): Promise<void> {}

  async startKeyboardStatusUpdates(): Promise<void> {}

  async stopKeyboardStatusUpdates(): Promise<void> {}

  async getMediaVolume(): Promise<RemixMediaVolume> {
    return { volume: 1 };
  }

  async setMediaVolume(): Promise<void> {}

  async vibrate(options: { duration?: number } = {}): Promise<void> {
    navigator.vibrate?.(options.duration ?? 250);
  }

  async installProjectPackage(): Promise<RemixInstallProjectPackageResult> {
    throw new Error(
      "Project package installation is only available on Android.",
    );
  }

  async getActiveProject(): Promise<RemixInstalledProject> {
    return { installed: false };
  }

  async consumeLaunchProjectInstall(): Promise<RemixLaunchProjectInstall> {
    return {};
  }

  async pickProjectPackage(): Promise<RemixPickedProjectPackage> {
    throw new Error("Project package picker is only available on Android.");
  }

  async exitApp(): Promise<void> {
    window.close();
  }
}
