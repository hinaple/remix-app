# remixApp 아키텍처

remixApp은 Android에 설치되는 Host APK와 Host가 런타임에 불러오는 프로젝트 패키지로 구성됩니다. 프로젝트 개발자는 Android 앱 전체를 다시 빌드하지 않고 방탈출 콘텐츠를 `.remixprj` 단위로 개발하고 교체할 수 있습니다.

## 전체 구조

```text
source project
  remix.config.ts
  src/
  resources/
        │
        │ remix-cli build
        ▼
name-version.remixprj
  project.json
  src/index.js
  src/style.css
  resources/
        │
        │ install / load
        ▼
@remixapp/app Android Host
  ├─ @remixapp/core       Android native bridge
  ├─ @remixapp/runtime    Host 내부 runtime 도구
  └─ RemixAppContext      프로젝트에 공개되는 API
```

## Host와 프로젝트의 경계

Host는 다음 책임을 가집니다.

- Android 권한과 Activity lifecycle 관리
- kiosk, immersive mode, 화면과 hardware key 정책 적용
- foreground runtime, CPU wake lock과 native MQTT 연결 유지
- `.remixprj` 설치, 검증, unpack 및 로드
- 프로젝트용 DOM container와 `RemixAppContext` 생성
- 프로젝트 reset, 교체 및 종료 시 runtime 자원 정리

프로젝트는 다음 책임을 가집니다.

- 화면과 사용자 상호작용 구현
- 프로젝트별 상태와 시나리오 관리
- `resources/` 안의 이미지, 음원, 영상 사용
- `RemixAppContext`를 통한 기기 기능 호출
- context 밖에서 직접 생성한 타이머, 전역 DOM listener, 외부 연결 정리

프로젝트 코드는 `@remixapp/core` 또는 Capacitor plugin을 직접 import하지 않습니다. 이 경계를 지켜야 브라우저 개발 Host와 Android Host가 같은 프로젝트 계약을 제공할 수 있습니다.

## 패키지 역할

| 패키지 | 역할 | 프로젝트에서 직접 사용 |
| --- | --- | --- |
| `@remixapp/app` | 설치되는 Android Host APK | 아니요 |
| `@remixapp/core` | Capacitor 및 Android native bridge | 아니요 |
| `@remixapp/sdk` | config, context, event 타입과 공개 계약 | 예 |
| `@remixapp/cli` | 개발 서버, 빌드, Android 배포 | 예, 개발 의존성 |
| `@remixapp/create` | 새 프로젝트 생성기 | 프로젝트 생성 시 |
| `@remixapp/runtime` | Host와 개발 서버가 공유하는 내부 도구 | 아니요 |

## 빌드 계약

CLI는 source entry의 이름과 무관하게 빌드 결과를 정규화합니다.

| source | 빌드 결과 |
| --- | --- |
| 설정한 `entry` | `src/index.js` |
| 설정한 `styles` 및 Vite가 수집한 CSS | `src/style.css` |
| `resources/` | 경로와 파일명을 유지한 `resources/` |
| `remix.config.ts` | 정규화된 `project.json` |

`.remixprj`는 ZIP archive이며 archive root 바로 아래에 `project.json`과 `src/`가 있어야 합니다. 프로젝트 이름으로 된 중간 디렉터리를 한 단계 더 넣지 않습니다.

`project.json`에는 package layout을 나타내는 `formatVersion`과 Host API 계약을 나타내는 `runtimeApiVersion`이 기록됩니다. 이 값은 CLI가 작성하며 프로젝트 설정에서 직접 지정하지 않습니다.

## 프로젝트 로드 순서

Host는 대략 다음 순서로 프로젝트를 시작합니다.

1. `project.json`을 읽고 manifest와 runtime 호환성을 검증합니다.
2. kiosk, 화면, 키 입력 등 고정 project policy를 적용합니다.
3. 프로젝트 전용 mount container와 keyboard layout을 준비합니다.
4. `src/style.css`를 로드합니다.
5. `src/index.js`를 dynamic import합니다.
6. `mount(container, context)`를 호출합니다.
7. 반환된 cleanup 함수가 있으면 프로젝트 종료 때 호출하도록 보관합니다.

프로젝트가 reset되거나 교체되면 Host는 `project:lifecycle`의 `destroyed` 상태를 전달하고 프로젝트 cleanup을 호출합니다. 그 뒤 context에 속한 이벤트와 상태 구독, keyboard layout, project policy, Host panel, style과 mount container를 정리합니다.

## mount와 cleanup

`mount`는 동기 또는 비동기 함수일 수 있고, 선택적으로 cleanup 함수를 반환할 수 있습니다.

```ts
import type { RemixAppMount } from "@remixapp/sdk";

export const mount: RemixAppMount = (container, context) => {
  context.events.on("device:key", (event) => {
    console.log(event.key, event.action);
  });

  const onOnline = () => console.log("browser online");
  window.addEventListener("online", onOnline);

  return () => {
    window.removeEventListener("online", onOnline);
  };
};
```

위 `context.events` 구독은 Host가 프로젝트 범위로 자동 해제합니다. `window` listener는 context 밖에서 생성했기 때문에 cleanup에서 직접 해제해야 합니다.

## reset

`context.project.reset()`은 Host APK를 재시작하지 않고 현재 프로젝트만 `stop → start` 순서로 다시 실행합니다.

```ts
await context.project.reset();
```

reset 전후에도 유지되어야 하는 데이터가 있다면 프로젝트 DOM이나 module 변수만 사용하지 말고 별도의 영속 저장 위치를 설계해야 합니다.

## 관련 문서

- [빠른 시작](../getting-started/quick-start.md)
- [프로젝트 패키지](project-package.md)
- [프로젝트 lifecycle](lifecycle.md)
- [프로젝트 설정](../reference/configuration.md)
- [RemixAppContext](../reference/context.md)
