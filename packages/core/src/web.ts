import { WebPlugin } from "@capacitor/core";

import type {
  RemixBatteryStatus,
  RemixActiveProjectManifestResult,
  RemixCorePlugin,
  RemixDevicePolicyState,
  RemixInstalledProject,
  RemixInstallProjectPackageResult,
  RemixKeyboardStatus,
  RemixLaunchProjectInstall,
  RemixMediaVolume,
  RemixCoreMqttStatus,
  RemixCoreMqttStatuses,
  RemixNetworkStatus,
  RemixPickedProjectPackage,
  RemixKioskResult,
  RemixScreenStatus,
} from "./definitions.js";

export class RemixCoreWeb extends WebPlugin implements RemixCorePlugin {
  async setSystemUiMode(): Promise<void> {}

  async setSoftInputMode(): Promise<void> {}

  async setKioskMode(options: { enabled: boolean }): Promise<RemixKioskResult> {
    void options;
    return { active: false, permitted: false };
  }

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

  async executeAction(): Promise<void> {
    throw new Error("Native actions are only available on Android.");
  }

  async setProjectRuntimeState(): Promise<void> {}

  async completeWebAction(): Promise<void> {}

  async getMqttStatus(options: {
    connection: string;
  }): Promise<RemixCoreMqttStatus> {
    return {
      connection: options.connection,
      state: "disconnected",
      revision: 0,
    };
  }

  async getMqttStatuses(): Promise<RemixCoreMqttStatuses> {
    return { statuses: [] };
  }

  async installProjectPackage(): Promise<RemixInstallProjectPackageResult> {
    throw new Error(
      "Project package installation is only available on Android.",
    );
  }

  async getActiveProject(): Promise<RemixInstalledProject> {
    return { installed: false };
  }

  async getActiveProjectManifest(): Promise<RemixActiveProjectManifestResult> {
    throw new Error("Active project manifests are only available on Android.");
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
