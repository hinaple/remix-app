import type { RemixKeyEvent } from "@remixapp/sdk";
import type { HostUi } from "./host-ui";

export interface AdminKeyHandlerOptions {
  isAdminVisible(): boolean;
  showAdminPage(): void;
  showProjectPage(): void;
}

export function createAdminKeyHandler(
  ui: HostUi,
): (event: RemixKeyEvent) => void {
  const state = {
    pressed: new Set<RemixKeyEvent["key"]>(),
    timer: 0,
    firedUntilRelease: false,
  };

  const startTimer = () => {
    if (
      state.firedUntilRelease ||
      state.timer !== 0 ||
      !state.pressed.has("VOLUME_UP") ||
      !state.pressed.has("VOLUME_DOWN")
    ) {
      return;
    }

    state.timer = window.setTimeout(() => {
      state.timer = 0;
      state.firedUntilRelease = true;
      ui.toggleAdminPage();
    }, 3000);
  };

  const stopTimer = () => {
    if (state.timer === 0) {
      return;
    }

    window.clearTimeout(state.timer);
    state.timer = 0;
  };

  return (event) => {
    if (event.key === "BACK") {
      if (ui.isAdminVisible() && event.action === "up") {
        ui.showProjectPage();
      }

      return;
    }

    if (event.key !== "VOLUME_UP" && event.key !== "VOLUME_DOWN") {
      return;
    }

    if (event.action === "down") {
      state.pressed.add(event.key);
      startTimer();
      return;
    }

    state.pressed.delete(event.key);
    stopTimer();

    if (state.pressed.size === 0) {
      state.firedUntilRelease = false;
    }
  };
}
