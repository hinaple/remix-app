import type { UserConfigExport as ViteConfig } from "vite";

import type { RemixKey } from "./keys.js";
import type { RemixMqttConfig, RemixMqttProjectConfig } from "./mqtt.js";
import type {
  RemixNativeEventsConfig,
  RemixNativeEventsProjectConfig,
} from "./native-events.js";
import type { RemixProjectBuildInfo } from "./version.js";

/**
 * Build-time configuration for a remixApp project.
 *
 * This file is authored as `remix.config.ts` or `remix.config.js` in the
 * source project. The CLI reads it during build and converts it into a
 * normalized `project.json` manifest inside the built project package.
 */
export interface RemixConfig {
  /**
   * Project name used in the built manifest and output package file name.
   */
  name: string;

  /**
   * Project version used in the built manifest and output package file name.
   */
  version: string;

  /**
   * Source entry module, relative to the project root.
   *
   * The CLI bundles this module and normalizes the built entry to
   * `src/index.js` inside the `.remixprj` package.
   */
  entry: string;

  /**
   * CSS entry files, relative to the project root.
   *
   * The CLI preserves this array order and combines these styles with CSS
   * discovered by Vite into the built `src/style.css` file. Configured style
   * files must exist; missing files are build errors.
   */
  styles?: string[];

  /**
   * Requests kiosk behavior from the Host APK for this project.
   *
   * This is a fixed startup policy from the project manifest, not reactive
   * runtime state.
   */
  kiosk?: boolean;

  /**
   * Screen policy requested from the Host APK when the project starts.
   */
  screen?: RemixScreenPolicy;

  /**
   * Hardware input policy requested from the Host APK when the project starts.
   */
  input?: RemixInputPolicy;

  /**
   * Native MQTT connections and fixed topic subscriptions.
   */
  mqtt?: RemixMqttConfig;

  /** Native rules evaluated while the mounted project Activity is inactive. */
  nativeEvents?: RemixNativeEventsConfig;

  /**
   * Vite configuration merged into the CLI's internal build configuration.
   *
   * The CLI may override settings that would break the remixApp package
   * contract, such as output directory, entry normalization, and relative base
   * behavior.
   */
  vite?: ViteConfig;
}

/**
 * Normalized runtime manifest written to `project.json` inside a built project
 * package.
 *
 * The Host APK reads this file. It should not need access to source-only
 * settings such as `remix.config.ts`, source entry paths, or source style
 * paths.
 */
export interface RemixProjectManifest {
  /** Version of the `.remixprj` archive and manifest layout. */
  formatVersion: number;

  /** Version of the Host context, event, and action API required by the project. */
  runtimeApiVersion: number;

  /** Tool versions recorded for diagnostics. */
  builtWith?: RemixProjectBuildInfo;

  /**
   * Project name copied from the source config.
   */
  name: string;

  /**
   * Project version copied from the source config.
   */
  version: string;

  /**
   * Normalized built entry loaded by the Host APK.
   */
  entry: "src/index.js";

  /**
   * Normalized built stylesheet loaded by the Host APK.
   */
  styles: ["src/style.css"];

  /**
   * Kiosk policy applied by the Host APK during project startup.
   */
  kiosk?: boolean;

  /**
   * Screen policy applied by the Host APK during project startup.
   */
  screen?: RemixScreenPolicy;

  /**
   * Hardware input policy applied by the Host APK during project startup.
   */
  input?: RemixInputPolicy;

  /**
   * Normalized MQTT configuration applied by the native Host runtime.
   */
  mqtt?: RemixMqttProjectConfig;

  /** Normalized native event rules executed by the Android Host. */
  nativeEvents?: RemixNativeEventsProjectConfig;
}

/**
 * Fixed screen policy requested by a project.
 */
export interface RemixScreenPolicy {
  /**
   * Requests that the Host keep the screen on while the project is active.
   */
  keepOn?: boolean;

  /**
   * Allows Android automatic screen brightness while the project is active.
   *
   * The Host defaults this to `false` so field devices keep deterministic
   * brightness behavior unless a project explicitly opts into automatic
   * adjustment.
   */
  autoBrightness?: boolean;

  /**
   * Requests Android immersive mode while the project is active.
   *
   * When kiosk mode is enabled, the Host may default this to `true`.
   */
  immersive?: boolean;

  /**
   * Requests that the Host hide visible Android system bars while the project
   * is active.
   *
   * When kiosk mode is enabled, the Host may default this to `true`.
   */
  hideSystemBars?: boolean;

  /**
   * Requested Android screen orientation while the project is active.
   *
   * The Host defaults this to `portrait` so field devices do not rotate unless
   * a project explicitly opts into another mode.
   */
  orientation?: RemixScreenOrientation;

  /**
   * Soft keyboard behavior requested while the project is active.
   *
   * The Host applies `state` through native Android soft-input mode. By
   * default native adjust is fixed to `nothing` and the Host JS runtime handles
   * `adjust`. Set `nativeAdjust` to `true` to let Android handle adjust
   * behavior natively instead.
   */
  keyboard?: RemixKeyboardPolicy;

  /**
   * Requested screen timeout in milliseconds.
   *
   * Host implementations may clamp, ignore, or translate this value depending
   * on Android/device policy constraints.
   */
  timeout?: number;
}

/**
 * Screen orientation modes understood by the Host APK.
 */
export type RemixScreenOrientation =
  | "portrait"
  | "landscape"
  | "reversePortrait"
  | "reverseLandscape"
  | "sensor"
  | "fullSensor"
  | "locked"
  | "unspecified";

/**
 * Soft keyboard policy requested by a project.
 */
export interface RemixKeyboardPolicy {
  /**
   * How the project UI should react when the soft keyboard is visible.
   *
   * When `nativeAdjust` is not enabled, this is handled by Host JS layout
   * logic. When `nativeAdjust` is enabled, this is mapped to Android native
   * soft-input adjust flags.
   */
  adjust?: RemixKeyboardAdjust;

  /**
   * Whether Android native soft-input adjust handling should be used.
   *
   * Defaults to `false`. In that default mode, native adjust is kept at
   * `nothing` and Host JS handles resize/pan/nothing.
   */
  nativeAdjust?: boolean;

  /**
   * Android soft keyboard visibility state request.
   *
   * This is always applied natively by the Host.
   */
  state?: RemixKeyboardState;
}

/**
 * Host-supported soft keyboard adjust modes.
 */
export type RemixKeyboardAdjust = "resize" | "pan" | "nothing";

/**
 * Host-supported Android soft keyboard state modes.
 */
export type RemixKeyboardState =
  | "unspecified"
  | "hidden"
  | "alwaysHidden"
  | "visible"
  | "alwaysVisible";

/**
 * Fixed hardware input policy requested by a project.
 */
export interface RemixInputPolicy {
  /**
   * Hardware keys that the Host should capture and forward through
   * `context.events`.
   */
  capturedKeys?: RemixKey[];

  /**
   * Whether the Host should capture the Android back key for this project.
   */
  captureBack?: boolean;
}

/**
 * Defines a remixApp source config with TypeScript inference.
 */
export function defineConfig(config: RemixConfig): RemixConfig {
  return config;
}
