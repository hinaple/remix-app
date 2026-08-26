import type {
  RemixActionArgsMap,
  RemixActionType,
  RemixAppContext,
  RemixAppUnmount,
  RemixHostPanelContext,
  RemixKeyEvent,
  RemixVibrationEffect,
} from "@remixapp/sdk";
import { normalizeRemixActionCall } from "@remixapp/sdk";
import {
  EventBus,
  SubscriptionScope,
  createHostPanelContext,
} from "@remixapp/runtime";

import {
  setBrowserBrightness,
  setBrowserOrientation,
} from "./browser.js";
import { clearDevHostPanel, createDevHost } from "./dom.js";
import {
  installDevControls,
  installKeyboardBridge,
  installLifecycleBridge,
} from "./input.js";
import {
  createKeyboardContext,
  createStatusContext,
  type DevStatusContext,
} from "./status.js";
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
  private vibrationRepeatTimer: number | undefined;

  constructor(private readonly options: RemixDevHostOptions) {
    this.projectModule = options.projectModule;
    this.deviceState = {
      keepScreenOn: options.manifest.screen?.keepOn ?? false,
      autoBrightness: options.manifest.screen?.autoBrightness ?? false,
      brightness: 1,
      screenTimeout: options.manifest.screen?.timeout,
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
      emitLifecycle: (event) => this.events.emit("project:lifecycle", event),
    });
    installDevControls({
      emitKey: (event) => this.emitKey(event),
      emitLifecycle: (event) => this.events.emit("project:lifecycle", event),
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
      this.events.emit("project:lifecycle", { state: "mounted" });
      this.setStatus("mounted");
    } catch (error) {
      await this.projectSubscriptions.clear();
      throw error;
    }
  }

  private async stopProject(): Promise<void> {
    this.stopVibration();
    if (!this.mounted) {
      return;
    }

    this.mounted = false;
    this.events.emit("project:lifecycle", { state: "destroyed" });

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
    const hostPanel = createHostPanelContext({
      statusRoot: document.querySelector<HTMLElement>(
        "[data-remix-project-panel-status]",
      ),
      buttonRoot: document.querySelector<HTMLElement>(
        "[data-remix-project-panel-buttons]",
      ),
      setStatus: (status) => this.setStatus(status),
    });
    const invoke = (type: RemixActionType, args?: Record<string, unknown>) =>
      this.executeAction(type, args, statusContext, hostPanel);

    events.bindSource("device:status:battery", statusContext.battery);
    events.bindSource("device:status:network", statusContext.network);
    events.bindSource("device:status:screen", statusContext.screen);
    events.bindSource("device:status:keyboard", keyboardContext);

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
        reset: () => invoke("project.reset"),
      },
      // Device-specific Constants resolution remains Native-only for now.
      constants: Object.freeze({}),
      resources: {
        url: (resourcePath) =>
          new URL(`resources/${resourcePath}`, window.location.href).href,
      },
      device: {
        screen: {
          wake: async () => {
            await invoke("device.screen.wake");
          },
          setKeepOn: async (enabled) => {
            await invoke("device.screen.setKeepOn", { enabled });
          },
          setAutoBrightness: async (enabled) => {
            await invoke("device.screen.setAutoBrightness", { enabled });
          },
          setBrightness: async (brightness) => {
            await invoke("device.screen.setBrightness", { brightness });
          },
          setOrientation: async (orientation) => {
            await invoke("device.screen.setOrientation", { orientation });
          },
          setTimeout: async (timeout) => {
            await invoke("device.screen.setTimeout", { timeout });
          },
        },
        status: statusContext,
        keyboard: keyboardContext,
        input: {
          captureBack: async (enabled) => {
            await invoke("device.input.captureBack", { enabled });
          },
          captureKeys: async (keys) => {
            await invoke("device.input.captureKeys", { keys });
          },
        },
        audio: {
          getVolume: async () => 1,
          setVolume: async (volume) => {
            await invoke("device.audio.setVolume", { volume });
          },
        },
        vibration: {
          play: async (effect) => {
            await invoke("device.vibration.play", effect);
          },
          trigger: async (duration, intensity = 1) => {
            await invoke("device.vibration.play", {
              kind: "oneShot",
              duration,
              intensity,
            });
          },
          stop: async () => {
            await invoke("device.vibration.stop");
          },
        },
      },
      events,
      mqtt: {
        getStatus: async (connection) => ({
          connection,
          state: "disconnected",
          reason: "MQTT is only available in the Android Host",
        }),
        publish: async (connection, topic, payload, options) => {
          await invoke("mqtt.publish", {
            connection,
            topic,
            payload:
              typeof payload === "string"
                ? { text: payload }
                : { base64: encodeBase64(payload) },
            ...options,
          });
        },
      },
      host: {
        panel: {
          buttons: {
            set: (buttons) => {
              void invoke("host.panel.buttons.set", { buttons });
            },
            clear: () => {
              void invoke("host.panel.buttons.clear");
            },
          },
          status: {
            set: (status) => {
              void invoke("host.panel.status.set", { status });
            },
            setText: (id, text) => {
              void invoke("host.panel.status.setText", { id, text });
            },
            remove: (id) => {
              void invoke("host.panel.status.remove", { id });
            },
            clear: () => {
              void invoke("host.panel.status.clear");
            },
          },
        },
      },
    };
  }

  private async executeAction(
    type: RemixActionType,
    args: Record<string, unknown> | undefined,
    statusContext: DevStatusContext,
    hostPanel: RemixHostPanelContext,
  ): Promise<void> {
    const action = normalizeRemixActionCall({ type, args });

    switch (action.type) {
      case "device.screen.wake":
        await this.requestWakeLock();
        statusContext.screen.emit();
        this.setStatus("screen wake requested");
        return;
      case "device.screen.setKeepOn": {
        const { enabled } = action.args as RemixActionArgsMap["device.screen.setKeepOn"];
        this.deviceState.keepScreenOn = enabled;
        if (enabled) await this.requestWakeLock();
        else await this.releaseWakeLock();
        statusContext.screen.emit();
        this.setStatus(`screen keep-on ${enabled ? "enabled" : "disabled"}`);
        return;
      }
      case "device.screen.setAutoBrightness": {
        const { enabled } = action.args as RemixActionArgsMap["device.screen.setAutoBrightness"];
        this.deviceState.autoBrightness = enabled;
        statusContext.screen.emit();
        this.setStatus(`auto brightness ${enabled ? "enabled" : "disabled"}`);
        return;
      }
      case "device.screen.setBrightness": {
        const { brightness } = action.args as RemixActionArgsMap["device.screen.setBrightness"];
        this.deviceState.brightness = brightness;
        setBrowserBrightness(brightness);
        statusContext.screen.emit();
        this.setStatus(`brightness ${brightness.toFixed(2)}`);
        return;
      }
      case "device.screen.setOrientation": {
        const { orientation } = action.args as RemixActionArgsMap["device.screen.setOrientation"];
        this.deviceState.orientation = orientation;
        await setBrowserOrientation(orientation);
        document.documentElement.dataset.remixOrientation = orientation;
        statusContext.screen.emit();
        this.setStatus(`orientation ${orientation}`);
        return;
      }
      case "device.screen.setTimeout": {
        const { timeout } = action.args as RemixActionArgsMap["device.screen.setTimeout"];
        this.deviceState.screenTimeout = timeout ?? undefined;
        statusContext.screen.emit();
        this.setStatus(`screen timeout ${timeout ?? "restored"}`);
        return;
      }
      case "device.input.captureBack": {
        const { enabled } = action.args as RemixActionArgsMap["device.input.captureBack"];
        this.deviceState.captureBack = enabled;
        this.setStatus(`back capture ${enabled ? "enabled" : "disabled"}`);
        return;
      }
      case "device.input.captureKeys": {
        const { keys } = action.args as RemixActionArgsMap["device.input.captureKeys"];
        this.deviceState.capturedKeys = new Set(keys);
        this.setStatus(`captured keys: ${keys.join(", ") || "none"}`);
        return;
      }
      case "device.audio.setVolume": {
        const { volume } = action.args as RemixActionArgsMap["device.audio.setVolume"];
        this.setStatus(`media volume ${volume.toFixed(2)}`);
        return;
      }
      case "device.vibration.play": {
        const effect = action.args as RemixActionArgsMap["device.vibration.play"];
        this.playVibration(effect);
        this.setStatus(vibrationStatus(effect));
        return;
      }
      case "device.vibration.stop": {
        this.stopVibration();
        this.setStatus("vibration stopped");
        return;
      }
      case "mqtt.publish":
        throw new Error("MQTT publishing is only available in the Android Host.");
      case "project.reset":
        await this.resetProject();
        return;
      case "host.panel.buttons.set":
        hostPanel.buttons.set(
          (action.args as RemixActionArgsMap["host.panel.buttons.set"]).buttons,
        );
        return;
      case "host.panel.buttons.clear":
        hostPanel.buttons.clear();
        return;
      case "host.panel.status.set":
        hostPanel.status.set(
          (action.args as RemixActionArgsMap["host.panel.status.set"]).status,
        );
        return;
      case "host.panel.status.setText": {
        const { id, text } = action.args as RemixActionArgsMap["host.panel.status.setText"];
        hostPanel.status.setText(id, text);
        return;
      }
      case "host.panel.status.remove":
        hostPanel.status.remove(
          (action.args as RemixActionArgsMap["host.panel.status.remove"]).id,
        );
        return;
      case "host.panel.status.clear":
        hostPanel.status.clear();
    }
  }

  private emitKey(event: RemixKeyEvent): void {
    this.events.emit("device:key", event);
    this.setStatus(`key ${event.key} ${event.action}`);
  }

  private async applyInitialPolicy(): Promise<void> {
    document.documentElement.dataset.remixOrientation =
      this.deviceState.orientation;
    setBrowserBrightness(this.deviceState.brightness);

    if (this.deviceState.keepScreenOn) {
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

  private playVibration(effect: RemixVibrationEffect): void {
    this.stopVibration();
    const pattern = browserVibrationPattern(effect);
    navigator.vibrate?.(pattern);

    if (effect.kind !== "pattern" || !effect.repeat) {
      return;
    }

    const duration = effect.segments.reduce(
      (total, segment) => total + segment.duration,
      0,
    );
    const replay = () => {
      navigator.vibrate?.(pattern);
      this.vibrationRepeatTimer = window.setTimeout(replay, duration);
    };
    this.vibrationRepeatTimer = window.setTimeout(replay, duration);
  }

  private stopVibration(): void {
    if (this.vibrationRepeatTimer !== undefined) {
      window.clearTimeout(this.vibrationRepeatTimer);
      this.vibrationRepeatTimer = undefined;
    }
    navigator.vibrate?.(0);
  }

  private setStatus(value: string): void {
    if (this.status) {
      this.status.textContent = value;
    }
  }
}

function browserVibrationPattern(effect: RemixVibrationEffect): number | number[] {
  if (effect.kind === "oneShot") {
    return effect.duration;
  }
  if (effect.kind === "preset") {
    switch (effect.preset) {
      case "tick":
        return 20;
      case "click":
        return 35;
      case "heavyClick":
        return 60;
      case "doubleClick":
        return [35, 60, 35];
    }
  }

  const states: Array<{ on: boolean; duration: number }> = [];
  for (const segment of effect.segments) {
    const on = (segment.intensity ?? 1) > 0;
    const previous = states.at(-1);
    if (previous?.on === on) {
      previous.duration += segment.duration;
    } else {
      states.push({ on, duration: segment.duration });
    }
  }

  const pattern = states.map((state) => state.duration);
  if (!states[0].on) pattern.unshift(0);
  return pattern;
}

function vibrationStatus(effect: RemixVibrationEffect): string {
  switch (effect.kind) {
    case "oneShot":
      return `vibration ${effect.duration}ms intensity ${(effect.intensity ?? 1).toFixed(2)}`;
    case "pattern":
      return `vibration pattern ${effect.segments.length} segment${effect.segments.length === 1 ? "" : "s"}${effect.repeat ? " repeating" : ""}`;
    case "preset":
      return `vibration preset ${effect.preset}`;
  }
}

function encodeBase64(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}
