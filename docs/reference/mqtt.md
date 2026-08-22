# MQTT

remixApp의 MQTT 연결과 고정 subscription은 Android native foreground runtime이 소유합니다. 프로젝트는 `remix.config.ts`에 연결을 선언하고, `context.mqtt`로 상태를 읽거나 메시지를 publish하며, `context.events`로 상태와 수신 메시지를 받습니다.

## 연결 선언

```ts
import { defineConfig } from "@remixapp/sdk/config";

export default defineConfig({
  name: "airport-room",
  version: "0.1.0",
  entry: "src/index.ts",
  mqtt: {
    connections: {
      primary: {
        url: "mqtts://broker.example.com:8883",
        username: "device-user",
        password: "device-password",
        subscriptions: [
          { filter: "rooms/airport/commands", qos: 1 },
          { filter: "rooms/airport/scenes/+", qos: 0 },
        ],
      },
    },
  },
});
```

연결 이름 `primary`는 project code에서 사용하는 식별자입니다. 영문자, 숫자, `_`, `-`만 사용할 수 있습니다.

## 연결 옵션

| 필드 | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `url` | `string` | 필수 | `mqtt://host[:port]` 또는 `mqtts://host[:port]` |
| `clientId` | `string` | Host 생성 | broker client ID |
| `username` | `string` | 없음 | broker username |
| `password` | `string` | 없음 | username과 함께 사용하는 password |
| `keepAliveSeconds` | `number` | `30` | `0..65535` 정수 |
| `cleanSession` | `boolean` | `true` | MQTT clean session |
| `reconnect` | `boolean` | `true` | 연결 손실 시 재연결 |
| `subscriptions` | array | `[]` | 연결될 때 적용할 고정 topic filters |

초기 구현은 MQTT 3.1.1을 사용합니다. `mqtt://`는 TCP, `mqtts://`는 Android system trust store를 사용하는 TLS 연결로 변환됩니다. URL에는 path, query, fragment 또는 user info를 넣지 않고 자격증명은 별도 필드를 사용합니다.

`clientId`를 생략하면 Host가 Android ID, project name과 connection name을 기반으로 안정적인 ID를 생성합니다.

> MQTT 자격증명은 build된 `project.json`에 평문 설정으로 포함됩니다. `.remixprj`를 읽을 수 있는 사용자를 막는 secret storage가 아니며, 고가치 장기 secret을 보호하는 수단으로 사용하면 안 됩니다.

## topic subscription

```ts
subscriptions: [
  { filter: "rooms/+/commands", qos: 1 },
  { filter: "broadcast/#", qos: 0 },
]
```

- `+`는 하나의 topic level 전체로만 사용합니다.
- `#`는 마지막 level 전체로만 사용합니다.
- 같은 connection에 동일 filter를 중복 선언할 수 없습니다.
- QoS는 `0`, `1`, `2` 중 하나이며 기본값은 `0`입니다.

native client는 연결 또는 재연결 성공 후 선언된 filter를 subscribe합니다. runtime JavaScript에서 connection을 추가하거나 subscription 목록을 바꾸는 API는 없습니다.

## 현재 연결 상태 읽기

```ts
const status = await context.mqtt.getStatus("primary");

console.log(status.connection);
console.log(status.state);
console.log(status.reason);
```

상태는 다음 중 하나입니다.

| 상태 | 의미 |
| --- | --- |
| `connecting` | 초기 연결 시도 중 |
| `connected` | broker 연결 완료 |
| `reconnecting` | 연결 손실 후 재연결 중 |
| `disconnected` | 연결되지 않았고 현재 재연결 중이 아님 |

`reason`에는 연결 또는 subscription 실패 원인이 best-effort 문자열로 들어갈 수 있습니다. `connected`이면서 `reason`이 있으면 broker 연결은 되었지만 configured subscription 중 문제가 발생했을 가능성이 있습니다.

알 수 없는 connection 이름을 전달하면 호출이 실패합니다.

## 상태 변화 구독

```ts
context.events.on("mqtt:status", (status) => {
  if (status.connection !== "primary") return;

  connectionBadge.textContent = status.state;
  connectionBadge.title = status.reason ?? "";
});
```

Android Host는 subscription이 준비된 뒤 현재 connection status도 읽어 전달하므로 초기 상태 표시에는 `getStatus()` 또는 status event를 사용할 수 있습니다. 명확한 초기 rendering이 필요하면 `getStatus()`로 먼저 그리고 event로 갱신하는 패턴이 읽기 쉽습니다.

context event 구독은 project unmount 시 자동 해제됩니다.

## publish

문자열 payload:

```ts
await context.mqtt.publish(
  "primary",
  "rooms/airport/state",
  JSON.stringify({ scene: "lobby", ready: true }),
  { qos: 1, retain: true },
);
```

binary payload:

```ts
const payload = new Uint8Array([0x01, 0x02, 0x03]);
await context.mqtt.publish("primary", "rooms/airport/binary", payload);
```

publish option의 기본값은 `qos: 0`, `retain: false`입니다. topic은 비어 있을 수 없고 wildcard `+`, `#`를 포함할 수 없습니다. 연결이 `connected`가 아니거나 broker publish가 실패하면 Promise가 reject됩니다.

event handler에서 publish할 때는 오류를 처리합니다.

```ts
context.events.on("device:key", ({ key, action }) => {
  if (key !== "VOLUME_UP" || action !== "down") return;

  void context.mqtt
    .publish("primary", "rooms/airport/input", "next")
    .catch((error) => console.error("MQTT publish failed", error));
});
```

## 메시지 수신

```ts
const decoder = new TextDecoder();

context.events.on("mqtt:message", (message) => {
  if (message.connection !== "primary") return;

  const text = decoder.decode(message.payload);
  console.log({
    topic: message.topic,
    text,
    qos: message.qos,
    retained: message.retained,
    duplicate: message.duplicate,
    receivedAt: new Date(message.receivedAt),
  });
});
```

`payload`는 항상 `Uint8Array`입니다. text/JSON인지 여부는 project protocol이 결정합니다. 잘못된 payload 하나가 listener 전체를 깨뜨리지 않도록 decoding과 parsing 오류를 분리합니다.

```ts
function parseJson(payload: Uint8Array): unknown {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(payload);
  return JSON.parse(text);
}
```

JavaScript listener가 없는 동안 수신한 메시지는 나중 전달을 위해 buffer하지 않습니다. 중요한 최신 상태에는 retained message나 별도 snapshot topic을 사용하고, Activity가 inactive인 동안 즉시 action이 필요하면 [nativeEvents](native-events.md)를 사용합니다.

## Activity와 연결 수명

MQTT client는 Android foreground runtime이 소유하므로 WebView의 pause/resume과 분리되어 있습니다. Activity가 inactive여도 native connection과 configured subscription은 유지될 수 있습니다.

다만 project JavaScript listener는 inactive 상태에서 메시지 처리를 보장하는 background worker가 아닙니다. inactive event 대응은 native event rule 또는 broker 측 상태 설계로 처리합니다.

## 브라우저 개발 Host

브라우저 개발 Host는 실제 broker에 연결하지 않습니다.

- `getStatus()`는 `disconnected`와 `MQTT is only available in the Android Host` reason을 반환합니다.
- `publish()`는 Android Host에서만 사용할 수 있다는 오류로 reject됩니다.
- 실제 TLS, 인증, reconnect, subscription과 message payload는 Android 기기에서 검증해야 합니다.

UI 로직을 browser에서 테스트하려면 MQTT payload를 처리하는 순수 함수를 분리하여 직접 호출하거나 test fixture를 사용하세요.

## 문제 해결

### 계속 reconnecting 상태

- broker host와 port가 기기 network에서 접근 가능한지 확인합니다.
- `mqtt://`와 `mqtts://` scheme이 broker listener와 맞는지 확인합니다.
- Android system time과 TLS certificate 유효 기간을 확인합니다.
- `reason`과 native logcat을 함께 확인합니다.

### 연결은 되었지만 메시지가 없음

- filter wildcard와 topic level을 확인합니다.
- status의 `reason`에 subscription failure가 있는지 확인합니다.
- listener 등록 전에 도착한 message는 buffer되지 않는 점을 확인합니다.
- broker ACL이 해당 subscription을 허용하는지 확인합니다.

### publish가 실패함

- `getStatus()`가 `connected`인지 확인합니다.
- connection 이름과 publish topic을 확인합니다.
- `+`, `#`는 publish topic에 사용할 수 없습니다.
- Promise rejection message와 broker ACL을 확인합니다.

## 관련 문서

- [프로젝트 설정](configuration.md)
- [이벤트와 상태](events.md)
- [nativeEvents](native-events.md)
- [문제 해결](../guides/troubleshooting.md)
