# RemixAppContext

`RemixAppContext`는 프로젝트가 Host와 Android 기기 기능을 사용하는 공개 진입점입니다. Host가 프로젝트의 `mount(container, context)`에 전달합니다.

```ts
import type { RemixAppMount } from "@remixapp/sdk";

export const mount: RemixAppMount = async (container, context) => {
  await context.device.screen.wake();
};
```

프로젝트에서는 Capacitor plugin이나 `@remixapp/core`를 직접 사용하지 않고 이 context만 사용합니다.

## API 영역

| 영역 | 용도 |
| --- | --- |
| `context.project` | 현재 프로젝트 metadata, manifest, reset |
| `context.constants` | Host가 결정한 현재 기기의 Constant 값 |
| `context.resources` | `.remixprj`의 `resources/` URL 생성 |
| `context.device` | 화면, 상태, 입력, 오디오, 진동 |
| `context.events` | 기기 상태, key, lifecycle, MQTT event 구독 |
| `context.mqtt` | manifest에 선언된 MQTT 상태 확인과 publish |
| `context.host` | Host admin panel에 프로젝트별 control 표시 |

## project

```ts
console.log(context.project.name);
console.log(context.project.version);
console.log(context.project.manifest.runtimeApiVersion);

await context.project.reset();
```

`reset()`은 Host APK를 종료하지 않고 현재 프로젝트만 정리한 뒤 다시 mount합니다. reset 호출 뒤에는 기존 DOM이나 비동기 작업이 계속 유효하다고 가정하지 마세요.

## constants

`context.constants`는 Host가 기기 override와 프로젝트 default를 합쳐 결정한 읽기 전용 문자열 객체입니다.

```ts
console.log(context.constants.deviceId);
console.log(context.constants.brokerHost);
```

기기 override가 default보다 우선합니다. 둘 다 없는 optional Constant는 객체에 포함되지 않습니다. 프로젝트 코드는 이 객체를 변경하거나 저장할 수 없으며 값 변경은 Host admin UI에서 수행합니다.

선언, required 시작 조건, `{{Constants.id}}` 치환과 dev 환경 제한은 [Constants 레퍼런스](constants.md)를 참고하세요.

## resources

`resources/`를 기준으로 한 path를 WebView에서 사용할 수 있는 URL로 변환합니다.

```ts
const video = document.createElement("video");
video.src = context.resources.url("video/intro.mp4");
```

인자는 프로젝트 package의 `resources/` 아래 상대 경로입니다. source에서 import하여 Vite가 번들링한 asset에는 이 API를 사용하지 않습니다.

## device.screen

| 메서드 | 설명 |
| --- | --- |
| `wake()` | 화면을 깨우거나 interactive 상태로 전환하도록 요청합니다. |
| `setKeepOn(enabled)` | runtime의 화면 켜짐 유지 상태를 바꿉니다. |
| `setAutoBrightness(enabled)` | Android 자동 밝기를 켜거나 끕니다. |
| `setBrightness(value)` | 앱 화면 밝기를 `0`부터 `1` 사이 값으로 설정합니다. |
| `setOrientation(orientation)` | 실행 중 화면 방향 정책을 바꿉니다. |
| `setTimeout(ms | undefined)` | 화면 꺼짐 시간을 설정하거나 가능한 경우 이전 값 복원을 요청합니다. |

Host와 기기 정책은 입력값을 보정하거나 지원하지 않는 요청을 무시할 수 있습니다.

```ts
await context.device.screen.setAutoBrightness(false);
await context.device.screen.setBrightness(0.35);
await context.device.screen.setOrientation("landscape");
```

## 기기 상태

현재 상태는 `get()`으로 읽습니다.

```ts
const [battery, network, screen, keyboard] = await Promise.all([
  context.device.status.battery.get(),
  context.device.status.network.get(),
  context.device.status.screen.get(),
  context.device.keyboard.get(),
]);
```

상태 변화는 `context.events`에서 구독합니다.

```ts
context.events.on("device:status:network", (network) => {
  console.log(network.connected, network.type);
});
```

상태 payload는 다음 정보를 제공합니다.

| 상태 | 주요 필드 |
| --- | --- |
| battery | `level`, `charging` |
| network | `connected`, `type` |
| screen | `interactive`, `keepOn`, `autoBrightness`, `brightness`, `timeout`, `orientation` |
| keyboard | `visible`, `height` |

## device.input

```ts
await context.device.input.captureBack(true);
await context.device.input.captureKeys(["VOLUME_UP", "VOLUME_DOWN"]);
```

실행 중 captured key 목록을 교체합니다. 전달된 key event는 `context.events.on("device:key", ...)`으로 받습니다.

## device.audio와 device.vibration

```ts
const volume = await context.device.audio.getVolume();
await context.device.audio.setVolume(Math.min(1, volume + 0.1));

await context.device.vibration.trigger(180);
await context.device.vibration.trigger(180, 0.5);

await context.device.vibration.play({
  kind: "pattern",
  segments: [
    { duration: 100, intensity: 1 },
    { duration: 50, intensity: 0 },
    { duration: 100, intensity: 0.5 },
  ],
  repeat: true,
});

await context.device.vibration.stop();
```

미디어 볼륨과 진동 intensity는 `0`부터 `1` 사이입니다. `oneShot` intensity는 0보다 커야 하며 pattern에서는 `0`이 정지 구간입니다. intensity는 생략하면 `1`입니다. 진동 duration의 단위는 ms이며 1 이상의 정수여야 합니다.

`trigger(duration, intensity?)`는 단발 진동을 재생합니다. `play()`는 `oneShot`, `pattern`, `preset` 효과를 재생하며 `stop()`은 현재 진동을 중단합니다. 자세한 사용법은 [기기 제어](../guides/device-control.md)를 참고하세요.

## events

지원하는 event는 다음과 같습니다.

| event | payload |
| --- | --- |
| `device:key` | captured key와 `down`/`up` action |
| `device:status:battery` | 배터리 잔량과 충전 상태 |
| `device:status:network` | 연결 여부와 network type |
| `device:status:screen` | 화면과 밝기 정책 상태 |
| `device:status:keyboard` | soft keyboard 표시 여부와 높이 |
| `project:lifecycle` | `mounted`, `paused`, `resumed`, `destroyed` |
| `mqtt:status` | MQTT 연결 상태 변화 |
| `mqtt:message` | 고정 subscription에서 수신한 메시지 |

```ts
context.events.on("device:key", ({ key, action }) => {
  if (key === "VOLUME_UP" && action === "down") {
    console.log("next scene");
  }
});
```

### 구독 수명

`context.events.on()`으로 만든 구독은 프로젝트 runtime의 subscription scope에 등록됩니다. Host는 프로젝트 unmount 시 이 scope를 자동으로 정리합니다. 프로젝트가 실행되는 동안 계속 필요한 이벤트 및 상태 변화 구독은 명시적으로 unsubscribe할 필요가 없습니다.

실행 중 특정 화면이나 단계가 끝났을 때 구독을 먼저 중단하려면 반환 함수를 사용합니다.

```ts
const stopWaiting = context.events.on("device:key", handleAnswerKey);

function closeAnswerStep() {
  stopWaiting();
}
```

자동 정리 범위는 context가 소유하는 구독에 한정됩니다. 다음 자원은 `mount`가 반환하는 cleanup에서 프로젝트가 직접 정리해야 합니다.

- `window` 또는 `document`에 직접 등록한 event listener
- `setInterval`, 장시간 `setTimeout`, animation loop
- 직접 생성한 WebSocket, EventSource, MQTT client
- 외부 라이브러리 store 또는 event emitter 구독
- 프로젝트가 획득한 기타 외부 resource

```ts
export const mount: RemixAppMount = () => {
  const controller = new AbortController();
  const timer = window.setInterval(refreshClock, 1000);

  window.addEventListener("resize", layout, { signal: controller.signal });

  return () => {
    controller.abort();
    window.clearInterval(timer);
  };
};
```

## mqtt

연결은 `remix.config.ts`에서 미리 선언합니다. runtime에서는 상태를 읽고 publish할 수 있지만 연결 설정이나 topic subscription을 바꿀 수 없습니다.

```ts
const status = await context.mqtt.getStatus("primary");

await context.mqtt.publish("primary", "room/state", "ready", {
  qos: 1,
  retain: true,
});

context.events.on("mqtt:message", (message) => {
  console.log(message.connection, message.topic, message.payload);
});
```

`payload`는 publish할 때 `string | Uint8Array`, 수신 event에서는 `Uint8Array`입니다.

## host.panel

Host admin panel에 프로젝트 전용 버튼과 상태 row를 표시합니다.

```ts
context.host.panel.status.set([
  { id: "scene", label: "Scene", text: "Lobby" },
]);

context.host.panel.buttons.set([
  {
    label: "Reset project",
    action: () => context.project.reset(),
  },
]);

context.host.panel.status.setText("scene", "Airport");
```

`set()`은 기존 프로젝트 소유 목록을 교체합니다. `remove(id)`와 `clear()`로 상태 row를 지울 수 있고, button group은 `clear()`로 지웁니다. Host는 프로젝트 종료 시 프로젝트 소유 panel 내용을 정리합니다.

## 관련 문서

- [아키텍처](../concepts/architecture.md)
- [프로젝트 설정](configuration.md)
- [Constants](constants.md)
- [이벤트와 상태](events.md)
- [MQTT](mqtt.md)
- [기기 제어](../guides/device-control.md)
- [Host panel](../guides/host-panel.md)
- [CLI](cli.md)
