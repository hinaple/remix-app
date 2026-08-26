# `.remixprj` 프로젝트 패키지

`.remixprj`는 remixApp Android Host가 설치하고 실행하는 ZIP archive입니다. APK가 아니며 source project 전체를 그대로 압축한 파일도 아닙니다. `remix-cli build`가 Host runtime 계약에 맞게 JavaScript, CSS, manifest와 resource를 정규화하여 만듭니다.

## source와 build 결과

예시 source project:

```text
airport-room/
├─ remix.config.ts
├─ src/
│  ├─ index.ts
│  ├─ style.css
│  └─ assets/
│     └─ logo.png
└─ resources/
   ├─ audio/
   │  └─ intro.wav
   └─ video/
      └─ opening.mp4
```

기본 build 결과:

```text
dist/airport-room-0.1.0.remixprj
```

archive 내부:

```text
project.json
src/
├─ index.js
├─ style.css
├─ runtime-C82JD.js       # code splitting이 있을 때
└─ logo-A72KD.png         # Vite가 처리한 asset
resources/
├─ audio/
│  └─ intro.wav
└─ video/
   └─ opening.mp4
```

archive root에 project 이름으로 된 중간 directory를 추가하지 않습니다.

잘못된 구조:

```text
airport-room/
├─ project.json
└─ src/
```

올바른 구조:

```text
project.json
src/
```

## 필수 파일

| 경로 | 역할 |
| --- | --- |
| `project.json` | Host가 읽는 정규화된 runtime manifest |
| `src/index.js` | Host가 dynamic import하는 ES module entry |
| `src/style.css` | project mount 전에 Host가 로드하는 stylesheet |

source project에 CSS가 없더라도 CLI는 빈 `src/style.css`를 생성합니다. Host는 임의의 source entry나 style 이름을 찾지 않고 위 고정 경로만 사용합니다.

## project.json

```json
{
  "formatVersion": 1,
  "runtimeApiVersion": 2,
  "builtWith": {
    "cli": "0.2.0",
    "sdk": "0.2.0"
  },
  "name": "airport-room",
  "version": "0.1.0",
  "entry": "src/index.js",
  "styles": ["src/style.css"],
  "kiosk": true,
  "screen": {
    "keepOn": true,
    "orientation": "portrait"
  },
  "input": {
    "captureBack": true
  }
}
```

CLI는 source config에서 Host에 필요한 값만 옮깁니다. source entry path, source style path와 Vite config는 runtime manifest에 포함하지 않습니다.

## 호환성 버전

### formatVersion

`.remixprj` archive layout과 `project.json` 형식의 버전입니다. 현재 값은 `1`입니다.

Host가 지원하는 값보다 크면 package가 더 새로운 형식이므로 거부합니다. 유효하지 않거나 지원 범위보다 오래된 값도 거부합니다.

### runtimeApiVersion

`RemixAppContext`, event와 action 계약의 버전입니다. 현재 SDK/Host runtime API는 `4`이며 현재 Host가 요구하는 최소 버전은 `2`입니다.

초기 compatibility field가 없던 package는 version `1`로 해석됩니다. 따라서 runtime API 2를 요구하는 현재 Host에서는 이전 package를 새 CLI로 다시 빌드해야 합니다.

runtime API 4부터 native event rule의 `activityState`를 지원하며 필드가 없으면 `always`로 해석합니다.

### builtWith

CLI와 SDK toolchain version을 장애 진단용으로 기록합니다. Host의 호환성 판정은 product SemVer가 아니라 `formatVersion`과 `runtimeApiVersion`을 기준으로 합니다.

이 세 필드는 CLI가 작성합니다. `remix.config.ts`에서 직접 지정하지 마세요.

## JavaScript와 CSS build

CLI는 temporary entry를 만들고 다음 순서로 source를 묶습니다.

1. config의 `styles`를 작성 순서대로 import합니다.
2. config의 `entry` export를 다시 export합니다.
3. Vite ES library build를 실행합니다.
4. entry를 `src/index.js`로 고정합니다.
5. 생성된 CSS 파일을 정렬하여 하나의 `src/style.css`로 합칩니다.
6. chunk와 import asset을 `src/` 아래에 둡니다.

필수 build 설정은 다음 계약을 유지합니다.

- relative base `./`
- ES2022 target과 ES module output
- `src/index.js` entry
- CSS code splitting 비활성화 후 단일 `src/style.css`
- chunk 및 asset의 relative path

project의 `vite` 설정은 병합되지만 이 계약을 깨는 output 설정은 CLI가 덮어쓸 수 있습니다.

## resources 복사

source root에 `resources/` directory가 있으면 전체 내용을 package root의 `resources/`로 복사합니다.

- filename과 extension을 유지합니다.
- directory hierarchy를 유지합니다.
- hash나 rename을 적용하지 않습니다.
- Vite transform 또는 bundling을 적용하지 않습니다.

`resources`라는 이름의 파일이 있고 directory가 아니면 build가 실패합니다. 자세한 사용법은 [resources 가이드](../guides/resources.md)를 참고하세요.

## build 작업 directory

CLI는 project root 아래에 임시 build 파일을 만듭니다.

```text
.remix/build/entry/
.remix/build/vite/
```

최종 결과는 `dist/`에 둡니다. 같은 name/version을 다시 build하면 해당 unpacked staging directory와 output archive를 새로 만듭니다. source `src/`와 `resources/`를 수정하지 않습니다.

## unpacked build 검사

```sh
remix-cli build --unpack
```

결과:

```text
dist/<name>-<version>-unpacked/
```

다음을 확인할 때 유용합니다.

- `project.json` 기본값과 compatibility version
- CSS가 `src/style.css`에 포함되었는지
- dynamic chunk와 import asset 경로
- `resources/`의 원래 path 보존
- archive root에 불필요한 directory가 없는지

unpacked directory 자체는 `.remixprj` 파일이 아니므로 Android deploy 입력으로 가정하지 마세요.

## Android 설치 구조

Host는 package를 app private storage의 staging directory에 unzip하고 active slot으로 교체합니다. ZIP entry가 staging directory 밖을 가리키는 path traversal은 canonical path 검사로 무시합니다.

filesystem active slot 교체 중 실패하면 가능한 경우 이전 directory를 복원합니다. 그러나 새 active package가 교체된 뒤 manifest, style 또는 module load에서 실패하는 경우를 위한 사용자-facing rollback 기능은 현재 제공하지 않습니다. 새 package는 build와 실제 Host load를 배포 전에 검증하세요.

## 현재 제외 범위

- package signing 및 signature verification
- encryption
- resource hashing
- delta update
- 여러 version 보관 및 선택
- load 실패 후 자동 rollback

## 관련 문서

- [아키텍처](architecture.md)
- [lifecycle](lifecycle.md)
- [프로젝트 설정](../reference/configuration.md)
- [resources](../guides/resources.md)
- [CLI](../reference/cli.md)
