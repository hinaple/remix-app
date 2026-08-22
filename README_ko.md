# remixApp

[English](README.md) | 한국어

**remixApp**은 **Room Escape Mobile Interface eXecution**의 약자입니다.

remixApp은 방탈출처럼 고정된 설치 환경에서 운영자가 관리하는 Android 기기로 인터랙티브 프로젝트를 실행합니다. 시스템은 Android Host 앱과 독립적으로 빌드하고 설치·교체할 수 있는 프로젝트 패키지로 구성됩니다.

## 개요

- `@remixapp/app`은 Android Host APK입니다.
- 프로젝트는 `.remixprj` 패키지로 빌드됩니다.
- Host는 패키지를 로드하고 프로젝트가 export한 `mount` 함수를 호출합니다.
- 프로젝트 코드는 `RemixAppContext`를 통해 기기 기능을 사용합니다.
- Android 권한, kiosk 동작, lifecycle, native 연동은 Host가 관리합니다.

프로젝트 코드에서 Capacitor plugin이나 `@remixapp/core`를 직접 import하면 안 됩니다.

## 동작 구조

```text
source project
  remix.config.ts
  src/
  resources/
        │
        │ remix-cli build
        ▼
name-version.remixprj
        │
        │ install / load
        ▼
@remixapp/app Android Host
  ├─ RemixAppContext → project API
  └─ @remixapp/core  → Android native bridge
```

빌드된 패키지는 다음과 같이 정규화된 ZIP archive입니다.

```text
project.json
src/
├─ index.js
└─ style.css
resources/        # optional
```

전체 빌드 및 runtime 계약은 [프로젝트 패키지](docs/concepts/project-package.md)를 참고하세요.

## 빠른 시작

Node.js 20 이상이 필요합니다.

프로젝트를 생성합니다.

```sh
npm create @remixapp@latest -- --name my-room --version 0.1.0
cd my-room
```

브라우저 개발 Host를 실행합니다.

```sh
npm run dev
```

프로젝트 패키지를 빌드합니다.

```sh
npm run build
```

결과는 다음 경로에 생성됩니다.

```text
dist/my-room-0.1.0.remixprj
```

개발용 Host가 ADB로 연결된 기기에 설치되어 있다면 다음 명령으로 프로젝트를 배포합니다.

```sh
npm run deploy
```

자세한 내용은 [빠른 시작](docs/getting-started/quick-start.md)과 [Android 배포](docs/getting-started/deploy-to-android.md)를 참고하세요.

## 프로젝트 entry

설정한 entry module은 `mount`를 export해야 합니다.

```ts
import type { RemixAppMount } from "@remixapp/sdk";

export const mount: RemixAppMount = (container, context) => {
  const button = document.createElement("button");
  button.textContent = "화면 켜기";

  button.addEventListener("click", () => {
    void context.device.screen.wake();
  });

  container.append(button);
};
```

Host는 DOM container와 `RemixAppContext`를 제공합니다. context는 프로젝트 정보, resources, 기기 제어, events, MQTT, Host panel 제어를 노출합니다.

context가 소유한 event 구독은 프로젝트가 unmount될 때 자동으로 정리됩니다. 프로젝트가 직접 만든 전역 listener, timer, 외부 연결과 기타 자원은 `mount`가 반환하는 cleanup 함수에서 해제해야 합니다.

전체 계약은 [RemixAppContext](docs/reference/context.md)와 [프로젝트 lifecycle](docs/concepts/lifecycle.md)을 참고하세요.

## 패키지

| 패키지 | 역할 | 프로젝트에서 직접 사용 |
| --- | --- | --- |
| `@remixapp/app` | Android Host APK | 아니요 |
| `@remixapp/sdk` | 설정 및 프로젝트 API 계약 | 예 |
| `@remixapp/cli` | 개발 서버, 빌드, Android 배포 | 예 |
| `@remixapp/create` | 프로젝트 생성기 | 프로젝트 생성 시 |
| `@remixapp/core` | Capacitor 및 Android native bridge | 아니요 |
| `@remixapp/runtime` | Host 내부 공유 runtime | 아니요 |

## 문서

- [개발자 문서](docs/README.md)
- [아키텍처](docs/concepts/architecture.md)
- [프로젝트 설정](docs/reference/configuration.md)
- [CLI 레퍼런스](docs/reference/cli.md)
- [이벤트와 상태](docs/reference/events.md)
- [MQTT](docs/reference/mqtt.md)
- [nativeEvents](docs/reference/native-events.md)
- [기기 제어](docs/guides/device-control.md)
- [문제 해결](docs/guides/troubleshooting.md)

## 신뢰 모델과 현재 범위

remixApp은 통제된 기기에서 신뢰할 수 있는 프로젝트 패키지를 실행하도록 설계되었습니다. 신뢰할 수 없는 third-party 코드를 실행하는 sandbox가 아닙니다.

현재 시스템은 Host 하나에서 하나의 active project를 실행하는 데 집중합니다. Project signing, encryption, delta update, 원격 OTA 배포와 프로젝트 로드 실패 후 자동 rollback은 현재 제공하지 않습니다.

## 저장소 개발

이 저장소는 pnpm workspace입니다.

```sh
pnpm install
pnpm typecheck
pnpm build
```

패키지 경계와 Android 개발 절차는 [저장소 개발](docs/internals/contributing.md)을 참고하세요. 사용자에게 보이는 package 변경에는 Changeset이 필요합니다. 릴리스 절차는 [릴리스 가이드](docs/internals/releasing.md)에 정리되어 있습니다.

## 라이선스

Host와 runtime을 포함한 remixApp은 [Apache License 2.0](LICENSE)으로 배포됩니다.

`packages/create-remixapp/template-default`에서 생성되는 파일에는 별도의 [0BSD 라이선스](packages/create-remixapp/template-default/LICENSE)가 적용되므로 생성한 프로젝트는 자체 라이선스를 선택할 수 있습니다.
