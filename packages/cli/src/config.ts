import fs from "node:fs/promises";
import path from "node:path";

import { normalizeRemixActionCall, type RemixConfig } from "@remixapp/sdk";
import {
  loadConfigFromFile,
  type ConfigEnv,
  type UserConfig,
  type UserConfigExport,
} from "vite";

import { fail } from "./errors.js";

const CONFIG_FILES = ["remix.config.ts", "remix.config.js"] as const;

export interface LoadedRemixConfig {
  config: RemixConfig;
  configFile: string;
}

export async function loadRemixConfig(
  cwd: string,
  env: ConfigEnv = {
    command: "build",
    mode: "production",
  },
): Promise<LoadedRemixConfig> {
  const configFile = await findConfigFile(cwd);
  const loaded = await loadConfigFromFile(env, configFile, cwd);

  if (!loaded) {
    fail(`Failed to load config: ${path.relative(cwd, configFile)}`);
  }

  const config = validateRemixConfig(loaded.config, cwd);
  return { config, configFile };
}

export async function resolveViteConfig(
  viteConfig: UserConfigExport | undefined,
  env: ConfigEnv,
): Promise<UserConfig> {
  if (!viteConfig) {
    return {};
  }

  const resolved =
    typeof viteConfig === "function" ? viteConfig(env) : viteConfig;
  return await Promise.resolve(resolved);
}

async function findConfigFile(cwd: string): Promise<string> {
  for (const fileName of CONFIG_FILES) {
    const filePath = path.resolve(cwd, fileName);

    try {
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        return filePath;
      }
    } catch {
      // Try the next supported config file name.
    }
  }

  fail(`Missing remix config. Expected one of: ${CONFIG_FILES.join(", ")}`);
}

function validateRemixConfig(value: unknown, cwd: string): RemixConfig {
  if (!isRecord(value)) {
    fail("remix config must export an object");
  }

  if (typeof value.name !== "string" || value.name.length === 0) {
    fail('remix config field "name" must be a non-empty string');
  }

  if (typeof value.version !== "string" || !isSemanticVersion(value.version)) {
    fail('remix config field "version" must be a semantic version such as 1.0.0');
  }

  if (typeof value.entry !== "string" || value.entry.length === 0) {
    fail('remix config field "entry" must be a non-empty string');
  }

  if (value.styles !== undefined && !isStringArray(value.styles)) {
    fail('remix config field "styles" must be an array of strings');
  }

  if (value.kiosk !== undefined && typeof value.kiosk !== "boolean") {
    fail('remix config field "kiosk" must be a boolean');
  }

  if (value.screen !== undefined) {
    if (!isRecord(value.screen)) {
      fail('remix config field "screen" must be an object');
    }

    if (
      value.screen.autoBrightness !== undefined &&
      typeof value.screen.autoBrightness !== "boolean"
    ) {
      fail('remix config field "screen.autoBrightness" must be a boolean');
    }

    if (value.screen.keyboard !== undefined) {
      if (!isRecord(value.screen.keyboard)) {
        fail('remix config field "screen.keyboard" must be an object');
      }

      if (
        value.screen.keyboard.adjust !== undefined &&
        (typeof value.screen.keyboard.adjust !== "string" ||
          !["resize", "pan", "nothing"].includes(value.screen.keyboard.adjust))
      ) {
        fail(
          'remix config field "screen.keyboard.adjust" must be one of: resize, pan, nothing',
        );
      }

      if (
        value.screen.keyboard.nativeAdjust !== undefined &&
        typeof value.screen.keyboard.nativeAdjust !== "boolean"
      ) {
        fail(
          'remix config field "screen.keyboard.nativeAdjust" must be a boolean',
        );
      }

      if (
        value.screen.keyboard.state !== undefined &&
        (typeof value.screen.keyboard.state !== "string" ||
          ![
            "unspecified",
            "hidden",
            "alwaysHidden",
            "visible",
            "alwaysVisible",
          ].includes(value.screen.keyboard.state))
      ) {
        fail(
          'remix config field "screen.keyboard.state" must be one of: unspecified, hidden, alwaysHidden, visible, alwaysVisible',
        );
      }
    }
  }

  if (value.mqtt !== undefined) {
    validateMqttConfig(value.mqtt);
  }

  if (value.nativeEvents !== undefined) {
    validateNativeEventsConfig(value.nativeEvents);
  }

  const config = value as unknown as RemixConfig;
  assertRelativePath(config.entry, "entry");

  for (const style of config.styles ?? []) {
    assertRelativePath(style, "styles");
  }

  return config;

  function assertRelativePath(filePath: string, field: string): void {
    if (path.isAbsolute(filePath)) {
      fail(
        `remix config field "${field}" must use a project-relative path: ${path.relative(cwd, filePath)}`,
      );
    }
  }
}

function validateNativeEventsConfig(value: unknown): void {
  if (!isRecord(value) || !Array.isArray(value.rules)) {
    fail('remix config field "nativeEvents.rules" must be an array');
  }

  const eventTypes = new Set([
    "device:key",
    "device:status:battery",
    "device:status:network",
    "device:status:screen",
    "device:status:keyboard",
    "project:lifecycle",
    "mqtt:status",
    "mqtt:message",
  ]);

  for (const [index, rule] of value.rules.entries()) {
    const field = `nativeEvents.rules[${index}]`;
    if (!isRecord(rule)) fail(`remix config field "${field}" must be an object`);
    if (typeof rule.on !== "string" || !eventTypes.has(rule.on)) {
      fail(`remix config field "${field}.on" must be a supported event name`);
    }
    if (rule.when !== undefined) validateNativeEventWhen(rule.when, `${field}.when`);
    if (!Array.isArray(rule.actions) || rule.actions.length === 0) {
      fail(`remix config field "${field}.actions" must be a non-empty array`);
    }
    for (const [actionIndex, action] of rule.actions.entries()) {
      try {
        normalizeRemixActionCall(action, { nativeEvents: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        fail(`${field}.actions[${actionIndex}]: ${message}`);
      }
    }
    if (
      rule.expiresIn !== undefined &&
      (!Number.isInteger(rule.expiresIn) || (rule.expiresIn as number) < 1)
    ) {
      fail(`remix config field "${field}.expiresIn" must be a positive integer`);
    }
  }
}

function validateNativeEventWhen(value: unknown, field: string): void {
  if (!isRecord(value)) fail(`remix config field "${field}" must be an object`);

  for (const [path, matcher] of Object.entries(value)) {
    if (!path || path.split(".").some((part) => !part)) {
      fail(`remix config field "${field}" contains an invalid dot path`);
    }
    if (isPrimitive(matcher)) continue;
    if (!isRecord(matcher) || Object.keys(matcher).length === 0) {
      fail(`remix config field "${field}.${path}" must be a primitive or matcher object`);
    }
    for (const [operator, expected] of Object.entries(matcher)) {
      const matcherField = `${field}.${path}.${operator}`;
      if (operator === "eq" || operator === "ne") {
        if (!isPrimitive(expected)) {
          fail(`remix config field "${matcherField}" must be a primitive`);
        }
      } else if (["gt", "gte", "lt", "lte"].includes(operator)) {
        if (typeof expected !== "number" || !Number.isFinite(expected)) {
          fail(`remix config field "${matcherField}" must be a finite number`);
        }
      } else if (operator === "in") {
        if (!Array.isArray(expected) || !expected.every(isPrimitive)) {
          fail(`remix config field "${matcherField}" must be an array of primitives`);
        }
      } else if (operator === "contains") {
        if (typeof expected !== "string") {
          fail(`remix config field "${matcherField}" must be a string`);
        }
      } else if (operator === "exists") {
        if (typeof expected !== "boolean") {
          fail(`remix config field "${matcherField}" must be a boolean`);
        }
      } else {
        fail(`remix config field "${field}.${path}" has unknown operator: ${operator}`);
      }
    }
  }
}

function isPrimitive(value: unknown): boolean {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function validateMqttConfig(value: unknown): void {
  if (!isRecord(value)) {
    fail('remix config field "mqtt" must be an object');
  }

  if (!isRecord(value.connections)) {
    fail('remix config field "mqtt.connections" must be an object');
  }

  for (const [connectionName, connection] of Object.entries(
    value.connections,
  )) {
    const field = `mqtt.connections.${connectionName}`;

    if (!connectionName || !/^[A-Za-z0-9_-]+$/.test(connectionName)) {
      fail(
        'remix config MQTT connection names may contain only letters, numbers, "_", and "-"',
      );
    }

    if (!isRecord(connection)) {
      fail(`remix config field "${field}" must be an object`);
    }

    validateMqttConnection(connection, field);
  }
}

function validateMqttConnection(
  value: Record<string, unknown>,
  field: string,
): void {
  if (typeof value.url !== "string" || value.url.length === 0) {
    fail(`remix config field "${field}.url" must be a non-empty string`);
  }

  let brokerUrl: URL;

  try {
    brokerUrl = new URL(value.url);
  } catch {
    fail(`remix config field "${field}.url" must be a valid URL`);
  }

  if (!new Set(["mqtt:", "mqtts:"]).has(brokerUrl.protocol)) {
    fail(
      `remix config field "${field}.url" must use mqtt:// or mqtts://`,
    );
  }

  if (
    !brokerUrl.hostname ||
    (brokerUrl.pathname !== "" && brokerUrl.pathname !== "/") ||
    brokerUrl.search ||
    brokerUrl.hash
  ) {
    fail(
      `remix config field "${field}.url" must contain only a broker host and optional port`,
    );
  }

  if (brokerUrl.username || brokerUrl.password) {
    fail(
      `remix config field "${field}.url" must not contain credentials; use username and password fields`,
    );
  }

  for (const name of ["clientId", "username", "password"] as const) {
    if (value[name] !== undefined && typeof value[name] !== "string") {
      fail(`remix config field "${field}.${name}" must be a string`);
    }
  }

  if (value.clientId === "") {
    fail(`remix config field "${field}.clientId" must not be empty`);
  }

  if (value.password !== undefined && value.username === undefined) {
    fail(
      `remix config field "${field}.password" requires a username`,
    );
  }

  if (
    value.keepAliveSeconds !== undefined &&
    (!Number.isInteger(value.keepAliveSeconds) ||
      (value.keepAliveSeconds as number) < 0 ||
      (value.keepAliveSeconds as number) > 65_535)
  ) {
    fail(
      `remix config field "${field}.keepAliveSeconds" must be an integer from 0 to 65535`,
    );
  }

  for (const name of ["cleanSession", "reconnect"] as const) {
    if (value[name] !== undefined && typeof value[name] !== "boolean") {
      fail(`remix config field "${field}.${name}" must be a boolean`);
    }
  }

  if (value.subscriptions === undefined) {
    return;
  }

  if (!Array.isArray(value.subscriptions)) {
    fail(`remix config field "${field}.subscriptions" must be an array`);
  }

  const filters = new Set<string>();

  for (const [index, subscription] of value.subscriptions.entries()) {
    const subscriptionField = `${field}.subscriptions[${index}]`;

    if (!isRecord(subscription)) {
      fail(`remix config field "${subscriptionField}" must be an object`);
    }

    if (
      typeof subscription.filter !== "string" ||
      !isValidMqttTopicFilter(subscription.filter)
    ) {
      fail(
        `remix config field "${subscriptionField}.filter" must be a valid MQTT topic filter`,
      );
    }

    if (filters.has(subscription.filter)) {
      fail(
        `remix config field "${field}.subscriptions" contains duplicate filter: ${subscription.filter}`,
      );
    }
    filters.add(subscription.filter);

    if (
      subscription.qos !== undefined &&
      ![0, 1, 2].includes(subscription.qos as number)
    ) {
      fail(`remix config field "${subscriptionField}.qos" must be 0, 1, or 2`);
    }
  }
}

function isValidMqttTopicFilter(filter: string): boolean {
  if (!filter || filter.includes("\u0000")) {
    return false;
  }

  const levels = filter.split("/");

  return levels.every((level, index) => {
    if (level.includes("#")) {
      return level === "#" && index === levels.length - 1;
    }

    if (level.includes("+")) {
      return level === "+";
    }

    return true;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isSemanticVersion(value: string): boolean {
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
    value,
  );
}
