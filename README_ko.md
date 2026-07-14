# remixApp

**remixApp**은 **Room Escape Mobile Interface eXecution**의 약자입니다.

remixApp은 방탈출 매장과 고정된 현장 설치 환경에서 사용하는 Android 기기를 위한 프로젝트 시스템입니다. 일반 앱스토어 앱이나 범용 웹 플랫폼을 목표로 하지 않습니다. 정해진 기기, 정해진 물리 공간, 운영자가 관리하는 배포 환경을 전제로 합니다.

## 핵심 개념

`@remixapp/app`은 실제 Android APK Host입니다.

이 앱은 Android 기기에 설치되며 Android 권한, native 기능, device policy, lifecycle 처리, kiosk 동작, wake lock, hardware key capture, 기타 기기 수준 책임을 가집니다.

remixApp 프로젝트는 Android APK가 아니며 standalone web app도 아닙니다. 프로젝트는 `.remixprj` ZIP archive로 빌드되는 동적 프로젝트 패키지입니다. Host APK는 런타임에 이 패키지를 import, unpack, load합니다.

## 관계

```txt
@remixapp/app APK
  -> Android에 설치되는 애플리케이션
  -> Android 권한과 native 기능 보유
  -> @remixapp/core를 통해 Capacitor/native 기능 사용
  -> .remixprj 프로젝트 패키지 import/load
  -> Host container DOM node 제공
  -> RemixAppContext 생성
  -> project src/index.js dynamic import
  -> mount(container, context) 호출

.remixprj project package
  -> APK가 로드하는 프로젝트별 웹 런타임 모듈
  -> 프로젝트별 JS/CSS/UI/assets/resources 제공
  -> Android 권한을 직접 관리하지 않음
  -> native plugin을 직접 import하지 않음
  -> SDK context를 통해 Host APK 기능 호출
```

프로젝트 코드는 `RemixAppContext`를 통해 Host와 통신합니다. Capacitor plugin이나 `@remixapp/core`를 직접 import하지 않아야 합니다.

## 설계 우선순위

1. 기능이 현장에서 안정적으로 작동할 것.
2. 프로젝트 개발 자유도가 높을 것.
3. 방탈출 현장 설치에 필요한 기능을 충분히 열어줄 것.
4. Host APK가 Android 권한과 native 기능을 강하게 제공할 것.
5. 프로젝트 패키지의 빌드, 설치, 교체, 로드가 단순할 것.

보안 hardening, sandboxing, strict isolation, permission minimization, project signing, encryption, rollback, delta update는 초기 우선순위가 아닙니다. 초기 시스템은 통제된 기기에서의 기능성, 자유도, 예측 가능한 동작을 우선합니다.

## 패키지 이름

- 제품/시스템 이름: `remixApp`
- CLI 실행 이름: `remix-cli`
- npm scope: `@remixapp`
- SDK 패키지: `@remixapp/sdk`
- CLI 패키지: `@remixapp/cli`
- Host APK 패키지: `@remixapp/app`
- native/core 패키지: `@remixapp/core`
- template 패키지: `@remixapp/template`
- Android application ID: `com.fainthit.remix`
- source config 파일: `remix.config.ts` 또는 `remix.config.js`
- built project manifest: `project.json`
- 프로젝트 패키지 확장자: `.remixprj`

npm scope와 package 이름은 소문자를 사용합니다. `@remixApp`이 아니라 `@remixapp`입니다.

## 모노레포 구조

저장소는 pnpm workspace로 관리합니다.

```txt
packages/
├─ app/
├─ core/
├─ sdk/
├─ cli/
└─ template/
```

루트 파일:

```txt
package.json
pnpm-workspace.yaml
tsconfig.base.json
README.md
README_ko.md
```

## 패키지

### @remixapp/app

`@remixapp/app`은 Capacitor + vanilla TypeScript/JavaScript 기반 Android APK Host입니다.

책임:

- 실제 Android 애플리케이션으로 설치되고 실행됩니다.
- Android 권한을 보유하고 관리합니다.
- native 기능과 device policy를 관리합니다.
- 내부적으로 `@remixapp/core`를 사용해 native 기능을 호출합니다.
- `.remixprj` 프로젝트 패키지를 import, unpack, load합니다.
- `project.json`을 읽습니다.
- manifest의 fixed project policy를 적용합니다.
- `src/style.css`를 로드합니다.
- `src/index.js`를 dynamic import합니다.
- `RemixAppContext`를 생성합니다.
- `mount(container, context)`를 호출합니다.
- optional unmount cleanup을 저장합니다.
- `context.project.reset()`을 통해 Host APK를 재시작하지 않고 현재 프로젝트만 재시작합니다.

Android application ID는 `com.fainthit.remix`입니다. 전용 기기는 Android QR 코드 provisioning을 통해 Device Owner로 설정합니다. Device Owner policy와 kiosk 구현은 프로젝트 코드가 아니라 Host/Core native layer의 책임입니다.

Device Owner admin component는 `com.fainthit.remix/.RemixDeviceAdminReceiver`입니다. Host는 QR provisioning에 필요한 Android 12 이상의 provisioning mode 및 policy compliance activity도 제공합니다. 실제 배포용 QR payload를 만들려면 최종 서명 APK의 download URL과 signing certificate checksum이 추가로 필요합니다.

`@remixapp/app`은 remixApp 프로젝트 코드가 직접 import하는 패키지가 아닙니다.

### @remixapp/core

`@remixapp/core`는 Capacitor plugin bridge와 native 기능을 포함합니다.

책임 예시:

- Android device policy.
- kiosk, fullscreen, immersive mode.
- screen keep-on.
- 자동 밝기와 화면 밝기 제어.
- wake lock과 CPU wake 동작.
- hardware key capture.
- back key capture.
- audio, video, device-specific native 기능.
- 기타 현장 기기 제어 기능.

초기 Android bridge는 screen wake, screen keep-on, 자동 밝기 제어, 화면 밝기 제어, CPU wake lock, lock-task kiosk 제어, Device Owner 상태, Android back capture, 지원 hardware key event를 제공합니다. Host는 프로젝트 mount 전에 manifest의 fixed policy를 적용하고 unmount/reset 시 프로젝트가 사용한 runtime policy를 해제합니다.

프로젝트 개발자는 `@remixapp/core`를 직접 import하지 않습니다. Host APK가 내부적으로 사용하고, 필요한 기능은 `RemixAppContext`를 통해 노출합니다.

### @remixapp/sdk

`@remixapp/sdk`는 remixApp 프로젝트가 사용하는 TypeScript 계약입니다.

책임:

- `RemixAppContext` 타입.
- `RemixAppMount`, `RemixAppUnmount` 타입.
- source config와 built manifest 타입.
- device, event, resource, project, key 타입.
- `context.project.reset()`을 통한 프로젝트 단위 재시작.
- Host/project ABI와 type contract.

SDK는 가볍게 유지해야 합니다. Capacitor 구현, native bridge, 무거운 runtime dependency를 포함하지 않아야 합니다.

### @remixapp/cli

`@remixapp/cli`는 `remix-cli` 실행 파일을 제공합니다.

책임:

- `remix-cli build` 구현.
- `remix.config.ts` 또는 `remix.config.js` 로드.
- project config 검증.
- entry와 style path resolve.
- Vite 기반 build 실행.
- 사용자 Vite 설정을 허용하되 remixApp output contract 보존.
- built entry를 `src/index.js`로 normalize.
- built style을 `src/style.css`로 normalize.
- `resources/`를 bundle, hash, rename, transform 없이 복사.
- normalized `project.json` 생성.
- `dist/<name>-<version>.remixprj` 생성.

CLI는 config 없음, invalid config, entry 없음, configured style 없음, Vite build 실패, generated JS entry 없음, resource copy 실패, ZIP package 생성 실패를 명확하게 실패 처리해야 합니다.

### @remixapp/template

`@remixapp/template`은 최소 starter project이자 build fixture입니다.

포함 항목:

- `package.json`
- `remix.config.ts` 또는 `remix.config.js`
- `src/index.ts`
- `src/style.css`
- `resources/`

template은 `remix-cli build`로 빌드 가능한 최소 vanilla TypeScript/JavaScript remixApp 프로젝트입니다.

## Source Project 형태

예시:

```txt
airport/
├─ remix.config.ts
├─ src/
│  ├─ index.ts
│  ├─ App.svelte
│  ├─ messenger.ts
│  ├─ call.ts
│  ├─ style.css
│  └─ assets/
│     ├─ icon.png
│     └─ background.png
└─ resources/
   ├─ images/
   │  ├─ passport.png
   │  └─ ticket.png
   ├─ audio/
   │  ├─ ring.wav
   │  └─ voice-01.wav
   └─ video/
      └─ intro.mp4
```

source config 예시:

```ts
import { defineConfig } from "@remixapp/sdk/config";

export default defineConfig({
  name: "airport",
  version: "1.0.0",
  entry: "src/index.ts",
  styles: ["src/style.css"],
  kiosk: true,
  runtime: {
    foreground: true,
    keepCpuAwake: true,
  },
  screen: {
    keepOn: false,
    autoBrightness: false,
    timeout: 30000,
  },
  input: {
    capturedKeys: ["VOLUME_UP", "VOLUME_DOWN"],
    captureBack: true,
  },
  vite: {
    base: "./",
  },
});
```

source config는 build-time 파일입니다. Vite 설정을 포함한 JavaScript/TypeScript 설정을 담을 수 있습니다. built project package에는 이 파일이 포함되지 않습니다.

## Built Project Package

`.remixprj` 파일은 ZIP archive입니다. archive root에는 추가 project directory 없이 package 파일들이 바로 들어가야 합니다.

올바른 archive layout:

```txt
airport-1.0.0.remixprj
├─ project.json
├─ src/
│  ├─ index.js
│  ├─ style.css
│  ├─ runtime-C82JD.js
│  └─ logo-A72KD.png
└─ resources/
   ├─ audio/
   │  ├─ ring.wav
   │  └─ voice-01.wav
   └─ video/
      └─ intro.mp4
```

잘못된 archive layout:

```txt
airport-1.0.0.remixprj
└─ airport/
   ├─ project.json
   ├─ src/
   └─ resources/
```

필수 built files:

```txt
project.json
src/index.js
src/style.css
```

CSS가 없더라도 CLI는 empty `src/style.css`를 생성합니다.

## project.json

`project.json`은 Host APK가 읽는 built runtime manifest입니다.

예시:

```json
{
  "name": "airport",
  "version": "1.0.0",
  "entry": "src/index.js",
  "styles": ["src/style.css"],
  "kiosk": true,
  "runtime": {
    "foreground": true,
    "keepCpuAwake": true
  },
  "screen": {
    "keepOn": false,
    "autoBrightness": false,
    "timeout": 30000
  },
  "input": {
    "capturedKeys": ["VOLUME_UP", "VOLUME_DOWN"],
    "captureBack": true
  }
}
```

Host는 original source entry나 source style list를 알 필요가 없습니다. Host는 항상 normalized built files를 로드합니다.

## 빌드 규칙

- source entry는 `src/index.ts`, `src/main.ts`, `src/runtime.js`, 또는 설정된 다른 module일 수 있습니다.
- built entry는 항상 `src/index.js`로 normalize됩니다.
- built style은 항상 `src/style.css`로 normalize됩니다.
- configured CSS 파일은 반드시 존재해야 합니다. 누락된 configured style은 build error입니다.
- configured style 순서는 보존해야 합니다.
- JS/TS/Svelte에서 import된 CSS는 최종 `src/style.css`에 포함되어야 합니다.
- JavaScript entry가 configured CSS를 import하도록 강제하지 않습니다.
- Vite output은 relative path를 사용해야 하며 web root `/`를 가정하면 안 됩니다.
- ES module output이 필요합니다.
- code splitting과 dynamic import를 허용합니다.
- generated chunks와 bundled assets는 built `src/` 아래에 둡니다.
- `resources/`는 그대로 복사하며 Vite가 처리하지 않습니다.
- build는 source `src/`와 `resources/`를 수정하면 안 됩니다.
- CLI는 isolated temporary build directory를 사용해야 합니다.
- 매 build마다 stale output을 정리해야 합니다.
- final package staging은 archive layout과 정확히 같아야 합니다.

## Resources

`resources/`는 runtime resource directory입니다. 이 디렉터리의 파일은 원래 filename, extension, directory hierarchy를 유지합니다.

대표적인 resources:

- large video files.
- audio files.
- dialogue resources.
- scene resources.
- dynamically selected images.
- runtime-generated path로 선택되는 파일.

프로젝트 코드는 SDK context를 통해 이 파일에 접근합니다.

```ts
const video = document.createElement("video");
video.src = context.resources.url("video/intro.mp4");
```

`context.resources.url(path)`는 browser/WebView API에서 바로 사용할 수 있는 URL을 반환합니다. 기본적으로 Android filesystem detail은 프로젝트 코드에 노출하지 않아야 합니다.

## Mount Contract

Project entry module은 `mount`를 export합니다.

```ts
import type { RemixAppMount } from "@remixapp/sdk";

export const mount: RemixAppMount = (container, context) => {
  const button = document.createElement("button");

  button.textContent = "NEXT";
  button.onclick = () => {
    void context.device.screen.wake();
    void context.device.screen.setBrightness(0.8);
  };

  container.append(button);

  return () => {
    button.remove();
  };
};
```

Svelte 5 예시:

```ts
import { mount as mountSvelte, unmount } from "svelte";
import App from "./App.svelte";
import type { RemixAppMount } from "@remixapp/sdk";

export const mount: RemixAppMount = (container, context) => {
  const app = mountSvelte(App, {
    target: container,
    props: { context },
  });

  return () => {
    unmount(app);
  };
};
```

## Host Load Flow

1. built `project.json` 읽기.
2. manifest와 compatibility 검증.
3. fixed device policy 적용:
   - kiosk
   - runtime foreground behavior
   - CPU wake behavior
   - screen keep-on
   - automatic brightness
   - screen timeout
   - captured hardware keys
   - back key capture
4. `src/style.css` 로드.
5. `src/index.js` dynamic import.
6. exported `mount` 존재 확인.
7. runtime container DOM node 준비.
8. `RemixAppContext` 생성.
9. `module.mount(container, context)` await.
10. optional unmount cleanup이 반환되면 저장.

Host는 계속 mounted/alive 상태를 유지합니다. remixApp project는 제공된 project container 안에만 mount됩니다.

## 초기 마일스톤

1. Monorepo skeleton.
2. `@remixapp/sdk` type contract.
3. `@remixapp/cli` validate/build/package flow.
4. `@remixapp/template` build 성공.
5. `@remixapp/app`에서 template `.remixprj` load 성공.
6. `@remixapp/core` native 기능 점진적 연결.

## 초기 제외 범위

- Visual project editor.
- JSON scenario engine.
- Hot reload protocol.
- Project server synchronization.
- OTA transfer.
- Delta patching.
- Project signing.
- Project encryption.
- Resource hashing.
- Project rollback.
- Multiple simultaneously mounted remixApps.
- 일반 앱스토어 배포 수준의 security hardening.

## 초기 목표

방탈출 프로젝트 개발자가 다음을 할 수 있어야 합니다.

1. template으로 시작.
2. `remix.config.ts` 또는 `remix.config.js` 작성.
3. `src/index.ts`에서 `mount(container, context)` export.
4. 대용량 runtime file을 `resources/` 아래에 배치.
5. `npm run build` 또는 `remix-cli build` 실행.
6. `dist/<name>-<version>.remixprj` 획득.
7. `@remixapp/app` Android APK에서 해당 package load.
8. `RemixAppContext`를 통해 Host가 제공하는 native/device 기능 사용.
