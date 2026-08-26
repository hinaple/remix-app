# nativeEvents

`nativeEvents`는 Host event를 native runtime에서 평가하고 미리 선언한 action을 실행합니다. rule별 `activityState`로 Android Activity가 inactive이거나 resumed인 환경을 선택할 수 있습니다. WebView JavaScript event handler와 별도로 실행되므로 같은 event를 양쪽에 등록하면 action이 중복 실행될 수 있습니다.

## 언제 사용하는가

적합한 예:

- Activity가 pause된 동안 낮은 배터리를 감지해 화면을 깨우고 진동
- MQTT command를 수신하면 native screen 또는 audio action 실행
- resume 후 Host panel의 상태 text 갱신

적합하지 않은 예:

- 복잡한 scene 상태 전환
- runtime에서 동적으로 rule 추가/삭제
- callback을 포함하는 UI button 구성
- 임의 JavaScript 실행

`activityState`의 기본값은 `always`입니다. inactive 상태에서만 필요한 background action은 rule에 `activityState: "inactive"`를 명시합니다.

## 기본 예제

```ts
import { defineConfig } from "@remixapp/sdk/config";

export default defineConfig({
  name: "airport-room",
  version: "0.1.0",
  entry: "src/index.ts",
  nativeEvents: {
    rules: [
      {
        on: "device:status:battery",
        activityState: "inactive",
        when: {
          level: { lte: 0.15 },
          charging: false,
        },
        actions: [
          { type: "device.screen.wake" },
          {
            type: "device.vibration.trigger",
            args: { duration: 500 },
          },
          {
            type: "host.panel.status.setText",
            args: { id: "battery", text: "Low battery" },
          },
        ],
        expiresIn: 10000,
      },
    ],
  },
});
```

## rule 구조

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| `on` | 예 | 평가할 event 이름 |
| `activityState` | 아니요 | `inactive`, `resumed`, `always`. 기본 `always` |
| `when` | 아니요 | event payload 조건. 생략하면 해당 event에 항상 일치 |
| `actions` | 예 | 순서대로 실행할 하나 이상의 action |
| `expiresIn` | 아니요 | sequence가 완료되어야 하는 시간. 기본 `10000`ms |

지원하는 `on` 값:

```text
device:key
device:status:battery
device:status:network
device:status:screen
device:status:keyboard
project:lifecycle
mqtt:status
mqtt:message
```

engine은 각 rule의 `activityState`와 현재 Activity lifecycle을 비교합니다.

- `inactive`: Activity가 pause된 동안만 평가
- `resumed`: Activity가 resumed된 동안만 평가
- `always`: 두 상태에서 모두 평가하며 기본값

`project:lifecycle` rule에도 같은 기준이 적용됩니다. `paused` event는 `inactive` 또는 `always` rule과 일치하고, `resumed` event는 `resumed` 또는 `always` rule과 일치합니다. project stop 시 pending session은 정리됩니다.

## when matcher

`when`의 key는 event payload의 dot path입니다.

```ts
when: {
  "connection": "primary",
  "state": { in: ["disconnected", "reconnecting"] },
}
```

직접 primitive 값을 작성하면 동일성 비교입니다.

```ts
when: {
  charging: false,
}
```

지원 matcher:

| matcher | 의미 | expected 값 |
| --- | --- | --- |
| `eq` | 같음 | primitive |
| `ne` | 다름 | primitive |
| `gt`, `gte` | 큼, 크거나 같음 | number |
| `lt`, `lte` | 작음, 작거나 같음 | number |
| `in` | 배열에 포함 | primitive array |
| `contains` | 문자열 포함 | string |
| `exists` | path 존재 여부 | boolean |

하나의 matcher object에 여러 연산자를 쓰면 모두 만족해야 합니다. `when`의 여러 path도 모두 만족해야 rule이 실행됩니다.

MQTT message처럼 중첩 payload를 project protocol에서 JSON으로 사용하는 경우에도 `mqtt:message.payload`는 binary/base64 전송 경계이므로 arbitrary JSON field가 자동으로 dot path에 풀리지 않습니다. native matcher는 실제 event payload 구조만 비교합니다.

## action 실행 위치

각 action은 SDK의 공통 action registry에서 `native` 또는 `webview` executor로 분류됩니다.

### native action

Activity가 inactive여도 즉시 실행할 수 있습니다.

- `device.screen.wake`
- `device.screen.setKeepOn`
- `device.screen.setAutoBrightness`
- `device.screen.setBrightness`
- `device.screen.setOrientation`
- `device.screen.setTimeout`
- `device.input.captureBack`
- `device.input.captureKeys`
- `device.audio.setVolume`
- `device.vibration.trigger`
- `mqtt.publish`

### WebView action

Activity가 resume될 때까지 기다린 뒤 JavaScript Host handler에서 실행합니다.

- `project.reset`
- `host.panel.buttons.clear`
- `host.panel.status.set`
- `host.panel.status.setText`
- `host.panel.status.remove`
- `host.panel.status.clear`

`host.panel.buttons.set`은 callback 함수를 포함하므로 JSON으로 직렬화할 수 없어 nativeEvents에서 사용할 수 없습니다.

## action 순서와 wake 패턴

각 rule의 action은 작성 순서대로 실행됩니다. WebView action 앞에서 sequence가 멈추면 Activity가 resume될 때까지 뒤 action도 진행하지 않습니다.

화면을 깨운 뒤 WebView action을 실행하려면 wake를 먼저 둡니다.

```ts
actions: [
  { type: "device.screen.wake" },
  {
    type: "host.panel.status.setText",
    args: { id: "mqtt", text: "Command received" },
  },
]
```

## expiresIn

`expiresIn`은 event가 rule에 일치한 시점부터 전체 action sequence에 적용됩니다.

- native action은 inactive 상태에서도 실행할 수 있습니다.
- WebView action을 기다리는 동안 만료되면 해당 sequence는 폐기됩니다.
- project reset 또는 교체로 session이 바뀌면 pending sequence도 폐기됩니다.
- 값은 1 이상의 정수 ms이며 기본값은 `10000`입니다.

너무 짧은 값은 Activity resume 전에 WebView action을 잃게 하고, 너무 긴 값은 오래된 event가 뒤늦게 UI에 반영될 수 있습니다. event의 유효 기간을 기준으로 정합니다.

## MQTT command 예제

```ts
nativeEvents: {
  rules: [
    {
      on: "mqtt:message",
      when: {
        connection: "primary",
        topic: "rooms/airport/wake",
      },
      actions: [
        { type: "device.screen.wake" },
        {
          type: "device.audio.setVolume",
          args: { volume: 0.8 },
        },
      ],
      expiresIn: 5000,
    },
  ],
}
```

topic과 connection처럼 event metadata는 matcher로 비교할 수 있습니다. binary payload를 native rule에서 application JSON처럼 parsing하지는 않습니다. command 종류는 topic 구조로 분리하는 편이 단순합니다.

## config 검증

CLI build 단계에서 다음 오류를 검사합니다.

- 지원하지 않는 event 이름
- 비어 있는 actions
- 알 수 없는 action type
- nativeEvents에서 허용하지 않는 action
- action별 잘못된 args
- 비어 있거나 잘못된 matcher
- 1보다 작은 `expiresIn`

config가 typecheck를 통과해도 동적으로 생성한 object나 JavaScript config는 runtime validation에서 실패할 수 있습니다. `remix-cli build --unpack`으로 정규화된 `project.json`을 확인할 수 있습니다.

## browser 개발 Host

browser dev runtime은 action contract와 일부 기기 동작을 simulation하지만 Android Activity inactive engine 자체를 동일하게 재현하지 않습니다. 다음 항목은 실제 Android에서 확인합니다.

- `inactive`, `resumed`, `always` rule이 각 Activity 상태에서 발생하는지
- native action의 즉시 실행
- WebView action의 resume 대기
- `expiresIn` 만료
- MQTT foreground 수신

## 관련 문서

- [프로젝트 설정](configuration.md)
- [이벤트와 상태](events.md)
- [MQTT](mqtt.md)
- [lifecycle](../concepts/lifecycle.md)
- [문제 해결](../guides/troubleshooting.md)
