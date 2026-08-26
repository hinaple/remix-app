# remixApp 개발자 문서

remixApp 프로젝트를 처음 만든다면 [빠른 시작](getting-started/quick-start.md)부터 읽으세요. remixApp Host, SDK, CLI 또는 native bridge 자체를 수정하려면 [저장소 개발](internals/contributing.md)을 참고하세요.

## 프로젝트 개발자

### 시작하기

- [빠른 시작](getting-started/quick-start.md): 프로젝트 생성, 개발 서버 실행, 패키지 빌드
- [Android Host로 배포](getting-started/deploy-to-android.md): ADB 기기 선택, project deploy와 확인

### 핵심 개념

- [아키텍처](concepts/architecture.md): Android Host와 `.remixprj` 프로젝트의 관계
- [프로젝트 패키지](concepts/project-package.md): archive 구조, manifest와 호환성
- [프로젝트 lifecycle](concepts/lifecycle.md): install, mount, pause/resume, reset, unmount

### 레퍼런스

- [프로젝트 설정](reference/configuration.md): `remix.config.ts` 필드와 적용 시점
- [CLI](reference/cli.md): `dev`, `build`, `deploy` 명령과 옵션
- [RemixAppContext](reference/context.md): 프로젝트에서 사용할 수 있는 Host API
- [이벤트와 상태](reference/events.md): snapshot, event payload와 구독 수명
- [MQTT](reference/mqtt.md): native 연결 설정, 상태, publish와 message
- [nativeEvents](reference/native-events.md): Activity 상태별 조건부 action

### 기능별 가이드

- [resources](guides/resources.md): 원본 경로를 유지하는 runtime 파일
- [기기 제어](guides/device-control.md): 화면, key, volume, 진동과 상태
- [Host panel](guides/host-panel.md): operator status와 action button
- [문제 해결](guides/troubleshooting.md): config, build, ADB, Host load와 native 진단

일반적인 방탈출 콘텐츠는 remixApp **프로젝트**로 작성합니다. 프로젝트 코드는 `@remixapp/sdk`의 `RemixAppContext`를 통해 기기 기능을 사용하며, Capacitor plugin이나 `@remixapp/core`를 직접 import하지 않습니다.

## 저장소 기여자

- [저장소 개발](internals/contributing.md): 모노레포 구조, 개발 명령, 변경 시 확인할 경계
- [Android Host 개발](internals/android-development.md): debug APK, live reload, WebView와 logcat
- [릴리스](internals/releasing.md): 버전 동기화, 검증, 배포 절차

## 문서에서 사용하는 용어

| 용어 | 의미 |
| --- | --- |
| Host | Android에 설치되는 `@remixapp/app` APK |
| 프로젝트 | 방탈출 콘텐츠와 동작을 구현한 JavaScript/TypeScript 코드 |
| 프로젝트 패키지 | Host가 설치하고 실행하는 `.remixprj` ZIP archive |
| source config | 프로젝트 루트의 `remix.config.ts` 또는 `remix.config.js` |
| manifest | 빌드된 패키지 안의 `project.json` |
| context | Host가 프로젝트의 `mount` 함수에 전달하는 `RemixAppContext` |

## 문서의 기준

이 문서는 현재 저장소에 구현된 기능을 설명합니다. 아직 구현되지 않은 구상은 현재 기능처럼 서술하지 않습니다. 명령과 API가 문서와 다르다면 `packages/cli/src/cli.ts`와 `packages/sdk/src`의 현재 공개 계약을 기준으로 확인합니다.
