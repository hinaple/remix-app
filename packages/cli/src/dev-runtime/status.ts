import type {
  RemixBatteryStatus,
  RemixDeviceStatusContext,
  RemixKeyboardStatus,
  RemixNetworkStatus,
  RemixScreenStatus,
} from "@remixapp/sdk";
import {
  createMemoryStatusChannel,
  type RuntimeWritableStatus,
  type SubscriptionScope,
} from "@remixapp/runtime";

import type { DeviceState } from "./types.js";

export type DevStatusContext = RemixDeviceStatusContext & {
  screen: RuntimeWritableStatus<RemixScreenStatus>;
};

export type DevKeyboardContext = RuntimeWritableStatus<RemixKeyboardStatus>;

export function createStatusContext(
  subscriptions: SubscriptionScope,
  deviceState: DeviceState,
): DevStatusContext {
  return {
    battery: createMemoryStatusChannel<RemixBatteryStatus>(
      subscriptions,
      () => ({
        level: 1,
        charging: true,
      }),
    ),
    network: createMemoryStatusChannel<RemixNetworkStatus>(
      subscriptions,
      () => ({
        connected: navigator.onLine,
        type: navigator.onLine ? "unknown" : "none",
      }),
    ),
    screen: createMemoryStatusChannel<RemixScreenStatus>(subscriptions, () => ({
      interactive: document.visibilityState === "visible",
      keepOn: deviceState.keepScreenOn,
      autoBrightness: deviceState.autoBrightness,
      brightness: deviceState.brightness,
      timeout: deviceState.screenTimeout,
      orientation: deviceState.orientation,
    })),
  };
}

export function createKeyboardContext(
  subscriptions: SubscriptionScope,
): DevKeyboardContext {
  return createMemoryStatusChannel<RemixKeyboardStatus>(subscriptions, () => {
    const viewport = window.visualViewport;
    const height = viewport
      ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      : 0;

    return {
      visible: height > 0,
      height: Math.round(height),
    };
  });
}
