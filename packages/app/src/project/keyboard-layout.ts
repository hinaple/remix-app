import { RemixCore } from "@remixapp/core";
import type { PluginListenerHandle } from "@capacitor/core";
import type {
  RemixKeyboardAdjust,
  RemixKeyboardStatus,
  RemixProjectManifest,
} from "@remixapp/sdk";

import { resolveHostKeyboardPolicy } from "./policy.js";

export interface HostKeyboardLayout {
  dispose(): Promise<void>;
}

export async function createHostKeyboardLayout(
  hostElement: HTMLElement,
  manifest: RemixProjectManifest,
): Promise<HostKeyboardLayout> {
  const policy = resolveHostKeyboardPolicy(manifest);

  if (policy.nativeAdjust || policy.adjust === "nothing") {
    return createNoopKeyboardLayout();
  }

  const layout = new CssKeyboardLayout(hostElement, policy.adjust);
  await layout.start();
  return layout;
}

function createNoopKeyboardLayout(): HostKeyboardLayout {
  return {
    async dispose() {},
  };
}

class CssKeyboardLayout implements HostKeyboardLayout {
  private listenerHandle: PluginListenerHandle | undefined;

  constructor(
    private readonly hostElement: HTMLElement,
    private readonly adjust: Exclude<RemixKeyboardAdjust, "nothing">,
  ) {}

  async start(): Promise<void> {
    this.listenerHandle = await RemixCore.addListener(
      "keyboardStatus",
      (status) => {
        this.apply(status);
      },
    );
    await RemixCore.startKeyboardStatusUpdates();
    this.apply(await RemixCore.getKeyboardStatus());
  }

  async dispose(): Promise<void> {
    this.reset();
    await this.listenerHandle?.remove();
    this.listenerHandle = undefined;
    await RemixCore.stopKeyboardStatusUpdates();
  }

  private apply(status: RemixKeyboardStatus): void {
    if (!status.visible || status.height <= 0) {
      this.reset();
      return;
    }

    if (this.adjust === "resize") {
      this.hostElement.style.height = `calc(100vh - ${status.height}px)`;
      this.hostElement.style.minHeight = `calc(100vh - ${status.height}px)`;
      this.hostElement.style.overflow = "";
      this.hostElement.style.transform = "";
      this.hostElement.classList.add("inspect");

      console.log("resize");
      getDeepActiveElement(document)?.scrollIntoView({
        behavior: "instant",
        block: "center",
      });
      return;
    }

    const offset = this.getPanOffset(status.height);
    this.hostElement.style.height = "";
    this.hostElement.style.minHeight = "";
    this.hostElement.style.overflow = "";
    this.hostElement.style.transform =
      offset > 0 ? `translateY(-${offset}px)` : "";
  }

  private reset(): void {
    this.hostElement.style.height = "";
    this.hostElement.style.minHeight = "";
    this.hostElement.style.overflow = "";
    this.hostElement.style.transform = "";

    this.hostElement.classList.remove("inspect");

    console.log("reset");
  }

  private getPanOffset(keyboardHeight: number): number {
    const active = getDeepActiveElement(document);

    if (!active || !(active instanceof HTMLElement)) {
      return 0;
    }

    const rect = active.getBoundingClientRect();
    const keyboardTop = window.innerHeight - keyboardHeight;
    const padding = 12;

    return Math.max(0, rect.bottom + padding - keyboardTop);
  }
}

function getDeepActiveElement(root: Document | ShadowRoot): Element | null {
  const active = root.activeElement;

  if (active?.shadowRoot) {
    return getDeepActiveElement(active.shadowRoot) ?? active;
  }

  return active;
}
