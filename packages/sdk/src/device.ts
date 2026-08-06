import type { RemixScreenOrientation } from "./config.js";
import type { RemixKey } from "./keys.js";

/**
 * Device capability surface exposed by the Host APK.
 */
export interface RemixDeviceContext {
  /**
   * Screen-related controls.
   */
  screen: RemixScreenContext;

  /**
   * Device status readers.
   *
   * Subscribe to status updates through `context.events`.
   */
  status: RemixDeviceStatusContext;

  /**
   * Soft keyboard status reader.
   *
   * Subscribe through `context.events.on("device:status:keyboard", ...)`.
   */
  keyboard: RemixReadableStatus<RemixKeyboardStatus>;

  /**
   * Hardware input capture controls.
   */
  input: RemixInputContext;

  /**
   * Media audio controls.
   */
  audio: RemixAudioContext;

  /**
   * Device vibration controls.
   */
  vibration: RemixVibrationContext;
}

/**
 * Screen controls exposed to project code.
 */
export interface RemixScreenContext {
  /**
   * Requests that the Host wake or refresh the screen.
   */
  wake(): Promise<void>;

  /**
   * Enables or disables screen keep-on behavior at runtime.
   */
  setKeepOn(enabled: boolean): Promise<void>;

  /**
   * Enables or disables Android automatic brightness at runtime.
   */
  setAutoBrightness(enabled: boolean): Promise<void>;

  /**
   * Sets app screen brightness at runtime.
   *
   * The value is normalized from 0 to 1. Host implementations may clamp values
   * outside that range.
   */
  setBrightness(brightness: number): Promise<void>;

  /**
   * Changes the Android screen orientation while the project is running.
   */
  setOrientation(orientation: RemixScreenOrientation): Promise<void>;

  /**
   * Sets Android screen-off timeout while the project is running.
   *
   * Passing `undefined` asks the Host to restore its previous timeout when
   * supported.
   */
  setTimeout(timeout: number | undefined): Promise<void>;
}

/**
 * Device status APIs exposed to project code.
 */
export interface RemixDeviceStatusContext {
  /**
   * Battery status.
   */
  battery: RemixReadableStatus<RemixBatteryStatus>;

  /**
   * Network connectivity status.
   */
  network: RemixReadableStatus<RemixNetworkStatus>;

  /**
   * Screen status.
   */
  screen: RemixReadableStatus<RemixScreenStatus>;
}

/**
 * Readable device status channel.
 */
export interface RemixReadableStatus<T> {
  /**
   * Reads the current status once.
   */
  get(): Promise<T>;

}

/**
 * Current battery status.
 */
export interface RemixBatteryStatus {
  /**
   * Battery level from 0 to 1.
   */
  level: number;

  /**
   * Whether Android reports the device is currently charging or full.
   */
  charging: boolean;
}

/**
 * Current network connectivity status.
 */
export interface RemixNetworkStatus {
  /**
   * Whether any usable network is currently connected.
   */
  connected: boolean;

  /**
   * Best-effort network transport type.
   */
  type: "wifi" | "cellular" | "ethernet" | "none" | "unknown";
}

/**
 * Current screen status.
 */
export interface RemixScreenStatus {
  /**
   * Whether Android currently reports the screen/device as interactive.
   */
  interactive: boolean;

  /**
   * Host-tracked screen keep-on state.
   */
  keepOn: boolean;

  /**
   * Whether Android automatic brightness is enabled.
   */
  autoBrightness: boolean;

  /**
   * Current screen brightness from 0 to 1 when readable.
   */
  brightness?: number;

  /**
   * Current Host-tracked screen timeout in milliseconds when known.
   */
  timeout?: number;

  /**
   * Host-tracked orientation policy.
   */
  orientation: RemixScreenOrientation;
}

/**
 * Current soft keyboard status.
 */
export interface RemixKeyboardStatus {
  /**
   * Whether Android currently reports the soft keyboard as visible.
   */
  visible: boolean;

  /**
   * Current soft keyboard height in CSS pixels.
   */
  height: number;
}

/**
 * Hardware input controls exposed to project code.
 */
export interface RemixInputContext {
  /**
   * Enables or disables Android back key capture at runtime.
   */
  captureBack(enabled: boolean): Promise<void>;

  /**
   * Replaces the set of hardware keys captured by the Host at runtime.
   */
  captureKeys(keys: RemixKey[]): Promise<void>;
}

/**
 * Media audio controls exposed to project code.
 */
export interface RemixAudioContext {
  /**
   * Reads the current media volume from 0 to 1.
   */
  getVolume(): Promise<number>;

  /**
   * Sets media volume from 0 to 1.
   */
  setVolume(volume: number): Promise<void>;
}

/**
 * Vibration controls exposed to project code.
 */
export interface RemixVibrationContext {
  /**
   * Triggers a vibration for the given duration in milliseconds.
   */
  trigger(duration?: number): Promise<void>;
}
