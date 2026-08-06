import {
  RemixCore,
  type RemixCoreMqttMessageEvent,
  type RemixCoreMqttStatus,
  type RemixCoreNativeActionRequest,
} from "@remixapp/core";
import {
  type EventBus,
  type LazyStatusChannel,
  type SubscriptionScope,
} from "@remixapp/runtime";
import type {
  RemixEventUnsubscribe,
  RemixKeyboardStatus,
  RemixKeyEvent,
  RemixLifecycleEvent,
  RemixMqttContext,
  RemixMqttMessage,
  RemixMqttStatus,
} from "@remixapp/sdk";

import { createMqttContext, toMqttStatus } from "./mqtt-context.js";
import type { ProjectActionClient } from "./action-client.js";
import {
  createKeyboardContext,
  createStatusContext,
  type ProjectStatusContext,
} from "./status-context.js";

export interface NativeProjectEventBindings {
  status: ProjectStatusContext;
  keyboard: LazyStatusChannel<RemixKeyboardStatus>;
  mqtt: RemixMqttContext;
}

export async function bindNativeProjectEvents(
  subscriptions: SubscriptionScope,
  events: EventBus,
  actions: ProjectActionClient,
  onKey: ((event: RemixKeyEvent) => void) | undefined,
): Promise<NativeProjectEventBindings> {
  const status = createStatusContext(subscriptions);
  const keyboard = createKeyboardContext(subscriptions);

  events.bindSource("device:status:battery", status.battery);
  events.bindSource("device:status:network", status.network);
  events.bindSource("device:status:screen", status.screen);
  events.bindSource("device:status:keyboard", keyboard);
  events.bindSource("mqtt:status", createMqttStatusSource(subscriptions));
  events.bindSource("mqtt:message", createMqttMessageSource(subscriptions));

  await registerNativeForwarder<RemixKeyEvent>(
    subscriptions,
    "device:key",
    (listener) => RemixCore.addListener("device:key", listener),
    (event) => {
      onKey?.(event);
      events.emit("device:key", event);
    },
  );
  await registerNativeForwarder<RemixLifecycleEvent>(
    subscriptions,
    "project:lifecycle",
    (listener) => RemixCore.addListener("project:lifecycle", listener),
    (event) => events.emit("project:lifecycle", event),
  );
  await registerNativeForwarder<RemixCoreNativeActionRequest>(
    subscriptions,
    "nativeActionRequested",
    (listener) => RemixCore.addListener("nativeActionRequested", listener),
    (request) => void executeRequestedWebAction(actions, request),
  );

  return {
    status,
    keyboard,
    mqtt: createMqttContext(actions),
  };
}

async function executeRequestedWebAction(
  actions: ProjectActionClient,
  request: RemixCoreNativeActionRequest,
): Promise<void> {
  let status: "completed" | "failed" = "completed";
  let message: string | undefined;

  try {
    await actions.executeWeb(request.type, request.args);
  } catch (error) {
    status = "failed";
    message = error instanceof Error ? error.message : String(error);
  }

  try {
    await RemixCore.completeWebAction({
      requestId: request.requestId,
      status,
      ...(message === undefined ? {} : { error: message }),
    });
  } catch (error) {
    reportNativeEventError("native action completion", error);
  }
}

function createMqttStatusSource(subscriptions: SubscriptionScope) {
  return {
    on(listener: (status: RemixMqttStatus) => void): RemixEventUnsubscribe {
      const revisions = new Map<string, number>();
      const emit = (status: RemixCoreMqttStatus) => {
        if (status.revision <= (revisions.get(status.connection) ?? -1)) {
          return;
        }

        revisions.set(status.connection, status.revision);
        listener(toMqttStatus(status));
      };
      const subscription = subscribeToNativeEvent<RemixCoreMqttStatus>(
        subscriptions,
        (nativeListener) => RemixCore.addListener("mqtt:status", nativeListener),
        emit,
      );

      void subscription.ready
        .then(() => RemixCore.getMqttStatuses())
        .then(({ statuses }) => statuses.forEach(emit))
        .catch((error: unknown) =>
          reportNativeEventError("mqtt:status initialization", error),
        );

      return subscription.unsubscribe;
    },
  };
}

function createMqttMessageSource(subscriptions: SubscriptionScope) {
  return {
    on(listener: (message: RemixMqttMessage) => void): RemixEventUnsubscribe {
      const subscription = subscribeToNativeEvent<RemixCoreMqttMessageEvent>(
        subscriptions,
        (nativeListener) => RemixCore.addListener("mqtt:message", nativeListener),
        (message) => listener(toMqttMessage(message)),
      );
      void subscription.ready.catch((error: unknown) =>
        reportNativeEventError("mqtt:message", error),
      );
      return subscription.unsubscribe;
    },
  };
}

async function registerNativeForwarder<T>(
  subscriptions: SubscriptionScope,
  eventName: string,
  listen: NativeListen<T>,
  listener: (event: T) => void,
): Promise<void> {
  try {
    const handle = await listen(listener);
    subscriptions.add(() => handle.remove());
  } catch (error) {
    reportNativeEventError(eventName, error);
    throw error;
  }
}

function subscribeToNativeEvent<T>(
  subscriptions: SubscriptionScope,
  listen: NativeListen<T>,
  listener: (event: T) => void,
): NativeEventSubscription {
  let active = true;
  const handle = listen((event) => {
    if (active) {
      listener(event);
    }
  });

  const unsubscribe = subscriptions.add(async () => {
    active = false;
    await (await handle.catch(() => undefined))?.remove();
  });

  return {
    ready: handle.then(() => undefined),
    unsubscribe,
  };
}

interface NativeEventSubscription {
  ready: Promise<void>;
  unsubscribe: RemixEventUnsubscribe;
}

type NativeListen<T> = (
  listener: (event: T) => void,
) => Promise<{ remove(): Promise<void> }>;

function toMqttMessage(message: RemixCoreMqttMessageEvent): RemixMqttMessage {
  return {
    connection: message.connection,
    topic: message.topic,
    payload: decodeBase64(message.payloadBase64),
    qos: message.qos,
    retained: message.retained,
    duplicate: message.duplicate,
    receivedAt: message.receivedAt,
  };
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function reportNativeEventError(eventName: string, error: unknown): void {
  console.error(`Failed to subscribe to native event ${eventName}`, error);
}
