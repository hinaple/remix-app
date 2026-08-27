import type { RemixScreenOrientation } from "@remixapp/sdk";

import type { RemixDevOrientationLock } from "./types.js";

export function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(1, Math.max(0, value));
}

export function setBrowserBrightness(brightness: number): void {
  // document.documentElement.style.setProperty(
  //   "--remix-dev-brightness",
  //   String(clampUnit(brightness)),
  // );
}

export async function setBrowserOrientation(
  orientation: RemixScreenOrientation,
): Promise<void> {
  const screenOrientation = screen.orientation as ScreenOrientation & {
    lock?: (orientation: RemixDevOrientationLock) => Promise<void>;
    unlock?: () => void;
  };

  if (!screenOrientation.lock) {
    return;
  }

  try {
    if (
      orientation === "unspecified" ||
      orientation === "sensor" ||
      orientation === "fullSensor"
    ) {
      screenOrientation.unlock?.();
      return;
    }

    await screenOrientation.lock(toBrowserOrientation(orientation));
  } catch {
    // Browser orientation lock requires platform support and often fullscreen.
  }
}

function toBrowserOrientation(
  orientation: RemixScreenOrientation,
): RemixDevOrientationLock {
  if (orientation === "landscape") {
    return "landscape-primary";
  }

  if (orientation === "reverseLandscape") {
    return "landscape-secondary";
  }

  if (orientation === "reversePortrait") {
    return "portrait-secondary";
  }

  return "portrait-primary";
}
