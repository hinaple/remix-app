import { RemixCore } from "@remixapp/core";
import { LazyStatusChannel, type SubscriptionScope } from "@remixapp/runtime";
import type {
  RemixAppContext,
  RemixBatteryStatus,
  RemixKeyboardStatus,
  RemixNetworkStatus,
  RemixScreenStatus,
} from "@remixapp/sdk";

export function createStatusContext(
  subscriptions: SubscriptionScope,
): RemixAppContext["device"]["status"] {
  return {
    battery: new LazyStatusChannel<RemixBatteryStatus>(subscriptions, {
      get: () => RemixCore.getBatteryStatus(),
      start: () => RemixCore.startBatteryStatusUpdates(),
      stop: () => RemixCore.stopBatteryStatusUpdates(),
      listen: (listener) => RemixCore.addListener("batteryStatus", listener),
    }),
    network: new LazyStatusChannel<RemixNetworkStatus>(subscriptions, {
      get: () => RemixCore.getNetworkStatus(),
      start: () => RemixCore.startNetworkStatusUpdates(),
      stop: () => RemixCore.stopNetworkStatusUpdates(),
      listen: (listener) => RemixCore.addListener("networkStatus", listener),
    }),
    screen: new LazyStatusChannel<RemixScreenStatus>(subscriptions, {
      get: () => RemixCore.getScreenStatus(),
      start: () => RemixCore.startScreenStatusUpdates(),
      stop: () => RemixCore.stopScreenStatusUpdates(),
      listen: (listener) => RemixCore.addListener("screenStatus", listener),
    }),
  };
}

export function createKeyboardContext(
  subscriptions: SubscriptionScope,
): RemixAppContext["device"]["keyboard"] {
  return new LazyStatusChannel<RemixKeyboardStatus>(subscriptions, {
    get: () => RemixCore.getKeyboardStatus(),
    start: () => RemixCore.startKeyboardStatusUpdates(),
    stop: () => RemixCore.stopKeyboardStatusUpdates(),
    listen: (listener) => RemixCore.addListener("keyboardStatus", listener),
  });
}
