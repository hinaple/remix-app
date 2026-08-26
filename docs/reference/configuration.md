# 프로젝트 설정

`remix.config.ts` 또는 `remix.config.js`는 프로젝트의 source config입니다. CLI가 개발 서버와 빌드 시 이 파일을 읽고, Android Host가 사용하는 `project.json`으로 정규화합니다.

## 기본 예제

```ts
import { defineConfig } from "@remixapp/sdk/config";

export default defineConfig({
  name: "airport-room",
  version: "0.1.0",
  entry: "src/index.ts",
  styles: ["src/style.css"],
  kiosk: true,
  screen: {
    keepOn: true,
    immersive: true,
    hideSystemBars: true,
    orientation: "portrait",
    timeout: 30000,
    keyboard: {
      adjust: "resize",
      nativeAdjust: false,
      state: "hidden",
    },
  },
  input: {
    capturedKeys: ["VOLUME_UP", "VOLUME_DOWN"],
    captureBack: true,
  },
});
```

`defineConfig`는 TypeScript 추론을 제공하며 값을 런타임에서 변환하지는 않습니다.

## 최상위 필드

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `name` | `string` | 예 | manifest의 프로젝트 이름과 출력 파일명에 사용합니다. |
| `version` | `string` | 예 | semantic version이며 manifest와 출력 파일명에 사용합니다. |
| `entry` | `string` | 예 | 프로젝트 루트 기준 entry module 경로입니다. |
| `styles` | `string[]` | 아니요 | 프로젝트 루트 기준 CSS 경로입니다. 작성 순서를 보존합니다. |
| `kiosk` | `boolean` | 아니요 | 시작 시 Host에 kiosk 동작을 요청합니다. |
| `screen` | `object` | 아니요 | 시작 시 적용할 화면 및 soft keyboard 정책입니다. |
| `input` | `object` | 아니요 | hardware key와 Android back key 정책입니다. |
| `mqtt` | `object` | 아니요 | native runtime이 소유할 고정 MQTT 연결과 구독입니다. |
| `nativeEvents` | `object` | 아니요 | Activity 상태에 따라 평가할 event-action 규칙입니다. |
| `vite` | Vite config | 아니요 | 프로젝트별 Vite 설정입니다. |

`entry`와 `styles`는 절대 경로가 아닌 프로젝트 상대 경로여야 합니다. `styles`에 명시한 파일이 없으면 빌드가 실패합니다.

현재 Android Host는 `kiosk`를 생략하면 활성화 요청으로, `input.captureBack`을 생략하면 back capture 활성화 요청으로 처리합니다. 의도를 분명히 하고 Host version 차이의 영향을 줄이려면 project config에 두 값을 명시하는 것을 권장합니다.

## screen

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `keepOn` | `boolean` | 프로젝트 실행 중 화면을 켜진 상태로 유지하도록 요청합니다. |
| `autoBrightness` | `boolean` | Android 자동 밝기를 사용할지 지정합니다. 지정하지 않으면 Host는 결정적인 밝기 동작을 위해 기본적으로 비활성화합니다. |
| `immersive` | `boolean` | immersive mode를 요청합니다. |
| `hideSystemBars` | `boolean` | Android system bar 숨김을 요청합니다. |
| `orientation` | `RemixScreenOrientation` | 프로젝트 실행 중 화면 방향 정책입니다. |
| `timeout` | `number` | 화면 꺼짐 시간 요청값이며 단위는 ms입니다. 기기 정책에 따라 Host가 보정하거나 무시할 수 있습니다. |
| `keyboard` | `object` | soft keyboard의 layout 및 초기 표시 상태입니다. |

지원하는 `orientation` 값은 다음과 같습니다.

```text
portrait | landscape | reversePortrait | reverseLandscape
sensor | fullSensor | locked | unspecified
```

### screen.keyboard

| 필드 | 값 | 설명 |
| --- | --- | --- |
| `adjust` | `resize`, `pan`, `nothing` | keyboard가 보일 때 프로젝트 UI를 어떻게 조정할지 지정합니다. |
| `nativeAdjust` | `boolean` | `true`이면 Android native soft-input adjust를 사용합니다. 기본 모드에서는 Host JavaScript layout이 `adjust`를 처리합니다. |
| `state` | `unspecified`, `hidden`, `alwaysHidden`, `visible`, `alwaysVisible` | Android에 요청할 keyboard 표시 상태입니다. |

## input

```ts
input: {
  capturedKeys: ["VOLUME_UP", "VOLUME_DOWN"],
  captureBack: true,
}
```

`capturedKeys`에 포함된 hardware key는 `context.events.on("device:key", ...)`으로 전달됩니다. `captureBack`은 Android back key를 프로젝트가 처리하도록 Host에 요청합니다. 실행 중에는 `context.device.input.captureKeys()`와 `captureBack()`으로 값을 바꿀 수도 있습니다.

## mqtt

MQTT 연결과 topic 구독은 source config에 고정해서 선언합니다.

```ts
mqtt: {
  connections: {
    primary: {
      url: "mqtts://broker.example.com:8883",
      username: "device-user",
      password: "device-password",
      keepAliveSeconds: 30,
      cleanSession: true,
      reconnect: true,
      subscriptions: [
        { filter: "devices/+/commands", qos: 1 },
      ],
    },
  },
}
```

연결 이름에는 영문자, 숫자, `_`, `-`만 사용할 수 있습니다. URL은 `mqtt://` 또는 `mqtts://` 형식이어야 하며 자격증명은 URL이 아니라 별도 필드에 둡니다. `password`는 `username`과 함께 사용해야 합니다.

기본값은 `keepAliveSeconds: 30`, `cleanSession: true`, `reconnect: true`, subscription `qos: 0`입니다. `clientId`를 생략하면 Host가 안정적인 값을 생성합니다.

> `username`과 `password`는 빌드된 `project.json`에 기록됩니다. `.remixprj`에 포함된 보호되지 않은 설정값이며 secret 저장소가 아닙니다.

runtime에서는 연결을 추가하거나 구독을 변경하지 않습니다. 선언된 연결의 상태를 확인하고 publish할 수 있습니다.

```ts
await context.mqtt.publish("primary", "devices/kiosk-1/state", "ready", {
  qos: 1,
  retain: true,
});
```

## nativeEvents

`nativeEvents`는 native event를 조건과 비교하여 action을 순서대로 실행합니다. 각 rule의 `activityState`로 실행할 Activity 상태를 제한할 수 있으며 기본값은 `always`입니다.

```ts
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
      ],
      expiresIn: 10000,
    },
  ],
}
```

`activityState`는 `inactive`, `resumed`, `always` 중 하나이며 생략하면 `always`입니다. `when`의 key는 event payload의 dot path입니다. 값 직접 비교 외에 `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `contains`, `exists` matcher를 사용할 수 있습니다. `actions`는 비어 있을 수 없으며 `expiresIn`을 지정하면 1 이상의 정수 ms여야 합니다.

`host.panel.buttons.set`처럼 callback을 포함하는 context 전용 기능은 `nativeEvents` action으로 사용할 수 없습니다.

## vite

```ts
vite: {
  define: {
    __ROOM_ID__: JSON.stringify("airport-a"),
  },
}
```

CLI는 사용자 Vite 설정을 병합하지만 `.remixprj` 계약을 유지하기 위해 output directory, entry 정규화, relative base 같은 설정을 덮어쓸 수 있습니다. 빌드 결과의 고정 경로를 Vite 설정으로 변경하려고 하지 마세요.

## source config와 project.json

`remix.config.ts`는 build-time 파일이며 `.remixprj`에 그대로 들어가지 않습니다. CLI는 다음 값을 자동으로 추가하거나 정규화합니다.

- `formatVersion`
- `runtimeApiVersion`
- 진단용 `builtWith.cli`, `builtWith.sdk`
- `entry: "src/index.js"`
- `styles: ["src/style.css"]`
- MQTT 및 native event 기본값

프로젝트에서 `project.json`을 직접 작성하거나 자동 생성 필드를 source config에 추가하지 마세요.

## 관련 문서

- [빠른 시작](../getting-started/quick-start.md)
- [아키텍처](../concepts/architecture.md)
- [RemixAppContext](context.md)
- [MQTT](mqtt.md)
- [nativeEvents](native-events.md)
- [프로젝트 패키지](../concepts/project-package.md)
