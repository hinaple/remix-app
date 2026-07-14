import fs from "node:fs/promises";
import path from "node:path";

import type { RemixConfig } from "@remixapp/sdk";
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

  if (typeof value.version !== "string" || value.version.length === 0) {
    fail('remix config field "version" must be a non-empty string');
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}
