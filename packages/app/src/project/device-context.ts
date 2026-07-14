import { RemixCore } from "@remixapp/core";
import type { SubscriptionScope } from "@remixapp/runtime";
import type { RemixAppContext } from "@remixapp/sdk";

import { createKeyboardContext, createStatusContext } from "./status-context.js";

export function createDeviceContext(
  subscriptions: SubscriptionScope,
): RemixAppContext["device"] {
  return {
    screen: {
      wake: () => RemixCore.wakeScreen(),
      setKeepOn: (enabled) => RemixCore.setKeepScreenOn({ enabled }),
      setAutoBrightness: (enabled) => RemixCore.setAutoBrightness({ enabled }),
      setBrightness: (brightness) =>
        RemixCore.setScreenBrightness({ brightness }),
      setOrientation: (orientation) =>
        RemixCore.setScreenOrientation({ orientation }),
      setTimeout: (timeout) => RemixCore.setScreenTimeout({ timeout }),
    },
    status: createStatusContext(subscriptions),
    keyboard: createKeyboardContext(subscriptions),
    runtime: {
      foreground: (enabled) => RemixCore.setForegroundService({ enabled }),
      keepCpuAwake: (enabled) => RemixCore.setKeepCpuAwake({ enabled }),
    },
    input: {
      captureBack: (enabled) => RemixCore.captureBack({ enabled }),
      captureKeys: (keys) => RemixCore.captureKeys({ keys }),
    },
    audio: {
      getVolume: async () => {
        const result = await RemixCore.getMediaVolume();
        return result.volume;
      },
      setVolume: (volume) => RemixCore.setMediaVolume({ volume }),
    },
    vibration: {
      trigger: (duration) => RemixCore.vibrate({ duration }),
    },
  };
}
