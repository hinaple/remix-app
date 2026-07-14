import type {
  RemixAppContext,
  RemixAppUnmount,
  RemixKeyEvent,
} from "@remixapp/sdk";
import {
  EventBus,
  SubscriptionScope,
  createHostPanelContext,
} from "@remixapp/runtime";

import {
  clampUnit,
  setBrowserBrightness,
  setBrowserOrientation,
} from "./browser.js";
import { clearDevHostPanel, createDevHost } from "./dom.js";
import {
  installDevControls,
  installKeyboardBridge,
  installLifecycleBridge,
} from "./input.js";
import { createKeyboardContext, createStatusContext } from "./status.js";
import type {
  DeviceState,
  RemixDevHostController,
  RemixDevHostOptions,
  RemixDevProjectModule,
} from "./types.js";

export function startRemixDevHost(
  options: RemixDevHostOptions,
): RemixDevHostController {
  const host = new RemixDevHost(options);
  host.start();
  return host;
}

class RemixDevHost implements RemixDevHostController {
  private readonly deviceState: DeviceState;
  private readonly root: HTMLElement;
  private readonly status: HTMLParagraphElement | null;
  private events: EventBus;
  private mounted = false;
  private projectModule: RemixDevProjectModule;
  private projectSubscriptions = new SubscriptionScope();
  private projectUnmount: RemixAppUnmount | undefined;
  private wakeLock: WakeLockSentinel | undefined;

  constructor(private readonly options: RemixDevHostOptions) {
    this.projectModule = options.projectModule;
    this.deviceState = {
      foreground: options.manifest.runtime?.foreground ?? true,
      keepScreenOn: options.manifest.screen?.keepOn ?? false,
      autoBrightness: options.manifest.screen?.autoBrightness ?? false,
      brightness: 1,
      screenTimeout: options.manifest.screen?.timeout,
      keepCpuAwake: options.manifest.runtime?.keepCpuAwake ?? false,
      orientation: options.manifest.screen?.orientation ?? "portrait",
      capturedKeys: new Set(options.manifest.input?.capturedKeys ?? []),
      captureBack: options.manifest.input?.captureBack ?? true,
    };
    this.events = new EventBus(this.projectSubscriptions);
    this.root = createDevHost();
    this.status = document.querySelector<HTMLParagraphElement>(
      "[data-remix-dev-status]",
    );
  }

  start(): void {
    void this.applyInitialPolicy();
    void this.startProject();
    installKeyboardBridge({
      deviceState: this.deviceState,
      emitKey: (event) => this.emitKey(event),
    });
    installLifecycleBridge({
      emitLifecycle: (event) => this.events.emit("lifecycle", event),
    });
    installDevControls({
      emitKey: (event) => this.emitKey(event),
      emitLifecycle: (event) => this.events.emit("lifecycle", event),
      resetProject: () => {
        void this.resetProject();
      },
      setStatus: (status) => this.setStatus(status),
    });
  }

  async updateProjectModule(
    projectModule: RemixDevProjectModule,
  ): Promise<void> {
    this.projectModule = projectModule;
    await this.resetProject();
  }

  async dispose(): Promise<void> {
    await this.stopProject();
  }

  private async startProject(): Promise<void> {
    if (typeof this.projectModule.mount !== "function") {
      throw new Error(
        "Project entry must export a mount(container, context) function",
      );
    }

    this.setStatus("mounting");
    this.projectSubscriptions = new SubscriptionScope();
    this.events = new EventBus(this.projectSubscriptions);

    try {
      const context = this.createContext(
        this.events,
        this.projectSubscriptions,
      );
      const unmount = await this.projectModule.mount(this.root, context);
      this.projectUnmount = typeof unmount === "function" ? unmount : undefined;
      this.mounted = true;
      this.events.emit("lifecycle", { state: "mounted" });
      this.setStatus("mounted");
    } catch (error) {
      await this.projectSubscriptions.clear();
      throw error;
    }
  }

  private async stopProject(): Promise<void> {
    if (!this.mounted) {
      return;
    }

    this.mounted = false;
    this.events.emit("lifecycle", { state: "destroyed" });

    try {
      await this.projectUnmount?.();
    } finally {
      try {
        await this.projectSubscriptions.clear();
      } finally {
        this.projectUnmount = undefined;
        clearDevHostPanel();
        this.root.replaceChildren();
        this.setStatus("stopped");
      }
    }
  }

  private async resetProject(): Promise<void> {
    await this.stopProject();
    await this.startProject();
  }

  private createContext(
    events: EventBus,
    subscriptions: SubscriptionScope,
  ): RemixAppContext {
    const statusContext = createStatusContext(subscriptions, this.deviceState);
    const keyboardContext = createKeyboardContext(subscriptions);
    const emitKeyboard = () => keyboardContext.emit();

    window.visualViewport?.addEventListener("resize", emitKeyboard);
    window.addEventListener("resize", emitKeyboard);
    subscriptions.add(() => {
      window.visualViewport?.removeEventListener("resize", emitKeyboard);
      window.removeEventListener("resize", emitKeyboard);
    });

    return {
      project: {
        name: this.options.manifest.name,
        version: this.options.manifest.version,
        manifest: this.options.manifest,
        reset: () => this.resetProject(),
      },
      resources: {
        url: (resourcePath) =>
          new URL(`resources/${resourcePath}`, window.location.href).href,
      },
      device: {
        screen: {
          wake: async () => {
            await this.requestWakeLock();
            statusContext.screen.emit();
            this.setStatus("screen wake requested");
          },
          setKeepOn: async (enabled) => {
            this.deviceState.keepScreenOn = enabled;
            if (enabled) {
              await this.requestWakeLock();
            } else {
              await this.releaseWakeLock();
            }
            statusContext.screen.emit();
            this.setStatus(
              `screen keep-on ${enabled ? "enabled" : "disabled"}`,
            );
          },
          setAutoBrightness: async (enabled) => {
            this.deviceState.autoBrightness = enabled;
            statusContext.screen.emit();
            this.setStatus(
              `auto brightness ${enabled ? "enabled" : "disabled"}`,
            );
          },
          setBrightness: async (brightness) => {
            this.deviceState.brightness = clampUnit(brightness);
            setBrowserBrightness(this.deviceState.brightness);
            statusContext.screen.emit();
            this.setStatus(
              `brightness ${this.deviceState.brightness.toFixed(2)}`,
            );
          },
          setOrientation: async (orientation) => {
            this.deviceState.orientation = orientation;
            await setBrowserOrientation(orientation);
            document.documentElement.dataset.remixOrientation = orientation;
            statusContext.screen.emit();
            this.setStatus(`orientation ${orientation}`);
          },
          setTimeout: async (timeout) => {
            this.deviceState.screenTimeout = timeout;
            statusContext.screen.emit();
            this.setStatus(`screen timeout ${timeout ?? "restored"}`);
          },
        },
        status: statusContext,
        keyboard: keyboardContext,
        runtime: {
          foreground: async (enabled) => {
            this.deviceState.foreground = enabled;
            this.setStatus(
              `foreground runtime ${enabled ? "enabled" : "disabled"}`,
            );
          },
          keepCpuAwake: async (enabled) => {
            this.deviceState.keepCpuAwake = enabled;
            if (enabled) {
              await this.requestWakeLock();
            }
            this.setStatus(
              `CPU keep-awake ${enabled ? "enabled" : "disabled"}`,
            );
          },
        },
        input: {
          captureBack: async (enabled) => {
            this.deviceState.captureBack = enabled;
            this.setStatus(`back capture ${enabled ? "enabled" : "disabled"}`);
          },
          captureKeys: async (keys) => {
            this.deviceState.capturedKeys = new Set(keys);
            this.setStatus(`captured keys: ${keys.join(", ") || "none"}`);
          },
        },
        audio: {
          getVolume: async () => 1,
          setVolume: async (volume) => {
            this.setStatus(`media volume ${clampUnit(volume).toFixed(2)}`);
          },
        },
        vibration: {
          trigger: async (duration = 250) => {
            navigator.vibrate?.(duration);
            this.setStatus(`vibration ${duration}ms`);
          },
        },
      },
      events,
      host: {
        panel: createHostPanelContext({
          statusRoot: document.querySelector<HTMLElement>(
            "[data-remix-project-panel-status]",
          ),
          buttonRoot: document.querySelector<HTMLElement>(
            "[data-remix-project-panel-buttons]",
          ),
          setStatus: (status) => this.setStatus(status),
        }),
      },
    };
  }

  private emitKey(event: RemixKeyEvent): void {
    this.events.emit("key", event);
    this.setStatus(`key ${event.key} ${event.action}`);
  }

  private async applyInitialPolicy(): Promise<void> {
    document.documentElement.dataset.remixOrientation =
      this.deviceState.orientation;
    setBrowserBrightness(this.deviceState.brightness);

    if (this.deviceState.keepScreenOn || this.deviceState.keepCpuAwake) {
      await this.requestWakeLock();
    }

    await setBrowserOrientation(this.deviceState.orientation);
  }

  private async requestWakeLock(): Promise<void> {
    if (!("wakeLock" in navigator)) {
      return;
    }

    try {
      this.wakeLock = await navigator.wakeLock.request("screen");
      this.wakeLock.addEventListener("release", () => {
        this.wakeLock = undefined;
      });
    } catch {
      this.wakeLock = undefined;
    }
  }

  private async releaseWakeLock(): Promise<void> {
    try {
      await this.wakeLock?.release();
    } finally {
      this.wakeLock = undefined;
    }
  }

  private setStatus(value: string): void {
    if (this.status) {
      this.status.textContent = value;
    }
  }
}
