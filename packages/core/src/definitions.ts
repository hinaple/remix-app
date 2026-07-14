import type { PluginListenerHandle } from "@capacitor/core";

export interface RemixCoreKeyEvent {
  key: "BACK" | "VOLUME_UP" | "VOLUME_DOWN" | "POWER" | "HOME" | "MENU";
  action: "down" | "up";
}

export interface RemixCoreLifecycleEvent {
  state: "paused" | "resumed";
}

export interface RemixDevicePolicyState {
  deviceOwner: boolean;
  adminActive: boolean;
  lockTaskPermitted: boolean;
  lockTaskActive: boolean;
}

export interface RemixBatteryStatus {
  level: number;
  charging: boolean;
}

export interface RemixNetworkStatus {
  connected: boolean;
  type: "wifi" | "cellular" | "ethernet" | "none" | "unknown";
}

export interface RemixScreenStatus {
  interactive: boolean;
  keepOn: boolean;
  autoBrightness: boolean;
  brightness?: number;
  timeout?: number;
  orientation: RemixScreenOrientation;
}

export interface RemixKeyboardStatus {
  visible: boolean;
  height: number;
}

export interface RemixMediaVolume {
  volume: number;
}

export interface RemixKioskResult {
  active: boolean;
  permitted: boolean;
}

export interface RemixInstalledProject {
  installed: boolean;
  directory?: string;
  url?: string;
}

export interface RemixInstallProjectPackageResult {
  directory: string;
  url: string;
}

export type RemixScreenOrientation =
  | "portrait"
  | "landscape"
  | "reversePortrait"
  | "reverseLandscape"
  | "sensor"
  | "fullSensor"
  | "locked"
  | "unspecified";

export type RemixKeyboardAdjust = "resize" | "pan" | "nothing";

export type RemixKeyboardState =
  | "unspecified"
  | "hidden"
  | "alwaysHidden"
  | "visible"
  | "alwaysVisible";

export interface RemixLaunchProjectInstall {
  path?: string;
}

export interface RemixProjectInstallRequested {
  path: string;
}

export interface RemixPickedProjectPackage {
  canceled: boolean;
  path?: string;
}

export interface RemixCorePlugin {
  wakeScreen(): Promise<void>;
  setKeepScreenOn(options: { enabled: boolean }): Promise<void>;
  setAutoBrightness(options: { enabled: boolean }): Promise<void>;
  setScreenBrightness(options: { brightness: number }): Promise<void>;
  setScreenTimeout(options: { timeout?: number | null }): Promise<void>;
  setSystemUiMode(options: {
    immersive: boolean;
    hideSystemBars: boolean;
  }): Promise<void>;
  setScreenOrientation(options: {
    orientation: RemixScreenOrientation;
  }): Promise<void>;
  setSoftInputMode(options: {
    adjust: RemixKeyboardAdjust;
    state: RemixKeyboardState;
  }): Promise<void>;
  setForegroundService(options: { enabled: boolean }): Promise<void>;
  setKeepCpuAwake(options: { enabled: boolean }): Promise<void>;
  setKioskMode(options: { enabled: boolean }): Promise<RemixKioskResult>;
  captureBack(options: { enabled: boolean }): Promise<void>;
  captureKeys(options: { keys: RemixCoreKeyEvent["key"][] }): Promise<void>;
  getDevicePolicyState(): Promise<RemixDevicePolicyState>;
  getBatteryStatus(): Promise<RemixBatteryStatus>;
  getNetworkStatus(): Promise<RemixNetworkStatus>;
  getScreenStatus(): Promise<RemixScreenStatus>;
  getKeyboardStatus(): Promise<RemixKeyboardStatus>;
  startBatteryStatusUpdates(): Promise<void>;
  stopBatteryStatusUpdates(): Promise<void>;
  startNetworkStatusUpdates(): Promise<void>;
  stopNetworkStatusUpdates(): Promise<void>;
  startScreenStatusUpdates(): Promise<void>;
  stopScreenStatusUpdates(): Promise<void>;
  startKeyboardStatusUpdates(): Promise<void>;
  stopKeyboardStatusUpdates(): Promise<void>;
  getMediaVolume(): Promise<RemixMediaVolume>;
  setMediaVolume(options: { volume: number }): Promise<void>;
  vibrate(options?: { duration?: number }): Promise<void>;
  installProjectPackage(options: {
    path: string;
  }): Promise<RemixInstallProjectPackageResult>;
  getActiveProject(): Promise<RemixInstalledProject>;
  consumeLaunchProjectInstall(): Promise<RemixLaunchProjectInstall>;
  pickProjectPackage(): Promise<RemixPickedProjectPackage>;
  exitApp(): Promise<void>;
  addListener(
    eventName: "key",
    listener: (event: RemixCoreKeyEvent) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "lifecycle",
    listener: (event: RemixCoreLifecycleEvent) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "batteryStatus",
    listener: (event: RemixBatteryStatus) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "networkStatus",
    listener: (event: RemixNetworkStatus) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "screenStatus",
    listener: (event: RemixScreenStatus) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "keyboardStatus",
    listener: (event: RemixKeyboardStatus) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "projectInstallRequested",
    listener: (event: RemixProjectInstallRequested) => void,
  ): Promise<PluginListenerHandle>;
}
