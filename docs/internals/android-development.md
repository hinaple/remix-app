# Android Host 개발

이 문서는 `@remixapp/app`과 `@remixapp/core`를 실제 Android 기기에서 개발하고 검증하는 저장소 기여자용 가이드입니다. 일반 프로젝트 package만 배포하려면 [Android Host로 프로젝트 배포](../getting-started/deploy-to-android.md)를 사용하세요.

## 구성 요소

Android Host는 다음 workspace를 함께 사용합니다.

| 위치                              | 책임                                                                |
| --------------------------------- | ------------------------------------------------------------------- |
| `packages/app`                    | Capacitor web app, project loader, Host UI                          |
| `packages/app/android`            | Android application project                                         |
| `packages/core`                   | Capacitor plugin TypeScript 계약과 web fallback                     |
| `packages/core/android`           | Kotlin native bridge, foreground service, MQTT, native event engine |
| `scripts/android-dev.mjs`         | live-reload build와 기기 실행 자동화                                |
| `scripts/install-android-app.mjs` | debug APK 설치와 실행                                               |

Android application ID와 main Activity는 다음과 같습니다.

```text
com.fainthit.remix
com.fainthit.remix/.MainActivity
```

## 사전 조건

- root에서 `pnpm install`을 완료한 상태
- Android SDK와 platform-tools
- project가 요구하는 JDK
- Windows에서는 Gradle wrapper `gradlew.bat`을 실행할 수 있는 환경
- USB debugging이 허용된 실제 기기 또는 emulator

기기를 확인합니다.

```sh
adb devices -l
```

ADB 자동 탐색이 실패하면 `REMIXAPP_ADB` 또는 `ADB`를 지정합니다.

```powershell
$env:REMIXAPP_ADB = "C:\Users\me\AppData\Local\Android\Sdk\platform-tools\adb.exe"
```

## 일반 debug APK build

Host web asset을 빌드합니다.

```sh
pnpm build:app
```

Capacitor Android project로 asset과 plugin 설정을 동기화합니다.

```sh
pnpm cap:sync
```

debug APK를 빌드합니다.

```sh
pnpm android:build
```

출력 위치:

```text
packages/app/android/app/build/outputs/apk/debug/app-debug.apk
```

선택한 기기에 설치합니다.

```sh
pnpm android:install
```

연결된 모든 `device` 상태 기기에 설치하려면 다음 명령을 사용합니다.

```sh
pnpm android:install:all
```

`android:install`은 기존 app을 유지한 채 `adb install -r`로 교체하고 Host Activity를 자동으로 다시 시작합니다. application data를 초기화하지 않습니다.

## Android Studio 사용

```sh
pnpm android
```

이 명령은 Capacitor가 관리하는 `packages/app/android` project를 Android Studio에서 엽니다. TypeScript web asset 또는 plugin dependency가 바뀌었다면 먼저 `pnpm cap:sync`를 실행합니다.

## live reload

```sh
pnpm android:dev
```

script는 다음 작업을 수행합니다.

1. ADB 기기를 선택합니다.
2. `@remixapp/app`과 의존 workspace를 빌드합니다.
3. Capacitor Android sync를 실행합니다.
4. live-reload 전용 Capacitor config와 manifest overlay를 생성합니다.
5. `liveReload` build type APK를 빌드합니다.
6. 기기의 `tcp:5173`을 PC의 `tcp:5173`으로 `adb reverse`합니다.
7. `127.0.0.1:5173`에서 Vite를 실행합니다.
8. APK를 `adb install -r`로 설치하고 Host Activity를 시작합니다.

종료할 때 script는 추가한 `adb reverse` mapping을 제거합니다.

live-reload build는 `http://127.0.0.1:5173`을 WebView server URL로 사용하고 cleartext traffic을 허용합니다. 이 설정은 생성된 build source에만 추가되며 normal debug config를 영구 변경하지 않습니다.

### live reload가 시작되지 않을 때

- port `5173`이 이미 사용 중인지 확인합니다. script는 strict port를 사용합니다.
- Vite가 시작되기 전 종료되면 terminal의 build 오류를 먼저 확인합니다.
- `adb reverse --list`로 mapping을 확인합니다.
- USB 연결이 끊기면 reverse mapping도 사용할 수 없습니다.
- live-reload APK는 normal debug APK와 output directory가 다릅니다.

## WebView 검사

Host를 실행한 뒤 Chrome에서 다음 주소를 엽니다.

```text
chrome://inspect/#devices
```

연결된 기기의 remixApp WebView에서 `inspect`를 선택합니다. 다음 항목을 확인할 수 있습니다.

- project module import 오류
- JavaScript exception과 rejected Promise
- `project.json`, `src/style.css`, resource request
- browser storage와 DOM
- Host/project lifecycle log

이 기능은 production / development 등 환경과 관계 없이 항상 동작합니다.

## logcat

전체 log:

```sh
adb logcat
```

특정 기기:

```sh
adb -s R3CN30ABCDE logcat
```

PowerShell filtering:

```powershell
adb -s R3CN30ABCDE logcat | Select-String -Pattern "remix|RemixCore|Capacitor|AndroidRuntime"
```

앱이 crash했다면 `AndroidRuntime`의 exception 시작 지점과 `Caused by` chain을 함께 보존합니다. WebView Console 오류와 native logcat 오류를 서로 다른 계층으로 구분합니다.

## native bridge 변경

`packages/core` 기능을 변경할 때 다음 계층을 함께 확인합니다.

1. `packages/core/src/definitions.ts`의 plugin 계약
2. `packages/core/src/web.ts`의 browser fallback
3. `packages/core/android`의 Kotlin 구현
4. `packages/app`의 context/action 연결
5. `packages/sdk`의 프로젝트 공개 계약
6. CLI browser 개발 Host의 대응 동작

Android에서만 구현하고 browser 개발 Host를 갱신하지 않으면 프로젝트 개발 환경과 실기기 동작이 갈라집니다.

## Device Owner 개발 설정

Host는 다음 Device Admin component를 선언합니다.

```text
com.fainthit.remix/.RemixDeviceAdminReceiver
```

Android의 fully managed device provisioning에서는 `RemixProvisioningActivity`가 provisioning mode 요청과 admin policy compliance 단계를 처리합니다. Host가 Device Owner이면 policy compliance 단계와 앱 시작 시 merged manifest에 선언된 dangerous runtime permission을 확인하고 Device Policy Manager로 자동 승인합니다. Device Owner가 아니면 자동 승인을 시도하지 않습니다.

권한을 추가하거나 변경할 때는 app manifest뿐 아니라 plugin을 포함한 merged manifest를 기준으로 동작한다는 점을 고려합니다. 자동 승인이 실패하면 `RemixPermissions` tag의 logcat을 확인합니다.

개발 기기가 아직 provision되지 않았고 계정이나 기존 owner가 없는 상태라면 Android의 `dpm set-device-owner`를 사용한 개발 설정을 검토할 수 있습니다.

```sh
adb shell dpm set-device-owner com.fainthit.remix/.RemixDeviceAdminReceiver
```

이 명령은 이미 설정이 완료된 일반 기기에서는 실패할 수 있습니다. Device Owner 해제나 factory reset은 기기 데이터를 잃을 수 있는 별도 운영 작업이므로, 전용 test device에서만 수행하고 이 문서의 일반 build 단계에 포함하지 않습니다.

## build 종류 구분

| build      | 용도                  | 특징                                             |
| ---------- | --------------------- | ------------------------------------------------ |
| debug      | native/Host 통합 개발 | packaged web asset, debug signing                |
| liveReload | 빠른 WebView 개발     | Vite URL, ADB reverse, cleartext 허용            |
| release    | 배포 후보             | production signing 설정과 keystore가 별도로 필요 |

release workflow가 만드는 debug APK artifact를 현장 배포용 signed APK로 취급하지 마세요. 공식 version 및 release 절차는 [릴리스](releasing.md)를 따릅니다.

## 관련 문서

- [저장소 개발](contributing.md)
- [Android project 배포](../getting-started/deploy-to-android.md)
- [기기 제어](../guides/device-control.md)
- [문제 해결](../guides/troubleshooting.md)
