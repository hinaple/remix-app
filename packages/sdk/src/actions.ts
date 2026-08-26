import type { RemixScreenOrientation } from "./config.js";
import type { RemixVibrationEffect, RemixVibrationPreset } from "./device.js";
import type { RemixHostPanelButton, RemixHostPanelStatus } from "./host.js";
import type { RemixKey } from "./keys.js";
import type { RemixMqttQos } from "./mqtt.js";

export interface RemixActionArgsMap {
  "device.screen.wake": RemixEmptyActionArgs;
  "device.screen.setKeepOn": { enabled: boolean };
  "device.screen.setAutoBrightness": { enabled: boolean };
  "device.screen.setBrightness": { brightness: number };
  "device.screen.setOrientation": { orientation: RemixScreenOrientation };
  "device.screen.setTimeout": { timeout: number | null };
  "device.input.captureBack": { enabled: boolean };
  "device.input.captureKeys": { keys: RemixKey[] };
  "device.audio.setVolume": { volume: number };
  "device.vibration.play": RemixVibrationEffect;
  "device.vibration.stop": RemixEmptyActionArgs;
  "mqtt.publish": {
    connection: string;
    topic: string;
    payload: { text: string } | { base64: string };
    qos?: RemixMqttQos;
    retain?: boolean;
  };
  "project.reset": RemixEmptyActionArgs;
  "host.panel.buttons.set": { buttons: RemixHostPanelButton[] };
  "host.panel.buttons.clear": RemixEmptyActionArgs;
  "host.panel.status.set": { status: RemixHostPanelStatus[] };
  "host.panel.status.setText": { id: string; text: string };
  "host.panel.status.remove": { id: string };
  "host.panel.status.clear": RemixEmptyActionArgs;
}

export type RemixEmptyActionArgs = Record<never, never>;

export type RemixActionType = keyof RemixActionArgsMap;

export type RemixActionCall<Type extends RemixActionType = RemixActionType> =
  Type extends RemixActionType
    ? keyof RemixActionArgsMap[Type] extends never
      ? { type: Type; args?: never }
      : { type: Type; args: RemixActionArgsMap[Type] }
    : never;

export type RemixNativeEventActionType = Exclude<
  RemixActionType,
  "host.panel.buttons.set"
>;

export type RemixNativeEventAction = RemixActionCall<RemixNativeEventActionType>;

export type RemixActionExecutor = "native" | "webview";
export type RemixActionLifecycle = "application" | "activity" | "resumed";

export interface RemixActionDefinition<Args> {
  executor: RemixActionExecutor;
  lifecycle: RemixActionLifecycle;
  nativeEvents: boolean;
  serialization: "json" | "contextOnly";
  dev: "simulate" | "unsupported";
  normalizeArgs(value: unknown): Args;
}

export interface RemixNormalizedActionCall {
  type: RemixActionType;
  executor: RemixActionExecutor;
  args: Record<string, unknown>;
}

const empty = (value: unknown): RemixEmptyActionArgs => {
  const args = record(value, "action.args", false);
  if (Object.keys(args).length > 0) {
    throw new Error("action.args must be empty");
  }
  return {};
};

export const remixActionDefinitions = {
  "device.screen.wake": native("activity", empty),
  "device.screen.setKeepOn": native("activity", booleanArg("enabled")),
  "device.screen.setAutoBrightness": native(
    "application",
    booleanArg("enabled"),
  ),
  "device.screen.setBrightness": native(
    "activity",
    unitNumberArg("brightness"),
  ),
  "device.screen.setOrientation": native("activity", orientationArgs),
  "device.screen.setTimeout": native("application", timeoutArgs),
  "device.input.captureBack": native("activity", booleanArg("enabled")),
  "device.input.captureKeys": native("activity", captureKeysArgs),
  "device.audio.setVolume": native("application", unitNumberArg("volume")),
  "device.vibration.play": native("application", vibrationPlayArgs),
  "device.vibration.stop": native("application", empty),
  "mqtt.publish": native("application", mqttPublishArgs, "unsupported"),
  "project.reset": web(empty),
  "host.panel.buttons.set": {
    executor: "webview",
    lifecycle: "resumed",
    nativeEvents: false,
    serialization: "contextOnly",
    dev: "simulate",
    normalizeArgs: panelButtonsArgs,
  },
  "host.panel.buttons.clear": web(empty),
  "host.panel.status.set": web(panelStatusArgs),
  "host.panel.status.setText": web(idTextArgs),
  "host.panel.status.remove": web(idArgs),
  "host.panel.status.clear": web(empty),
} satisfies {
  [Type in RemixActionType]: RemixActionDefinition<RemixActionArgsMap[Type]>;
};

export function normalizeRemixActionCall(
  value: unknown,
  options: { nativeEvents?: boolean } = {},
): RemixNormalizedActionCall {
  const action = record(value, "action");
  const type = stringValue(action.type, "action.type") as RemixActionType;
  const definition = remixActionDefinitions[type];

  if (!definition) {
    throw new Error(`Unknown action type: ${type}`);
  }
  if (options.nativeEvents && !definition.nativeEvents) {
    throw new Error(`Action is not available to nativeEvents: ${type}`);
  }
  if (options.nativeEvents && definition.serialization !== "json") {
    throw new Error(`Action arguments are not serializable: ${type}`);
  }

  return {
    type,
    executor: definition.executor,
    args: definition.normalizeArgs(action.args) as Record<string, unknown>,
  };
}

function native<Args>(
  lifecycle: "application" | "activity",
  normalizeArgs: (value: unknown) => Args,
  dev: "simulate" | "unsupported" = "simulate",
): RemixActionDefinition<Args> {
  return {
    executor: "native",
    lifecycle,
    nativeEvents: true,
    serialization: "json",
    dev,
    normalizeArgs,
  };
}

function web<Args>(
  normalizeArgs: (value: unknown) => Args,
): RemixActionDefinition<Args> {
  return {
    executor: "webview",
    lifecycle: "resumed",
    nativeEvents: true,
    serialization: "json",
    dev: "simulate",
    normalizeArgs,
  };
}

function booleanArg<Name extends string>(name: Name) {
  return (value: unknown): Record<Name, boolean> => {
    const args = record(value, "action.args", true);
    const result = args[name];
    if (typeof result !== "boolean") {
      throw new Error(`action.args.${name} must be a boolean`);
    }
    return { [name]: result } as Record<Name, boolean>;
  };
}

function unitNumberArg<Name extends string>(name: Name) {
  return (value: unknown): Record<Name, number> => {
    const args = record(value, "action.args", true);
    const result = args[name];
    if (typeof result !== "number" || !Number.isFinite(result) || result < 0 || result > 1) {
      throw new Error(`action.args.${name} must be a number from 0 to 1`);
    }
    return { [name]: result } as Record<Name, number>;
  };
}

function orientationArgs(value: unknown): { orientation: RemixScreenOrientation } {
  const args = record(value, "action.args", true);
  const orientation = stringValue(args.orientation, "action.args.orientation");
  const allowed: RemixScreenOrientation[] = [
    "portrait",
    "landscape",
    "reversePortrait",
    "reverseLandscape",
    "sensor",
    "fullSensor",
    "locked",
    "unspecified",
  ];
  if (!allowed.includes(orientation as RemixScreenOrientation)) {
    throw new Error("action.args.orientation is invalid");
  }
  return { orientation: orientation as RemixScreenOrientation };
}

function timeoutArgs(value: unknown): { timeout: number | null } {
  const args = record(value, "action.args", true);
  if (args.timeout === null) return { timeout: null };
  if (!Number.isInteger(args.timeout) || (args.timeout as number) < 0) {
    throw new Error("action.args.timeout must be a non-negative integer or null");
  }
  return { timeout: args.timeout as number };
}

function captureKeysArgs(value: unknown): { keys: RemixKey[] } {
  const args = record(value, "action.args", true);
  const keys = args.keys;
  const allowed: RemixKey[] = [
    "BACK",
    "VOLUME_UP",
    "VOLUME_DOWN",
    "POWER",
    "HOME",
    "MENU",
  ];
  if (!Array.isArray(keys) || !keys.every((key) => allowed.includes(key as RemixKey))) {
    throw new Error("action.args.keys must contain supported device keys");
  }
  return { keys: [...new Set(keys)] as RemixKey[] };
}

function vibrationPlayArgs(value: unknown): RemixVibrationEffect {
  const args = record(value, "action.args", true);
  const kind = stringValue(args.kind, "action.args.kind");

  if (kind === "oneShot") {
    return {
      kind,
      duration: positiveInteger(args.duration, "action.args.duration"),
      intensity: vibrationIntensity(
        args.intensity,
        "action.args.intensity",
        false,
      ),
    };
  }

  if (kind === "pattern") {
    if (!Array.isArray(args.segments) || args.segments.length === 0) {
      throw new Error("action.args.segments must be a non-empty array");
    }
    const segments = args.segments.map((value, index) => {
      const segment = record(value, `action.args.segments[${index}]`, true);
      return {
        duration: positiveInteger(
          segment.duration,
          `action.args.segments[${index}].duration`,
        ),
        intensity: vibrationIntensity(
          segment.intensity,
          `action.args.segments[${index}].intensity`,
          true,
        ),
      };
    });
    if (!segments.some((segment) => segment.intensity > 0)) {
      throw new Error("action.args.segments must contain a vibration segment");
    }
    if (args.repeat !== undefined && typeof args.repeat !== "boolean") {
      throw new Error("action.args.repeat must be a boolean");
    }
    return {
      kind,
      segments,
      repeat: args.repeat ?? false,
    };
  }

  if (kind === "preset") {
    const preset = stringValue(args.preset, "action.args.preset");
    const allowed: RemixVibrationPreset[] = [
      "tick",
      "click",
      "heavyClick",
      "doubleClick",
    ];
    if (!allowed.includes(preset as RemixVibrationPreset)) {
      throw new Error("action.args.preset is invalid");
    }
    return { kind, preset: preset as RemixVibrationPreset };
  }

  throw new Error("action.args.kind is invalid");
}

function vibrationIntensity(
  value: unknown,
  field: string,
  allowZero: boolean,
): number {
  if (value === undefined) return 1;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value > 1 ||
    value < 0 ||
    (!allowZero && value === 0)
  ) {
    throw new Error(
      `${field} must be ${allowZero ? "from 0 to 1" : "greater than 0 and at most 1"}`,
    );
  }
  return value;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new Error(`${field} must be a positive integer`);
  }
  return value as number;
}

function mqttPublishArgs(value: unknown): RemixActionArgsMap["mqtt.publish"] {
  const args = record(value, "action.args", true);
  const connection = stringValue(args.connection, "action.args.connection");
  const topic = stringValue(args.topic, "action.args.topic");
  const payload = record(args.payload, "action.args.payload");
  const hasText = typeof payload.text === "string";
  const hasBase64 = typeof payload.base64 === "string";
  if (hasText === hasBase64) {
    throw new Error("action.args.payload must contain exactly one of text or base64");
  }
  if (args.qos !== undefined && ![0, 1, 2].includes(args.qos as number)) {
    throw new Error("action.args.qos must be 0, 1, or 2");
  }
  if (args.retain !== undefined && typeof args.retain !== "boolean") {
    throw new Error("action.args.retain must be a boolean");
  }
  return {
    connection,
    topic,
    payload: hasText
      ? { text: payload.text as string }
      : { base64: payload.base64 as string },
    ...(args.qos === undefined ? {} : { qos: args.qos as RemixMqttQos }),
    ...(args.retain === undefined ? {} : { retain: args.retain }),
  };
}

function panelButtonsArgs(value: unknown): { buttons: RemixHostPanelButton[] } {
  const args = record(value, "action.args", true);
  if (!Array.isArray(args.buttons)) {
    throw new Error("action.args.buttons must be an array");
  }
  return { buttons: args.buttons as RemixHostPanelButton[] };
}

function panelStatusArgs(value: unknown): { status: RemixHostPanelStatus[] } {
  const args = record(value, "action.args", true);
  if (!Array.isArray(args.status)) {
    throw new Error("action.args.status must be an array");
  }
  return {
    status: args.status.map((item, index) => {
      const status = record(item, `action.args.status[${index}]`);
      return {
        id: stringValue(status.id, `action.args.status[${index}].id`),
        label: stringValue(status.label, `action.args.status[${index}].label`),
        text: stringValue(status.text, `action.args.status[${index}].text`),
      };
    }),
  };
}

function idTextArgs(value: unknown): { id: string; text: string } {
  const args = record(value, "action.args", true);
  return {
    id: stringValue(args.id, "action.args.id"),
    text: stringValue(args.text, "action.args.text"),
  };
}

function idArgs(value: unknown): { id: string } {
  const args = record(value, "action.args", true);
  return { id: stringValue(args.id, "action.args.id") };
}

function record(
  value: unknown,
  field: string,
  required = false,
): Record<string, unknown> {
  if (value === undefined && !required) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}
