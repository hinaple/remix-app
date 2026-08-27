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

export interface RemixProjectConstantState {
  id: string;
  required: boolean;
  hasDefault: boolean;
  default?: string;
  hasOverride: boolean;
  value?: string;
}

export interface RemixProjectConfigurationBase {
  project: string;
  projectId: string;
  revision: number;
  constants: RemixProjectConstantState[];
}

export interface RemixProjectConfigurationReady
  extends RemixProjectConfigurationBase {
  status: "ready";
  manifest: Record<string, unknown>;
  missing: [];
}

export interface RemixProjectConfigurationRequired
  extends RemixProjectConfigurationBase {
  status: "needsConfiguration";
  missing: string[];
}

export type RemixProjectConfiguration =
  | RemixProjectConfigurationReady
  | RemixProjectConfigurationRequired;

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

export type RemixCoreMqttConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export interface RemixCoreMqttStatus {
  connection: string;
  state: RemixCoreMqttConnectionState;
  revision: number;
  reason?: string;
}

export interface RemixCoreMqttStatuses {
  statuses: RemixCoreMqttStatus[];
}

export interface RemixCoreMqttMessageEvent {
  connection: string;
  topic: string;
  payloadBase64: string;
  qos: 0 | 1 | 2;
  retained: boolean;
  duplicate: boolean;
  receivedAt: number;
}

export interface RemixCoreNativeActionRequest {
  requestId: string;
  type: string;
  args: Record<string, unknown>;
}

export interface RemixCorePlugin {
  setSystemUiMode(options: {
    immersive: boolean;
    hideSystemBars: boolean;
  }): Promise<void>;
  setSoftInputMode(options: {
    adjust: RemixKeyboardAdjust;
    state: RemixKeyboardState;
  }): Promise<void>;
  setKioskMode(options: { enabled: boolean }): Promise<RemixKioskResult>;
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
  executeAction(options: {
    type: string;
    args?: Record<string, unknown>;
  }): Promise<void>;
  setProjectRuntimeState(options: { mounted: boolean }): Promise<void>;
  completeWebAction(options: {
    requestId: string;
    status: "completed" | "failed";
    error?: string;
  }): Promise<void>;
  getMqttStatus(options: {
    connection: string;
  }): Promise<RemixCoreMqttStatus>;
  getMqttStatuses(): Promise<RemixCoreMqttStatuses>;
  installProjectPackage(options: {
    path: string;
  }): Promise<RemixInstallProjectPackageResult>;
  getActiveProject(): Promise<RemixInstalledProject>;
  getActiveProjectConfiguration(): Promise<RemixProjectConfiguration>;
  setActiveProjectConstants(options: {
    projectId: string;
    revision: number;
    overrides: Record<string, string>;
  }): Promise<RemixProjectConfigurationReady>;
  consumeLaunchProjectInstall(): Promise<RemixLaunchProjectInstall>;
  pickProjectPackage(): Promise<RemixPickedProjectPackage>;
  exitApp(): Promise<void>;
  addListener(
    eventName: "device:key",
    listener: (event: RemixCoreKeyEvent) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "project:lifecycle",
    listener: (event: RemixCoreLifecycleEvent) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "device:status:battery",
    listener: (event: RemixBatteryStatus) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "device:status:network",
    listener: (event: RemixNetworkStatus) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "device:status:screen",
    listener: (event: RemixScreenStatus) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "device:status:keyboard",
    listener: (event: RemixKeyboardStatus) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "projectInstallRequested",
    listener: (event: RemixProjectInstallRequested) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "mqtt:status",
    listener: (event: RemixCoreMqttStatus) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "mqtt:message",
    listener: (event: RemixCoreMqttMessageEvent) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "nativeActionRequested",
    listener: (event: RemixCoreNativeActionRequest) => void,
  ): Promise<PluginListenerHandle>;
}
