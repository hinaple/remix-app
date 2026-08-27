# Constants

Constants는 프로젝트가 이름과 기본값을 예약하고, 각 Android 기기에서 Host 관리자가 값을 덮어쓸 수 있는 문자열 설정입니다. 같은 프로젝트 패키지를 여러 기기에 배포하면서 MQTT broker 주소, 기기 ID처럼 기기마다 달라지는 값을 소스나 패키지를 다시 만들지 않고 지정할 때 사용합니다.

## 선언

`remix.config.ts`의 `constants`에 ID별 정의를 작성합니다.

```ts
import { defineConfig } from "@remixapp/sdk/config";

export default defineConfig({
  name: "airport-room",
  projectId: "airport-room",
  version: "0.1.0",
  entry: "src/index.ts",
  styles: ["src/style.css"],
  constants: {
    deviceId: {
      required: true,
    },
    brokerHost: {
      default: "192.168.0.10",
    },
    roomLabel: {},
  },
});
```

Constant ID는 영문자로 시작해야 하며 이후에는 영문자, 숫자와 `_`만 사용할 수 있습니다.

```text
^[A-Za-z][A-Za-z0-9_]*$
```

각 정의는 다음 옵션을 가집니다.

| 옵션       | 타입      | 기본값  | 설명                                                              |
| ---------- | --------- | ------- | ----------------------------------------------------------------- |
| `default`  | `string`  | 없음    | 기기에 override가 저장되지 않았을 때 사용하는 값입니다.           |
| `required` | `boolean` | `false` | default와 저장된 override가 모두 없으면 프로젝트 시작을 막습니다. |

두 옵션은 모두 선택사항입니다. `default`가 있는 경우 `required: true`는 아무런 역할도 하지 않습니다.

값 결정 우선순위는 다음과 같습니다.

1. 현재 기기에 저장된 override
2. 프로젝트가 선언한 `default`
3. 값 없음

`required: true`이면서 `default`가 없는 Constant에 기기 override가 저장되지 않은 경우에만 Host가 프로젝트 실행을 보류합니다. Host admin UI에서 필요한 값을 저장하면 현재 프로젝트가 새 값으로 다시 시작됩니다. Host APK 프로세스 전체를 재시작하는 동작은 아닙니다.

## 프로젝트 식별과 저장 수명

Host는 `projectId`를 기준으로 기기별 override를 저장합니다.

```ts
export default defineConfig({
  name: "Remix Test",
  projectId: "remixapp-test",
  // ...
});
```

- 같은 `projectId`로 새 버전을 설치하면 저장된 override가 유지됩니다.
- `name`을 바꾸더라도 `projectId`가 같으면 같은 저장값을 사용합니다.
- `projectId`를 바꾸면 별도의 프로젝트 설정으로 취급합니다.
- `projectId`를 생략하면 이전 프로젝트와의 호환성을 위해 `name`을 사용합니다.

`projectId`가 없는 프로젝트는 빌드에 실패하지 않지만 CLI가 fallback을 알리는 warning을 출력합니다.

서로 관련 없는 프로젝트에 같은 `projectId`를 재사용하면 저장값을 공유하게 되므로 피하세요.

## runtime config 문자열 치환

다음 source config 영역의 문자열에서 `{{Constants.id}}`를 사용할 수 있습니다.

- `screen`
- `input`
- `mqtt`
- `nativeEvents`

Host는 프로젝트를 시작하기 전에 문자열 안의 template을 현재 기기의 최종 값으로 치환한 뒤 설정을 적용합니다.

```ts
constants: {
  deviceId: { required: true },
  brokerHost: { default: "192.168.0.10" },
},
mqtt: {
  connections: {
    primary: {
      url: "mqtt://{{Constants.brokerHost}}:1883",
      clientId: "airport-{{Constants.deviceId}}",
      subscriptions: [
        { filter: "devices/{{Constants.deviceId}}/commands" },
      ],
    },
  },
},
```

Template에는 선언된 Constant만 참조할 수 있습니다. 또한 template에서 사용하는 Constant는 다음 중 하나여야 합니다.

- `default`가 있음
- `required: true`임

`default`도 없고 required도 아닌 optional Constant는 값이 존재하지 않을 수 있으므로 runtime config template에서 참조할 수 없습니다. 알 수 없는 ID, 잘못 작성한 template, 값이 보장되지 않는 optional Constant 참조는 config 검증 단계에서 실패합니다.

Template 치환은 위 네 runtime config 영역에만 적용됩니다. 프로젝트 JavaScript, CSS, resource 파일이나 `name`, `version`, `entry`, `styles`, `vite`에는 적용되지 않습니다.

## 프로젝트 코드에서 읽기

프로젝트가 mount될 때 최종 값은 `context.constants`로 전달됩니다.

```ts
import type { RemixAppMount } from "@remixapp/sdk";

export const mount: RemixAppMount = (_container, context) => {
  console.log(context.constants.deviceId);
  console.log(context.constants.brokerHost);
};
```

타입은 다음과 같습니다.

```ts
Readonly<Record<string, string>>;
```

기기 override 또는 default가 있는 Constant만 객체에 포함됩니다. 값이 없는 optional Constant는 property 자체가 생략됩니다. 객체는 읽기 전용이며 프로젝트 코드에서 값을 저장하거나 변경할 수 없습니다. 값 변경은 Host admin UI에서 수행합니다.

## Host admin UI

Host admin UI는 현재 프로젝트가 선언한 Constants를 표시합니다.

- `default`가 있는 항목은 override가 없으면 기본값을 사용합니다.
- 저장하면 override를 기기에 기록하고 프로젝트를 다시 시작합니다.
- 기본값으로 재설정한 항목은 저장된 override를 제거하고 프로젝트 기본값을 다시 사용합니다.
- required Constant의 값이 준비되지 않았으면 프로젝트 UI를 mount하지 않고 설정 화면을 먼저 표시합니다.
- 여러 화면에서 동시에 편집해 이전 revision을 저장하려 하면 오래된 변경을 거부합니다.

프로젝트를 교체하거나 업데이트해도 동일한 `projectId`라면 저장값은 유지됩니다. 새 manifest에서 삭제된 Constant는 더 이상 적용되지 않습니다.

## 개발 환경 제한

현재 `remix-cli dev`의 브라우저 Host는 기기별 Constants 저장과 required 설정 화면을 구현하지 않습니다. 개발 Context의 `context.constants`는 빈 읽기 전용 객체이며 Android Native의 template 치환도 모사하지 않습니다.
이 기능은 추후 버전에서 추가 예정입니다.

CLI는 source config의 Constant 정의와 template 참조 자체는 검증하지만, 기기별 값에 따른 최종 동작은 Android Host에서 확인해야 합니다.

## 관련 문서

- [프로젝트 설정](configuration.md)
- [RemixAppContext](context.md)
- [프로젝트 패키지](../concepts/project-package.md)
- [CLI](cli.md)
- [Host panel](../guides/host-panel.md)
