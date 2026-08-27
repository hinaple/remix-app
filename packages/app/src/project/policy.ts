import { RemixCore } from "@remixapp/core";
import type {
  RemixKeyboardAdjust,
  RemixKeyboardState,
  RemixKeyEvent,
  RemixProjectManifest,
} from "@remixapp/sdk";

import type { ProjectActionClient } from "./action-client.js";

export interface HostKeyboardPolicy {
  adjust: RemixKeyboardAdjust;
  nativeAdjust: boolean;
  state: RemixKeyboardState;
}

export async function applyProjectPolicy(
  manifest: RemixProjectManifest,
  actions: ProjectActionClient,
): Promise<void> {
  const kiosk = manifest.kiosk ?? true;
  const keyboard = resolveHostKeyboardPolicy(manifest);

  await actions.invoke("device.screen.setAutoBrightness", {
    enabled: manifest.screen?.autoBrightness ?? false,
  });
  await actions.invoke("device.screen.setKeepOn", {
    enabled: manifest.screen?.keepOn ?? false,
  });
  await RemixCore.setSystemUiMode({
    immersive: manifest.screen?.immersive ?? kiosk,
    hideSystemBars: manifest.screen?.hideSystemBars ?? kiosk,
  });
  await actions.invoke("device.screen.setOrientation", {
    orientation: manifest.screen?.orientation ?? "portrait",
  });
  await RemixCore.setSoftInputMode({
    adjust: keyboard.nativeAdjust ? keyboard.adjust : "nothing",
    state: keyboard.state,
  });
  if (manifest.screen?.timeout !== undefined) {
    await actions.invoke("device.screen.setTimeout", {
      timeout: manifest.screen.timeout,
    });
  }
  await actions.invoke("device.input.captureBack", {
    enabled: manifest.input?.captureBack ?? true,
  });
  await actions.invoke("device.input.captureKeys", {
    keys: withHostAdminKeys(manifest.input?.capturedKeys ?? []),
  });
  await RemixCore.setKioskMode({ enabled: kiosk });
}

export async function clearProjectPolicy(
  actions: ProjectActionClient,
): Promise<void> {
  await actions.invoke("device.vibration.stop");
  await RemixCore.setKioskMode({ enabled: false });
  await actions.invoke("device.input.captureBack", { enabled: false });
  await actions.invoke("device.input.captureKeys", { keys: [] });
  await actions.invoke("device.screen.setOrientation", {
    orientation: "unspecified",
  });
  await RemixCore.setSoftInputMode({
    adjust: "nothing",
    state: "unspecified",
  });
  await actions.invoke("device.screen.setTimeout", { timeout: null });
  await RemixCore.setSystemUiMode({ immersive: false, hideSystemBars: false });
  await actions.invoke("device.screen.setKeepOn", { enabled: false });
  await actions.invoke("device.screen.setAutoBrightness", { enabled: false });
}

function withHostAdminKeys(
  keys: RemixKeyEvent["key"][],
): RemixKeyEvent["key"][] {
  return Array.from(new Set([...keys, "VOLUME_UP", "VOLUME_DOWN"]));
}

export function resolveHostKeyboardPolicy(
  manifest: RemixProjectManifest,
): HostKeyboardPolicy {
  return {
    adjust: manifest.screen?.keyboard?.adjust ?? "resize",
    nativeAdjust: manifest.screen?.keyboard?.nativeAdjust ?? false,
    state: manifest.screen?.keyboard?.state ?? "unspecified",
  };
}
