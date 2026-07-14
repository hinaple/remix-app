import type { RemixEventMap, RemixKey, RemixKeyEvent } from "@remixapp/sdk";

import type { DeviceState } from "./types.js";

export interface DevInputBridgeOptions {
  deviceState: DeviceState;
  emitKey(event: RemixKeyEvent): void;
}

export interface DevLifecycleBridgeOptions {
  emitLifecycle(event: RemixEventMap["lifecycle"]): void;
}

export interface DevControlBridgeOptions {
  emitKey(event: RemixKeyEvent): void;
  emitLifecycle(event: RemixEventMap["lifecycle"]): void;
  resetProject(): void;
  setStatus(status: string): void;
}

export function installKeyboardBridge(options: DevInputBridgeOptions): void {
  const activeKeys = new Set<RemixKey>();

  window.addEventListener("keydown", (event) => {
    const key = keyboardKey(event);

    if (!key || !shouldCaptureKey(key, options.deviceState)) {
      return;
    }

    event.preventDefault();
    if (activeKeys.has(key)) {
      return;
    }

    activeKeys.add(key);
    options.emitKey({
      key,
      action: "down",
    });
  });

  window.addEventListener("keyup", (event) => {
    const key = keyboardKey(event);

    if (!key || !shouldCaptureKey(key, options.deviceState)) {
      return;
    }

    event.preventDefault();
    activeKeys.delete(key);
    options.emitKey({ key, action: "up" });
  });

  window.history.replaceState({ remixDev: true }, "", window.location.href);
  window.history.pushState(
    { remixDevBackTrap: true },
    "",
    window.location.href,
  );
  window.addEventListener("popstate", () => {
    if (options.deviceState.captureBack) {
      options.emitKey({ key: "BACK", action: "down" });
      options.emitKey({ key: "BACK", action: "up" });
      window.history.pushState(
        { remixDevBackTrap: true },
        "",
        window.location.href,
      );
    }
  });
}

export function installLifecycleBridge(
  options: DevLifecycleBridgeOptions,
): void {
  document.addEventListener("visibilitychange", () => {
    options.emitLifecycle({
      state: document.visibilityState === "visible" ? "resumed" : "paused",
    });
  });

  window.addEventListener("focus", () => {
    options.emitLifecycle({ state: "resumed" });
  });

  window.addEventListener("blur", () => {
    options.emitLifecycle({ state: "paused" });
  });

  window.addEventListener("beforeunload", () => {
    options.emitLifecycle({ state: "destroyed" });
  });
}

export function installDevControls(options: DevControlBridgeOptions): void {
  document
    .querySelectorAll<HTMLButtonElement>("[data-remix-key]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.remixKey as RemixKey;
        options.emitKey({ key, action: "down" });
        options.emitKey({ key, action: "up" });
      });
    });

  document
    .querySelectorAll<HTMLButtonElement>("[data-remix-lifecycle]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const state = button.dataset
          .remixLifecycle as RemixEventMap["lifecycle"]["state"];
        options.emitLifecycle({ state });
        options.setStatus(`lifecycle ${state}`);
      });
    });

  document
    .querySelector<HTMLButtonElement>("[data-remix-reset]")
    ?.addEventListener("click", () => {
      options.resetProject();
    });
}

function keyboardKey(event: KeyboardEvent): RemixKey | undefined {
  if (
    event.key === "Escape" ||
    event.key === "Backspace" ||
    event.key === "BrowserBack"
  ) {
    return "BACK";
  }

  if (event.key === "AudioVolumeUp" || event.key === "=" || event.key === "+") {
    return "VOLUME_UP";
  }

  if (
    event.key === "AudioVolumeDown" ||
    event.key === "-" ||
    event.key === "_"
  ) {
    return "VOLUME_DOWN";
  }

  if (event.key === "Home") {
    return "HOME";
  }

  if (event.key === "ContextMenu") {
    return "MENU";
  }

  if (event.key === "Power") {
    return "POWER";
  }

  return undefined;
}

function shouldCaptureKey(key: RemixKey, deviceState: DeviceState): boolean {
  if (key === "BACK") {
    return deviceState.captureBack || deviceState.capturedKeys.has(key);
  }

  return deviceState.capturedKeys.has(key);
}
