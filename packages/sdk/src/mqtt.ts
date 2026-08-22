/**
 * Build-time MQTT configuration for a remixApp project.
 */
export interface RemixMqttConfig {
  /**
   * MQTT connections keyed by the project-facing connection name.
   */
  connections: Record<string, RemixMqttConnectionConfig>;
}

/**
 * MQTT connection authored in `remix.config.ts`.
 */
export interface RemixMqttConnectionConfig {
  /**
   * Native MQTT broker URL. Initial support is limited to `mqtt://` and
   * `mqtts://` URLs.
   */
  url: string;

  /**
   * MQTT broker client id. The Host generates a stable id when omitted.
   */
  clientId?: string;

  /**
   * Optional MQTT username.
   */
  username?: string;

  /**
   * Optional MQTT password. This value is stored in the built project
   * manifest and must not be treated as a protected secret.
   */
  password?: string;

  /**
   * MQTT keep-alive interval in seconds. Defaults to 30.
   */
  keepAliveSeconds?: number;

  /**
   * Whether the broker session should be cleaned on connect. Defaults to true.
   */
  cleanSession?: boolean;

  /**
   * Whether the native client should reconnect automatically. Defaults to true.
   */
  reconnect?: boolean;

  /**
   * Topic filters subscribed by the native client after each connection.
   */
  subscriptions?: RemixMqttSubscriptionConfig[];
}

/**
 * Normalized MQTT manifest stored in `project.json`.
 */
export interface RemixMqttProjectConfig {
  connections: Record<string, RemixMqttProjectConnectionConfig>;
}

/**
 * Normalized native MQTT connection settings.
 */
export interface RemixMqttProjectConnectionConfig {
  url: string;
  clientId?: string;
  username?: string;
  password?: string;
  keepAliveSeconds: number;
  cleanSession: boolean;
  reconnect: boolean;
  subscriptions: RemixMqttProjectSubscriptionConfig[];
}

export interface RemixMqttSubscriptionConfig {
  filter: string;
  qos?: RemixMqttQos;
}

export interface RemixMqttProjectSubscriptionConfig {
  filter: string;
  qos: RemixMqttQos;
}

export type RemixMqttQos = 0 | 1 | 2;

/**
 * MQTT commands exposed to mounted project code.
 *
 * Connections and subscriptions are owned by the project manifest. Runtime
 * code can read connection status and publish messages but cannot reconfigure
 * the native client.
 */
export interface RemixMqttContext {
  getStatus(connection: string): Promise<RemixMqttStatus>;

  publish(
    connection: string,
    topic: string,
    payload: string | Uint8Array,
    options?: RemixMqttPublishOptions,
  ): Promise<void>;
}

export interface RemixMqttPublishOptions {
  qos?: RemixMqttQos;
  retain?: boolean;
}

export type RemixMqttConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export interface RemixMqttStatus {
  connection: string;
  state: RemixMqttConnectionState;
  reason?: string;
}

export interface RemixMqttMessage {
  connection: string;
  topic: string;
  payload: Uint8Array;
  qos: RemixMqttQos;
  retained: boolean;
  duplicate: boolean;
  receivedAt: number;
}
