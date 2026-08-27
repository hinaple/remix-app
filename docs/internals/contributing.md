# remixApp 저장소 개발

이 문서는 remixApp Host, SDK, CLI, 생성기 또는 native bridge 자체를 수정하는 기여자를 위한 안내서입니다. 일반 방탈출 프로젝트를 만드는 경우에는 [빠른 시작](../getting-started/quick-start.md)을 사용하세요.

## 개발 환경

| 항목         | 요구 사항                                   | CI / Release 기준 |
| ------------ | ------------------------------------------- | ----------------- |
| Node.js      | 20 이상                                     | 22 이상           |
| pnpm         | 10.13.1                                     | 10.13.1           |
| 운영체제     | 제한 없음                                   | Windows           |
| Android 도구 | Android SDK, platform-tools                 | compile SDK 36    |
| JDK          | Android Gradle Wrapper를 실행할 수 있는 JDK | Temurin JDK 21    |

저장소는 pnpm workspace이며 root에서 다음 명령으로 설치합니다.

```sh
pnpm install
```

## 모노레포 구조

| 경로                       | 설명                                                                |
| -------------------------- | ------------------------------------------------------------------- |
| `packages/app`             | Android Host의 WebView UI, project loader와 Capacitor app           |
| `packages/core`            | Capacitor plugin 정의와 Android native 구현                         |
| `packages/sdk`             | 프로젝트에 공개되는 config, context, event와 action 계약            |
| `packages/runtime`         | Host와 CLI 개발 runtime이 공유하는 내부 subscription 및 status 도구 |
| `packages/cli`             | `dev`, `build`, `deploy` 구현과 Android 도구                        |
| `packages/create-remixapp` | `npm create @remixapp` 생성기와 기본 template                       |
| `projects`                 | 공개 API, config와 Android 동작을 확인하는 예제 프로젝트 모음       |
| `scripts`                  | Android 개발, 설치와 release 검증 자동화                            |
| `docs/internals`           | 저장소 유지보수 및 release 문서                                     |

의존성 경계의 핵심은 다음과 같습니다.

- 프로젝트 코드는 `@remixapp/sdk`만 통해 Host 기능을 사용합니다.
- `@remixapp/app`은 `@remixapp/core`, `@remixapp/runtime`, `@remixapp/sdk`를 조합합니다.
- `@remixapp/runtime`은 공개 프로젝트 API가 아닌 내부 공유 package입니다.
- `@remixapp/core`의 구현 세부 사항을 SDK 공개 타입으로 누출하지 않습니다.

## 기본 검증

```sh
pnpm typecheck
pnpm build
```

root 명령은 각 workspace의 해당 script를 실행합니다. 변경 범위가 작을 때는 feature-local 검증으로 빠르게 확인할 수 있습니다.

```sh
pnpm --filter @remixapp/sdk typecheck
pnpm --filter @remixapp/cli build
pnpm --filter @remixapp/create test
pnpm --filter remixapp-example typecheck
```

공개 package나 release 경계를 변경했다면 최종적으로 다음 gate를 실행합니다.

```sh
pnpm release:check
```

이 검증은 typecheck와 workspace build 외에도 publish manifest, license, tarball, 생성기, example package와 Android debug APK를 확인하므로 일반적인 편집 중에는 시간이 더 걸릴 수 있습니다.

## 브라우저 개발

예제 프로젝트의 개발 Host를 실행합니다.

```sh
pnpm dev:example
```

Android Host의 web UI만 개발하려면 다음 명령을 사용합니다.

```sh
pnpm dev:app
```

두 개발 서버는 목적이 다릅니다. `dev:example`은 프로젝트 개발자가 받는 context와 mount 계약을 확인하고, `dev:app`은 설치·관리 화면 등 Host 자체 UI를 확인합니다.

## Android Host 개발

Capacitor asset을 동기화합니다.

```sh
pnpm cap:sync
```

Android Studio에서 프로젝트를 엽니다.

```sh
pnpm android
```

debug APK를 command line에서 빌드합니다.

```sh
pnpm android:build
```

연결된 기기에서 live-reload Host 개발 loop를 시작합니다.

```sh
pnpm android:dev
```

여러 기기가 연결되어 있으면 번호로 선택할 수 있습니다. ADB 자동 탐색이 실패하면 `REMIXAPP_ADB` 또는 `ADB` 환경 변수로 실행 파일을 지정합니다.

일반 debug와 live-reload build는 목적이 다릅니다. live-reload 구성은 개발 서버 URL과 cleartext 접근을 사용하므로 현장 배포 artifact로 사용하지 않습니다.

## 변경 종류별 확인 사항

### SDK 공개 계약

`packages/sdk`의 타입을 바꿀 때는 다음 소비자를 함께 확인합니다.

- Android Host의 context 생성 코드
- CLI browser 개발 runtime
- config validation과 manifest 생성
- `projects`의 관련 예제 프로젝트
- project/runtime API 호환성 버전 변경 필요 여부

API를 추가했는데 브라우저 개발 Host에 구현하지 않으면 프로젝트가 browser dev에서는 동작하지 않고 Android에서만 동작하는 불일치가 생깁니다.

### config와 package format

config 필드를 추가하거나 변경할 때는 최소한 다음 경로가 일치해야 합니다.

1. SDK의 `RemixConfig` source type
2. CLI validation 및 normalization
3. `RemixProjectManifest` built type
4. Host manifest load와 policy 적용
5. create template 및 `projects`의 관련 예제 프로젝트
6. `formatVersion` 또는 `runtimeApiVersion` 변경 필요 여부

source config 전용 값과 `project.json` runtime 값을 구분하세요. Vite config처럼 build에만 필요한 값은 manifest에 넣지 않습니다.

### context 구독 lifecycle

Host와 CLI 개발 runtime은 프로젝트마다 subscription scope를 생성하고 종료 시 일괄 정리합니다. `context.events`와 context가 제공하는 상태 변화 구독을 추가할 때는 반드시 이 scope에 등록되도록 구현합니다.

프로젝트가 직접 생성한 browser 전역 listener, timer 또는 외부 client는 scope 밖에 있으므로 project cleanup의 책임입니다. 문서와 example에서도 두 종류를 혼동하지 않도록 구분합니다.

### Android native bridge

`packages/core`를 변경할 때는 TypeScript plugin definition, web fallback, Android 구현과 Host 호출부를 함께 확인합니다. Android 정책이나 lifecycle 변경은 browser build 성공만으로 검증이 끝나지 않으며 실제 기기 확인 항목을 남겨야 합니다.

## Changesets

사용자에게 보이는 package 변경에는 changeset을 추가합니다.

```sh
pnpm changeset
```

공식 toolchain package는 lockstep version을 사용합니다. package version이나 Android `version.properties`를 개별적으로 수정하지 말고 [릴리스 문서](releasing.md)의 동기화 절차를 따릅니다.

## 문서 변경 원칙

- 현재 구현과 향후 제안을 구분합니다.
- CLI 명령과 옵션은 `packages/cli/src/cli.ts`를 기준으로 확인합니다.
- 공개 API는 `packages/sdk/src`의 export와 Host 구현을 함께 확인합니다.
- Android 전용 동작은 browser mock에서 확인한 결과만으로 보장하지 않습니다.
- 명령 예제는 root 명령인지 project 명령인지 명시합니다.

## 관련 문서

- [개발자 문서 목차](../README.md)
- [아키텍처](../concepts/architecture.md)
- [Android Host 개발](android-development.md)
- [문제 해결](../guides/troubleshooting.md)
- [릴리스](releasing.md)
