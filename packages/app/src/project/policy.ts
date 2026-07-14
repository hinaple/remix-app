import { RemixCore } from "@remixapp/core";
import type {
  RemixKeyboardAdjust,
  RemixKeyboardState,
  RemixKeyEvent,
  RemixProjectManifest,
} from "@remixapp/sdk";

export interface HostKeyboardPolicy {
  adjust: RemixKeyboardAdjust;
  nativeAdjust: boolean;
  state: RemixKeyboardState;
}

export async function applyProjectPolicy(
  manifest: RemixProjectManifest,
): Promise<void> {
  const kiosk = manifest.kiosk ?? true;
  const keyboard = resolveHostKeyboardPolicy(manifest);

  await RemixCore.setAutoBrightness({
    enabled: manifest.screen?.autoBrightness ?? false,
  });
  await RemixCore.setKeepScreenOn({
    enabled: manifest.screen?.keepOn ?? false,
  });
  await RemixCore.setSystemUiMode({
    immersive: manifest.screen?.immersive ?? kiosk,
    hideSystemBars: manifest.screen?.hideSystemBars ?? kiosk,
  });
  await RemixCore.setScreenOrientation({
    orientation: manifest.screen?.orientation ?? "portrait",
  });
  await RemixCore.setSoftInputMode({
    adjust: keyboard.nativeAdjust ? keyboard.adjust : "nothing",
    state: keyboard.state,
  });
  if (manifest.screen?.timeout !== undefined) {
    await RemixCore.setScreenTimeout({ timeout: manifest.screen.timeout });
  }
  await RemixCore.setForegroundService({
    enabled: manifest.runtime?.foreground ?? true,
  });
  await RemixCore.setKeepCpuAwake({
    enabled: manifest.runtime?.keepCpuAwake ?? false,
  });
  await RemixCore.captureBack({ enabled: manifest.input?.captureBack ?? true });
  await RemixCore.captureKeys({
    keys: withHostAdminKeys(manifest.input?.capturedKeys ?? []),
  });
  await RemixCore.setKioskMode({ enabled: kiosk });
}

export async function clearProjectPolicy(): Promise<void> {
  await RemixCore.setKioskMode({ enabled: false });
  await RemixCore.captureBack({ enabled: false });
  await RemixCore.captureKeys({ keys: [] });
  await RemixCore.setKeepCpuAwake({ enabled: false });
  await RemixCore.setForegroundService({ enabled: false });
  await RemixCore.setScreenOrientation({ orientation: "unspecified" });
  await RemixCore.setSoftInputMode({
    adjust: "nothing",
    state: "unspecified",
  });
  await RemixCore.setScreenTimeout({ timeout: null });
  await RemixCore.setSystemUiMode({ immersive: false, hideSystemBars: false });
  await RemixCore.setKeepScreenOn({ enabled: false });
  await RemixCore.setAutoBrightness({ enabled: false });
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
