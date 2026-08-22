# 문제 해결

문제를 먼저 생성, config, browser dev, build/package, Android project deploy, Host load, native 기능으로 나누면 원인을 빠르게 좁힐 수 있습니다. 한 계층의 실패를 다른 계층의 오류로 해석하지 마세요.

## 빠른 진단 순서

1. project root와 실행한 명령을 확인합니다.
2. `remix.config.ts/js`와 entry/style path를 확인합니다.
3. `npm run dev`에서 mount와 기본 UI를 확인합니다.
4. `npm run build:unpack`으로 package 구조를 확인합니다.
5. `adb devices -l`로 기기 연결을 확인합니다.
6. deploy 후 WebView Console과 Android logcat을 분리해 확인합니다.
7. browser simulation과 Android native 동작 차이인지 확인합니다.

## 프로젝트 생성

### name이 유효하지 않음

생성기는 이름의 앞뒤 공백을 제거하고 소문자로 바꾸며 공백을 `-`로 바꿉니다. 그 뒤 유효한 unscoped npm package name이 아니면 실패합니다.

영문 소문자, 숫자, `-`, `.`, `_`, `~` 중심의 단순한 이름을 사용합니다.

```sh
npm create @remixapp@latest -- --name airport-room --version 0.1.0
```

### 비대화형 환경에서 name/version 누락

TTY가 없는 환경에서는 prompt를 사용할 수 없습니다. 둘 다 옵션으로 전달합니다.

```sh
npm create @remixapp@latest -- --name airport-room --version 0.1.0
```

### 기존 directory 경고

`--force`는 directory 전체를 비우지 않지만 template과 같은 파일을 덮어쓸 수 있습니다. 중요한 directory에 바로 사용하지 말고 target 내용을 먼저 확인합니다.

## config

### config를 찾지 못함

```text
Missing remix config. Expected one of: remix.config.ts, remix.config.js
```

- project root에서 실행했는지 확인합니다.
- 다른 directory에서 실행하면 `--cwd <path>`를 사용합니다.
- filename 대소문자와 확장자를 확인합니다.

### config export 오류

```text
remix config must export an object
```

default export가 object인지 확인합니다.

```ts
export default defineConfig({
  // ...
});
```

### version 오류

`version`은 `1.0.0`, `0.2.0-beta.1` 같은 semantic version이어야 합니다.

### absolute path 오류

`entry`와 `styles`는 project root 기준 상대 path여야 합니다.

```ts
entry: "src/index.ts",
styles: ["src/style.css"],
```

## 개발 서버

### entry가 없음

```text
Configured entry does not exist: ...
```

config path와 실제 filename을 확인합니다. Windows에서 작동하더라도 Android/package 환경을 위해 대소문자까지 맞춥니다.

### style이 없음

```text
Configured style does not exist at styles[...]
```

사용하지 않는 style 항목을 config에서 제거하거나 파일을 생성합니다. `styles`를 생략하면 CLI가 build 때 빈 `src/style.css`를 만듭니다.

### entry가 mount를 export하지 않음

```text
Project entry must export a mount(container, context) function
```

named export인지 확인합니다.

```ts
export const mount: RemixAppMount = (container, context) => {
  // ...
};
```

default export만 작성하면 Host가 찾지 못합니다.

### port가 이미 사용 중

다른 port를 지정합니다.

```sh
remix-cli dev --port 5199
```

Android Host live reload는 현재 `5173` strict port를 사용하므로 해당 script를 실행할 때는 기존 process를 종료해야 합니다.

### browser에서 native 기능 오류

브라우저 Host는 Android 기능을 simulation하거나 unsupported 오류를 반환합니다. 실제 MQTT publish, kiosk, hardware key와 system setting은 Android에서 검증합니다. browser 오류가 의도된 unsupported 동작인지 API 자체 실패인지 메시지를 확인합니다.

## build와 package

### Vite가 `src/index.js`를 만들지 못함

```text
Vite build did not generate required entry: src/index.js
```

project의 `vite.build`, library mode 또는 Rollup output 설정이 CLI 필수 설정과 충돌하는지 확인합니다. output filename이나 outDir을 직접 강제하지 않습니다.

### resources가 directory가 아님

```text
resources exists but is not a directory
```

project root의 `resources` 파일을 제거하거나 directory로 바꿉니다.

### CSS 또는 asset 경로가 Android에서 깨짐

```sh
npm run build:unpack
```

다음을 확인합니다.

- `src/style.css`에 필요한 CSS가 있는지
- HTML/CSS URL이 web root `/`를 가정하지 않는지
- Vite asset이 `src/`에 있고 relative reference인지
- runtime resource가 `resources/`에 있는지

### 이전 package가 배포됨

`deploy --no-build`를 사용했는지 확인합니다. config name/version이 같으면 기존 output filename도 같으므로 build timestamp보다 unpacked 내용과 CLI output을 확인합니다.

## package 호환성

### project format version 오류

Host보다 새로운 CLI로 만든 package일 수 있습니다. Host와 toolchain을 호환 version으로 맞춥니다.

### runtime API가 오래됨

```text
Unsupported runtime API version 1; this Host requires 2 or newer
```

이전 package를 현재 `@remixapp/cli`와 `@remixapp/sdk`로 다시 build합니다. `project.json`의 version field를 수동으로 바꾸는 것은 ABI를 실제로 갱신하지 않습니다.

### manifest shape 오류

```text
Invalid project.json: expected a normalized project manifest
```

archive root와 고정 필드를 확인합니다.

```text
project.json
src/index.js
src/style.css
```

직접 만든 ZIP보다 `remix-cli build` 결과를 사용합니다.

## ADB와 deploy

### ADB 실행 실패

```text
Failed to run adb. Set REMIXAPP_ADB or add Android SDK platform-tools to PATH.
```

PowerShell:

```powershell
$env:REMIXAPP_ADB = "C:\Users\me\AppData\Local\Android\Sdk\platform-tools\adb.exe"
adb version
```

### 연결 기기 없음

- `adb devices -l`을 실행합니다.
- 기기 USB debugging 승인 창을 확인합니다.
- `unauthorized` 또는 `offline`은 CLI 선택 대상이 아닙니다.
- Windows USB driver와 cable을 확인합니다.

### 여러 기기 연결

```sh
remix-cli deploy --device <serial>
```

CI나 redirected terminal에서는 번호 prompt를 사용할 수 없으므로 serial이 필수입니다.

### `run-as com.fainthit.remix` 실패

현재 project deploy는 Host private directory에 접근하는 개발 흐름입니다. 설치된 Host가 `run-as`를 허용하는 build인지 확인합니다. production/non-debuggable Host 배포 수단으로 사용하지 않습니다.

### Host APK가 없음

저장소 root에서 debug Host를 build/install합니다.

```sh
pnpm build:app
pnpm cap:sync
pnpm android:build
pnpm android:install
```

## Host load

### `project.json` fetch 실패

- package active directory에 `project.json`이 있는지 확인합니다.
- archive 안에 중간 project directory가 없는지 확인합니다.
- WebView Network panel에서 실제 URL과 status를 확인합니다.

### style load 실패

Host는 `src/style.css` load를 기다린 뒤 module을 import합니다. unpacked package에 파일이 있고 읽을 수 있는지 확인합니다.

### module import 실패

- WebView Console의 syntax/import error를 확인합니다.
- absolute `/assets/...` URL 대신 relative output인지 확인합니다.
- dynamic chunk가 package `src/`에 포함되었는지 확인합니다.
- build target과 Android System WebView version을 확인합니다.

### mount 중 오류

Host admin error와 WebView Console stack을 함께 확인합니다. `mount` 초기화를 단계별로 나누고, network/resource 작업의 Promise rejection을 처리합니다.

새 package directory가 active로 교체된 뒤 load가 실패해도 자동 functional rollback은 제공되지 않습니다. 검증된 package를 다시 deploy하거나 Host import UI로 교체합니다.

## lifecycle과 정리

### reset 후 handler가 두 번 실행됨

대부분 context 밖의 listener나 timer를 cleanup하지 않은 경우입니다.

확인할 것:

- `window`/`document.addEventListener`
- `setInterval`과 recursive timeout
- observer
- external store/emitter subscription
- WebSocket/EventSource

`context.events` 구독은 Host가 자동 정리하므로 장기 구독을 별도 배열로 관리할 필요가 없습니다. 조기 해제 용도가 아니라면 중복 unsubscribe보다 외부 resource cleanup을 먼저 확인합니다.

### cleanup 오류로 reset 실패

cleanup을 idempotent하게 만들고 이미 닫힌 resource를 다시 닫아도 실패하지 않게 처리합니다. 하나의 resource 정리 실패가 나머지 project-owned resource 정리를 막지 않도록 필요한 곳에서 개별 오류를 처리합니다.

## 기기 기능

### kiosk가 활성화되지 않음

Host admin의 Device Owner, admin active, lock-task permitted 상태를 확인합니다. `kiosk: true`는 요청이며 기기 policy 권한이 없으면 완전한 lock task가 활성화되지 않을 수 있습니다.

### brightness/timeout이 적용되지 않음

system setting 권한과 Device Owner 상태를 확인합니다. app window brightness와 Android global setting이 다를 수 있습니다. action Promise 오류, screen status와 logcat을 함께 봅니다.

### hardware key event가 없음

- config의 `capturedKeys`를 확인합니다.
- runtime에서 `captureKeys()`로 목록을 교체하지 않았는지 확인합니다.
- `action === "down"`/`"up"` 조건을 확인합니다.
- browser keyboard simulation과 실제 Android hardware key를 구분합니다.

### keyboard layout이 이중으로 움직임

`screen.keyboard.nativeAdjust`와 project 자체 resize/pan 코드를 함께 확인합니다. 기본 mode에서는 Host JavaScript layout이 `adjust`를 처리합니다. native adjust를 켜면 Android가 layout을 조정하므로 project의 추가 보정을 중복 적용하지 않습니다.

## MQTT

### browser에서 항상 disconnected

정상적인 개발 Host 제한입니다. 실제 connection은 Android Host에서만 만들어집니다.

### reconnecting이 계속됨

- broker URL, port, scheme 확인
- 기기의 DNS/network 확인
- TLS certificate와 system time 확인
- username/password 및 broker ACL 확인
- `mqtt:status.reason`과 logcat 확인

### listener가 메시지를 놓침

JavaScript listener가 없는 동안 message를 buffer하지 않습니다. retained state, snapshot 요청 또는 nativeEvents를 사용합니다.

## 진단 자료 수집

문제를 보고할 때 다음 정보를 함께 남깁니다.

- Host, CLI, SDK version
- `project.json`의 `formatVersion`, `runtimeApiVersion`, `builtWith`
- 실행한 정확한 명령과 `--cwd`, `--device` 옵션
- `adb devices -l`에서 serial/state/model
- browser dev인지 debug/liveReload/release Host인지
- WebView Console error와 stack
- 같은 시점의 Android logcat
- `build --unpack`의 관련 package 경로
- 재현되는 최소 config와 event/action

secret이 포함된 `project.json`, MQTT password 또는 현장 endpoint를 공유하기 전에 제거합니다.

## 관련 문서

- [빠른 시작](../getting-started/quick-start.md)
- [Android 배포](../getting-started/deploy-to-android.md)
- [CLI](../reference/cli.md)
- [lifecycle](../concepts/lifecycle.md)
- [Android Host 개발](../internals/android-development.md)
