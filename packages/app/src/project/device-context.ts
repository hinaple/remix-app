import { RemixCore } from "@remixapp/core";
import type { RemixAppContext } from "@remixapp/sdk";
import type { ProjectActionClient } from "./action-client.js";

export function createDeviceContext(
  actions: ProjectActionClient,
  status: RemixAppContext["device"]["status"],
  keyboard: RemixAppContext["device"]["keyboard"],
): RemixAppContext["device"] {
  return {
    screen: {
      wake: () => actions.invoke("device.screen.wake"),
      setKeepOn: (enabled) =>
        actions.invoke("device.screen.setKeepOn", { enabled }),
      setAutoBrightness: (enabled) =>
        actions.invoke("device.screen.setAutoBrightness", { enabled }),
      setBrightness: (brightness) =>
        actions.invoke("device.screen.setBrightness", { brightness }),
      setOrientation: (orientation) =>
        actions.invoke("device.screen.setOrientation", { orientation }),
      setTimeout: (timeout) =>
        actions.invoke("device.screen.setTimeout", { timeout: timeout ?? null }),
    },
    status,
    keyboard,
    input: {
      captureBack: (enabled) =>
        actions.invoke("device.input.captureBack", { enabled }),
      captureKeys: (keys) =>
        actions.invoke("device.input.captureKeys", { keys }),
    },
    audio: {
      getVolume: async () => {
        const result = await RemixCore.getMediaVolume();
        return result.volume;
      },
      setVolume: (volume) =>
        actions.invoke("device.audio.setVolume", { volume }),
    },
    vibration: {
      trigger: (duration) =>
        actions.invoke("device.vibration.trigger", { duration }),
    },
  };
}
