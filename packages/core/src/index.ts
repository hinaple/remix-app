import { registerPlugin } from "@capacitor/core";

import type { RemixCorePlugin } from "./definitions.js";

export const RemixCore = registerPlugin<RemixCorePlugin>("RemixCore", {
  web: () => import("./web.js").then((module) => new module.RemixCoreWeb()),
});

export type {
  RemixCoreKeyEvent,
  RemixCoreMqttConnectionState,
  RemixCoreMqttMessageEvent,
  RemixCoreNativeActionRequest,
  RemixCoreMqttStatus,
  RemixCoreMqttStatuses,
  RemixCorePlugin,
  RemixDevicePolicyState,
  RemixInstalledProject,
  RemixInstallProjectPackageResult,
  RemixKeyboardAdjust,
  RemixKeyboardState,
  RemixKeyboardStatus,
  RemixKioskResult,
  RemixLaunchProjectInstall,
  RemixPickedProjectPackage,
  RemixProjectInstallRequested,
  RemixProjectConstantState,
  RemixProjectConfiguration,
  RemixProjectConfigurationReady,
  RemixProjectConfigurationRequired,
  RemixScreenOrientation,
} from "./definitions.js";
