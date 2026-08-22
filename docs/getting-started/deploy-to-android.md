# Android Host로 프로젝트 배포

이 가이드에서는 개발 PC에서 빌드한 `.remixprj`를 ADB로 연결된 Android 기기의 remixApp Host에 설치하고 실행합니다. 현재 `remix-cli deploy`는 개발 및 현장 점검용 ADB 배포 흐름입니다.

## 준비할 것

- Android 기기에 설치된 개발용 remixApp Host
- 기기에서 활성화한 개발자 옵션과 USB debugging
- PC에 설치된 Android SDK platform-tools
- `adb devices`에서 `device` 상태로 보이는 기기
- 빌드 가능한 remixApp 프로젝트

Host application ID는 `com.fainthit.remix`입니다. 현재 CLI는 `run-as com.fainthit.remix`를 사용해 Host private directory에 package를 복사하므로, 이 명령을 허용하는 개발용 Host build가 설치되어 있어야 합니다.

## 기기 연결 확인

PowerShell 또는 terminal에서 다음 명령을 실행합니다.

```sh
adb devices -l
```

정상적인 예:

```text
List of devices attached
R3CN30ABCDE  device product:... model:... device:...
```

상태가 `unauthorized`라면 기기 화면의 USB debugging 승인 창을 확인합니다. `offline`이거나 목록에 없다면 USB cable, USB mode, driver와 ADB server를 차례로 확인합니다.

ADB가 `PATH`에 없으면 PowerShell에서 위치를 지정할 수 있습니다.

```powershell
$env:REMIXAPP_ADB = "C:\Users\me\AppData\Local\Android\Sdk\platform-tools\adb.exe"
```

CLI는 `REMIXAPP_ADB`, `ADB`, `ANDROID_HOME`, `ANDROID_SDK_ROOT`, Windows Android SDK 기본 위치, `PATH` 순서로 실행 가능한 ADB를 찾습니다.

## 기본 배포

프로젝트 루트에서 실행합니다.

```sh
npm run deploy
```

또는 CLI를 직접 실행합니다.

```sh
remix-cli deploy
```

기본 흐름은 다음과 같습니다.

1. 현재 `remix.config.ts/js`를 사용해 프로젝트를 빌드합니다.
2. `dist/<name>-<version>.remixprj`를 기기의 임시 경로로 전송합니다.
3. Host private import directory로 package를 복사합니다.
4. package를 staging directory에 unpack합니다.
5. 기존 active project를 새 project로 교체합니다.
6. Host의 `MainActivity`를 package install intent와 함께 시작합니다.

성공하면 CLI에 다음과 비슷한 메시지가 표시됩니다.

```text
Deployed ...\dist\airport-room-0.1.0.remixprj to R3CN30ABCDE
```

## 여러 기기 중 선택

연결된 기기가 하나면 자동으로 선택합니다. 둘 이상이면 대화형 terminal에서 번호 목록을 표시합니다.

자동화, CI 또는 특정 기기를 고정하려면 serial을 지정합니다.

```sh
remix-cli deploy --device R3CN30ABCDE
```

serial은 `adb devices -l`의 첫 번째 열과 정확히 같아야 합니다.

## 기존 build 배포

이미 만든 package를 다시 배포하려면 build를 생략할 수 있습니다.

```sh
remix-cli deploy --no-build
```

CLI는 현재 config의 `name`과 `version`으로 다음 파일을 찾습니다.

```text
dist/<name>-<version>.remixprj
```

파일이 없으면 실패합니다. source 또는 config를 변경한 뒤 `--no-build`를 사용하면 이전 결과를 배포할 수 있으므로, 재현하려는 package가 명확할 때만 사용하세요.

## 다른 디렉터리의 프로젝트 배포

```sh
remix-cli deploy --cwd D:\projects\airport-room --device R3CN30ABCDE
```

`--cwd`는 `remix.config.ts` 또는 `remix.config.js`가 있는 프로젝트 루트를 가리켜야 합니다.

## 배포 후 확인

Host가 시작되지 않았다면 Activity를 직접 실행해 확인할 수 있습니다.

```sh
adb -s R3CN30ABCDE shell am start -n com.fainthit.remix/.MainActivity
```

Android log를 확인합니다.

```sh
adb -s R3CN30ABCDE logcat
```

Windows PowerShell에서 remixApp 관련 행을 좁혀 볼 수 있습니다.

```powershell
adb -s R3CN30ABCDE logcat | Select-String -Pattern "remix|RemixCore|Capacitor"
```

WebView JavaScript 오류는 debug Host를 Chrome의 `chrome://inspect/#devices`에서 연결해 Console과 Network panel로 확인합니다.

## 실패할 때

### ADB device를 찾지 못함

```text
No connected adb devices found.
```

`adb devices -l`을 직접 실행하고 기기가 `device` 상태인지 확인합니다. CLI는 `unauthorized`와 `offline` 기기를 선택 목록에 포함하지 않습니다.

### 여러 기기가 연결된 비대화형 환경

```text
Multiple Android devices are connected. Specify one with --device <serial>.
```

`--device`를 명시합니다.

### `run-as` 실패

설치된 `com.fainthit.remix`가 `run-as` 접근을 허용하는 개발 build인지 확인합니다. production-signing 또는 non-debuggable Host에 대한 일반 배포 채널로 `remix-cli deploy`를 가정하면 안 됩니다.

### Host package가 설치되지 않음

저장소에서 Host를 개발 중이라면 [Android Host 개발](../internals/android-development.md)의 build/install 절차를 먼저 수행합니다.

### package를 찾지 못함

`--no-build`를 제거하거나 먼저 `npm run build`를 실행합니다. config의 `name` 또는 `version`을 바꿨다면 출력 filename도 바뀝니다.

## 배포 범위

현재 이 문서가 설명하는 것은 USB 또는 network ADB가 연결된 개발 기기에 대한 project deploy입니다. 다음 항목은 별도의 운영 배포 체계가 필요한 영역입니다.

- production signing Host APK 배포
- Device Owner QR provisioning payload 생성
- 원격 project 전송 또는 OTA
- project signing, encryption, rollback

Host에는 Device Admin receiver와 provisioning activity가 있지만, 현재 CLI는 production QR 생성이나 원격 release 다운로드를 제공하지 않습니다.

## 관련 문서

- [빠른 시작](quick-start.md)
- [CLI](../reference/cli.md)
- [Android Host 개발](../internals/android-development.md)
- [문제 해결](../guides/troubleshooting.md)
