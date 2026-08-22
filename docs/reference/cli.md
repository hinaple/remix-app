# remix-cli

`@remixapp/cli`가 제공하는 `remix-cli`는 프로젝트 개발 서버 실행, `.remixprj` 빌드와 Android 개발 기기 배포를 담당합니다.

생성된 프로젝트에서는 package script로 실행하는 것이 일반적입니다.

```sh
npm run dev
npm run build
npm run deploy
```

## 명령 요약

| 명령 | 설명 |
| --- | --- |
| `remix-cli dev` | 브라우저 개발 Host와 Vite 개발 서버를 실행합니다. |
| `remix-cli build` | source config를 검증하고 `.remixprj`를 만듭니다. |
| `remix-cli deploy` | 프로젝트를 빌드하고 연결된 Android Host에 설치합니다. |

`--cwd <path>`는 모든 명령에서 프로젝트 루트를 지정합니다. 생략하면 현재 작업 디렉터리를 사용합니다.

## dev

```text
remix-cli dev [--cwd <path>] [--host [host]] [--port <port>] [--open]
```

| 옵션 | 설명 |
| --- | --- |
| `--cwd <path>` | 프로젝트 루트입니다. |
| `--host` | network interface에서 접근할 수 있도록 Vite server를 엽니다. |
| `--host <host>` | bind할 host 주소를 직접 지정합니다. |
| `--port <port>` | 0보다 큰 정수 port를 지정합니다. |
| `--open` | 시작 후 브라우저를 엽니다. |

```sh
remix-cli dev --host 0.0.0.0 --port 5173 --open
```

개발 Host는 실제 Android 기기와 완전히 같지 않습니다. UI와 context 호출 흐름은 브라우저에서 빠르게 확인하고, kiosk, hardware key, 실제 밝기·볼륨·진동과 native lifecycle은 Android Host에서 검증하세요.

## build

```text
remix-cli build [--cwd <path>] [--unpack]
```

기본 빌드는 다음 파일을 생성합니다.

```text
dist/<name>-<version>.remixprj
```

CLI는 다음 작업을 수행합니다.

1. `remix.config.ts` 또는 `remix.config.js`를 찾고 검증합니다.
2. entry와 configured style이 존재하는지 확인합니다.
3. Vite로 JavaScript, CSS와 import asset을 빌드합니다.
4. 결과 entry와 style을 `src/index.js`, `src/style.css`로 정규화합니다.
5. source의 `resources/`를 경로와 이름을 유지하여 복사합니다.
6. `project.json`을 작성하고 `.remixprj` ZIP archive를 만듭니다.

`--unpack`은 ZIP 대신 archive와 동일한 구조의 디렉터리를 생성합니다.

```sh
remix-cli build --unpack
```

manifest, CSS 병합, asset 또는 resources 복사 문제를 확인할 때 사용합니다.

## deploy

```text
remix-cli deploy [--cwd <path>] [--device <serial>] [--no-build]
```

| 옵션 | 설명 |
| --- | --- |
| `--device <serial>` | `adb devices`에 표시되는 Android device serial입니다. |
| `--no-build` | 새로 빌드하지 않고 `dist/<name>-<version>.remixprj`를 사용합니다. |

기본적으로 deploy는 프로젝트를 먼저 빌드합니다. 그 뒤 ADB로 package를 기기에 전송하고 `com.fainthit.remix` Host의 active project로 교체한 다음 Host Activity를 시작합니다.

```sh
remix-cli deploy --device R3CN30ABCDE
```

### deploy 사전 조건

- Android Host가 기기에 설치되어 있어야 합니다.
- USB debugging 또는 접근 가능한 ADB 연결이 필요합니다.
- `adb devices`에서 기기가 `device` 상태로 보여야 합니다.
- 현재 deploy 구현은 Host private directory에 `run-as com.fainthit.remix`로 접근하므로 개발용으로 접근 가능한 Host build가 필요합니다.

기기가 여러 대이고 `--device`를 생략하면 CLI가 번호 목록을 표시하고 선택을 요청합니다. 비대화형 환경이나 자동화에서는 `--device`를 명시하세요.

`--no-build`를 사용했는데 config의 현재 name/version에 해당하는 package가 `dist/`에 없으면 실패합니다. 소스가 변경된 뒤 `--no-build`를 사용하면 이전 build를 배포할 수 있습니다.

## ADB 탐색

CLI는 `REMIXAPP_ADB`, `ADB`, `ANDROID_HOME`, `ANDROID_SDK_ROOT`, Windows의 Android SDK 기본 위치 등을 사용해 ADB를 찾습니다. 자동 탐색이 실패하면 실행 파일을 명시할 수 있습니다.

PowerShell:

```powershell
$env:REMIXAPP_ADB = "C:\Android\platform-tools\adb.exe"
npm run deploy
```

## 오류 해석

| 오류 유형 | 먼저 확인할 것 |
| --- | --- |
| config를 찾지 못함 | `--cwd`가 `remix.config.ts/js`가 있는 디렉터리인지 확인합니다. |
| entry/style 없음 | config의 상대 경로와 실제 파일명을 확인합니다. |
| generated JS entry 없음 | Vite output을 바꾸는 사용자 설정을 확인합니다. |
| Android device 없음 | `adb devices`와 USB debugging 승인을 확인합니다. |
| package 없음과 `--no-build` | `npm run build` 후 다시 배포합니다. |
| `run-as` 실패 | 설치된 Host가 현재 개발 deploy 흐름을 허용하는 build인지 확인합니다. |

## 관련 문서

- [빠른 시작](../getting-started/quick-start.md)
- [Android Host로 배포](../getting-started/deploy-to-android.md)
- [프로젝트 설정](configuration.md)
- [아키텍처](../concepts/architecture.md)
- [프로젝트 패키지](../concepts/project-package.md)
- [문제 해결](../guides/troubleshooting.md)
