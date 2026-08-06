import { RemixCore, type RemixCoreMqttStatus } from "@remixapp/core";
import type { RemixMqttContext, RemixMqttStatus } from "@remixapp/sdk";
import type { ProjectActionClient } from "./action-client.js";

export function createMqttContext(actions: ProjectActionClient): RemixMqttContext {
  return {
    getStatus: async (connection) =>
      toMqttStatus(await RemixCore.getMqttStatus({ connection })),
    publish: (connection, topic, payload, options = {}) =>
      actions.invoke("mqtt.publish", {
        connection,
        topic,
        payload:
          typeof payload === "string"
            ? { text: payload }
            : { base64: encodeBase64(payload) },
        qos: options.qos ?? 0,
        retain: options.retain ?? false,
      }),
  };
}

export function toMqttStatus(status: RemixCoreMqttStatus): RemixMqttStatus {
  return {
    connection: status.connection,
    state: status.state,
    ...(status.reason === undefined ? {} : { reason: status.reason }),
  };
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }

  return btoa(binary);
}
