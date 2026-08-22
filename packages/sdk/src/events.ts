import type {
  RemixBatteryStatus,
  RemixKeyboardStatus,
  RemixNetworkStatus,
  RemixScreenStatus,
} from "./device.js";
import type { RemixKey } from "./keys.js";
import type { RemixMqttMessage, RemixMqttStatus } from "./mqtt.js";

/**
 * Event subscription API exposed by the Host APK.
 */
export interface RemixEventContext {
  /**
   * Subscribes to a Host event and returns an unsubscribe function.
   */
  on<K extends keyof RemixEventMap>(
    type: K,
    listener: (event: RemixEventMap[K]) => void,
  ): RemixEventUnsubscribe;
}

/**
 * Removes a previously registered event listener.
 */
export type RemixEventUnsubscribe = () => void;

/**
 * Event payload map supported by the initial SDK.
 */
export interface RemixEventMap {
  /**
   * Hardware key events captured by the Host.
   */
  "device:key": RemixKeyEvent;

  /**
   * Battery status updates emitted by the Host.
   */
  "device:status:battery": RemixBatteryStatus;

  /**
   * Network connectivity status updates emitted by the Host.
   */
  "device:status:network": RemixNetworkStatus;

  /**
   * Screen status updates emitted by the Host.
   */
  "device:status:screen": RemixScreenStatus;

  /**
   * Soft keyboard status updates emitted by the Host.
   */
  "device:status:keyboard": RemixKeyboardStatus;

  /**
   * Project lifecycle events emitted by the Host.
   */
  "project:lifecycle": RemixLifecycleEvent;

  /**
   * Native MQTT connection state changes.
   */
  "mqtt:status": RemixMqttStatus;

  /**
   * Messages received by native MQTT subscriptions.
   */
  "mqtt:message": RemixMqttMessage;
}

/**
 * Hardware key event forwarded by the Host.
 */
export interface RemixKeyEvent {
  /**
   * Captured hardware key identifier.
   */
  key: RemixKey;

  /**
   * Whether the key was pressed or released.
   */
  action: "down" | "up";
}

/**
 * Project lifecycle event emitted by the Host.
 */
export interface RemixLifecycleEvent {
  /**
   * Current lifecycle state for the mounted project.
   */
  state: "mounted" | "paused" | "resumed" | "destroyed";
}
