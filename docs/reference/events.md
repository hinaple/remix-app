# 이벤트와 상태

프로젝트는 `context.events`를 통해 Host가 전달하는 기기 상태 변화, hardware key, lifecycle과 MQTT event를 구독합니다. 현재 상태를 한 번 읽는 작업과 이후 변화를 받는 작업을 구분해서 사용하세요.

## 현재 상태 읽기

상태 channel의 `get()`은 호출 시점의 값을 한 번 반환합니다.

```ts
const [battery, network, screen, keyboard] = await Promise.all([
  context.device.status.battery.get(),
  context.device.status.network.get(),
  context.device.status.screen.get(),
  context.device.keyboard.get(),
]);
```

초기 UI를 먼저 채우고 이후 변화를 반영할 때 유용합니다.

```ts
const battery = await context.device.status.battery.get();
renderBattery(battery);

context.events.on("device:status:battery", renderBattery);
```

`get()`과 event 등록 사이에 아주 짧은 상태 변화가 발생할 수 있습니다. 모든 중간 상태를 빠짐없이 처리해야 하는 protocol에는 상태 snapshot만 의존하지 말고 별도의 sequence 또는 application-level 동기화 방식을 설계하세요.

## 이벤트 구독

```ts
context.events.on("device:key", (event) => {
  console.log(event.key, event.action);
});
```

`on()`은 해당 listener만 해제하는 함수를 반환합니다.

```ts
const stop = context.events.on("device:key", handleKey);

// 프로젝트 실행 도중 이 단계의 입력만 먼저 종료할 때
stop();
```

프로젝트가 실행되는 동안 계속 필요한 구독은 명시적으로 해제하지 않아도 됩니다. `context.events` 구독은 Host의 project subscription scope에 들어가며 unmount, reset 또는 project 교체 시 자동으로 정리됩니다.

context 밖에서 직접 만든 listener와 외부 구독은 자동 정리되지 않습니다.

```ts
export const mount: RemixAppMount = () => {
  const onVisibility = () => console.log(document.visibilityState);
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
  };
};
```

## 지원 이벤트

| 이벤트 | payload | 발생 원천 |
| --- | --- | --- |
| `device:key` | `RemixKeyEvent` | Host가 capture한 hardware key |
| `device:status:battery` | `RemixBatteryStatus` | Android 배터리 상태 |
| `device:status:network` | `RemixNetworkStatus` | 연결 및 network transport |
| `device:status:screen` | `RemixScreenStatus` | interactive, 밝기, timeout, 방향 |
| `device:status:keyboard` | `RemixKeyboardStatus` | soft keyboard 표시와 높이 |
| `project:lifecycle` | `RemixLifecycleEvent` | mount 및 Android Activity lifecycle |
| `mqtt:status` | `RemixMqttStatus` | native MQTT 연결 상태 |
| `mqtt:message` | `RemixMqttMessage` | config에 선언한 subscription 메시지 |

## device:key

```ts
interface RemixKeyEvent {
  key: "BACK" | "VOLUME_UP" | "VOLUME_DOWN" | "POWER" | "HOME" | "MENU";
  action: "down" | "up";
}
```

project config의 `input.capturedKeys` 또는 runtime의 `context.device.input.captureKeys()`로 요청한 key를 받습니다.

```ts
context.events.on("device:key", ({ key, action }) => {
  if (key === "VOLUME_UP" && action === "down") {
    goToNextScene();
  }
});
```

Host 관리 기능을 위해 volume key가 내부적으로 capture될 수 있습니다. 프로젝트에서는 필요한 key와 action을 모두 검사하고 다른 입력을 무시하세요.

## 배터리 상태

```ts
interface RemixBatteryStatus {
  level: number;
  charging: boolean;
}
```

`level`은 `0`부터 `1`입니다.

```ts
context.events.on("device:status:battery", ({ level, charging }) => {
  batteryText.textContent = `${Math.round(level * 100)}%`;
  batteryText.dataset.charging = String(charging);
});
```

## network 상태

```ts
interface RemixNetworkStatus {
  connected: boolean;
  type: "wifi" | "cellular" | "ethernet" | "none" | "unknown";
}
```

`connected`는 사용할 수 있는 network의 존재를 나타내는 best-effort 상태입니다. 특정 broker 또는 server에 실제로 연결할 수 있다는 보장은 아니므로 서비스 연결 상태와 구분합니다.

## screen 상태

```ts
interface RemixScreenStatus {
  interactive: boolean;
  keepOn: boolean;
  autoBrightness: boolean;
  brightness?: number;
  timeout?: number;
  orientation: RemixScreenOrientation;
}
```

일부 기기에서 brightness나 timeout을 읽을 수 없으면 해당 필드가 생략될 수 있습니다. 설정 요청 직후에도 Android policy가 값을 보정할 수 있으므로 event 또는 새 `get()` 결과를 실제 상태로 사용합니다.

## keyboard 상태

```ts
interface RemixKeyboardStatus {
  visible: boolean;
  height: number;
}
```

`height`는 CSS pixel입니다. keyboard가 닫히면 일반적으로 `0`입니다. `screen.keyboard.adjust` 정책과 함께 사용하여 프로젝트 UI가 Host layout 보정을 중복 적용하지 않도록 주의하세요.

## project lifecycle

```ts
interface RemixLifecycleEvent {
  state: "mounted" | "paused" | "resumed" | "destroyed";
}
```

| 상태 | 의미 |
| --- | --- |
| `mounted` | project `mount()`가 성공하고 Host가 runtime을 활성화했습니다. |
| `paused` | Android Activity가 pause되었습니다. |
| `resumed` | Android Activity가 resume되었습니다. |
| `destroyed` | project가 reset, 교체 또는 stop되기 직전입니다. |

`destroyed`는 project cleanup보다 먼저 emit됩니다. 그 뒤 cleanup과 context subscription 정리가 진행됩니다. 영속 상태 저장이 필요하다면 `destroyed` 하나에만 의존하지 말고 중요한 변경 시점에 저장하는 편이 안전합니다.

브라우저 개발 Host의 lifecycle simulation은 실제 Android Activity 전환과 완전히 같지 않습니다.

## MQTT 이벤트

`mqtt:status`는 `connecting`, `connected`, `reconnecting`, `disconnected` 상태를 전달합니다. `mqtt:message`의 payload는 `Uint8Array`입니다.

```ts
const decoder = new TextDecoder();

context.events.on("mqtt:message", (message) => {
  console.log(message.topic, decoder.decode(message.payload));
});
```

메시지는 JavaScript listener가 없는 동안 나중 전달을 위해 저장되지 않습니다. WebView가 inactive인 동안 반드시 처리해야 하는 메시지는 [nativeEvents](native-events.md) 규칙이나 application-level retained/state protocol을 검토하세요.

## listener 오류 처리

event callback에서 시작한 비동기 작업은 명시적으로 오류를 처리합니다.

```ts
context.events.on("device:key", (event) => {
  if (event.action !== "down") return;

  void handleKey(event).catch((error) => {
    console.error("Failed to handle key", error);
  });
});
```

한 listener의 비동기 작업 완료를 Host event dispatch가 기다린다고 가정하지 마세요. 연속 event의 순서가 중요하면 프로젝트 안에서 queue를 관리합니다.

## 관련 문서

- [RemixAppContext](context.md)
- [기기 제어](../guides/device-control.md)
- [MQTT](mqtt.md)
- [nativeEvents](native-events.md)
- [lifecycle](../concepts/lifecycle.md)
