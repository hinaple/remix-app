# resources 사용

`resources/`는 Vite가 transform하지 않고 filename과 directory 구조를 유지해야 하는 runtime 파일을 위한 directory입니다. 프로젝트에서는 `context.resources.url()`로 WebView에서 사용할 URL을 얻습니다.

## 언제 resources를 사용하는가

적합한 파일:

- 큰 video와 audio
- scene 또는 대사 data
- runtime에 path를 조합해 선택하는 이미지
- 원래 filename과 extension을 유지해야 하는 파일
- Vite import graph에 넣지 않을 파일

작은 icon, component와 항상 함께 쓰는 이미지, CSS font처럼 source code에서 정적으로 import하는 asset은 Vite asset으로 처리하는 편이 편할 수 있습니다.

## directory 구조

```text
airport-room/
├─ src/
│  └─ index.ts
└─ resources/
   ├─ audio/
   │  ├─ intro.wav
   │  └─ success.wav
   ├─ video/
   │  └─ opening.mp4
   └─ data/
      └─ scenes.json
```

build 후에도 같은 상대 구조가 유지됩니다.

```text
resources/
├─ audio/intro.wav
├─ audio/success.wav
├─ video/opening.mp4
└─ data/scenes.json
```

## URL 만들기

```ts
const introUrl = context.resources.url("audio/intro.wav");
```

인자는 `resources/` root 기준 상대 path입니다. 반환값은 browser/WebView API에 바로 전달할 수 있는 URL입니다. Android private filesystem path를 직접 조합하지 마세요.

항상 `/`를 사용하는 상대 path를 권장합니다.

```ts
context.resources.url("video/opening.mp4");
```

## audio와 video

```ts
const audio = new Audio(context.resources.url("audio/intro.wav"));
await audio.play();
```

```ts
const video = document.createElement("video");
video.src = context.resources.url("video/opening.mp4");
video.preload = "metadata";
video.controls = false;
video.playsInline = true;
container.append(video);
```

project cleanup에서 지속 중인 media를 중단하고 reference를 해제합니다.

```ts
return () => {
  video.pause();
  video.removeAttribute("src");
  video.load();
};
```

`context.resources.url()` 자체는 subscription이 아니므로 해제할 것은 없습니다. cleanup 대상은 project가 생성한 media 동작입니다.

## JSON과 text 읽기

```ts
const response = await fetch(context.resources.url("data/scenes.json"));

if (!response.ok) {
  throw new Error(`Failed to load scenes: ${response.status}`);
}

const scenes: unknown = await response.json();
```

fetch를 project 종료 시 취소해야 한다면 `AbortController`를 사용합니다.

```ts
export const mount: RemixAppMount = async (container, context) => {
  const controller = new AbortController();
  const response = await fetch(context.resources.url("data/scenes.json"), {
    signal: controller.signal,
  });

  render(container, await response.json());

  return () => controller.abort();
};
```

## 동적으로 path 선택

```ts
function sceneAudio(context: RemixAppContext, sceneId: string): string {
  const safeId = encodeURIComponent(sceneId);
  return context.resources.url(`audio/scenes/${safeId}.wav`);
}
```

path가 외부 입력에서 오면 허용 목록이나 안전한 ID 규칙을 사용합니다. `context.resources.url()`은 application-level 파일 존재 여부나 scene ID를 검증하지 않습니다.

## Vite asset과 차이

### resources

```ts
const url = context.resources.url("images/background.png");
```

- 원래 path 유지
- Vite hash 없음
- runtime string으로 선택 가능
- package의 `resources/`에 복사

### source import asset

```ts
import logoUrl from "./assets/logo.png";
```

- Vite import graph에 포함
- filename에 hash가 붙을 수 있음
- 최적화 또는 plugin transform 가능
- package의 `src/`에 build asset으로 배치

두 방식을 같은 파일에 섞지 말고 resource 수명과 선택 방식을 기준으로 정합니다.

## build와 개발 서버

`remix-cli build`는 source root의 `resources/`를 그대로 복사합니다. directory가 없으면 package에도 만들지 않습니다. `resources`가 directory가 아닌 파일이면 build가 실패합니다.

```sh
remix-cli build --unpack
```

unpacked output에서 실제 파일과 대소문자를 확인할 수 있습니다. Windows에서는 대소문자 오류가 드러나지 않다가 Android에서 문제가 될 수 있으므로 code path와 실제 filename을 정확히 맞춥니다.

개발 서버에서는 project root의 `resources/` URL을 사용합니다. 새 파일 또는 변경 파일이 browser에서 보이더라도 Android package에는 새 build와 deploy가 필요합니다.

## performance 지침

- 큰 media를 한꺼번에 fetch하여 memory에 올리지 말고 `<audio>`/`<video>` URL streaming을 우선합니다.
- 동일 파일을 반복 fetch할 필요가 있는지 browser cache 동작을 확인합니다.
- scene 전환 시 더 이상 쓰지 않는 media 재생과 decoder resource를 해제합니다.
- 수백 MB package는 build ZIP, ADB 전송, unzip 시간이 늘어납니다.
- resource hashing과 delta update는 현재 제공되지 않으므로 file 변경 시 package 전체를 다시 배포합니다.

## 흔한 문제

### Android에서만 404 또는 load 실패

- filename 대소문자를 확인합니다.
- `resources/` 기준 상대 path인지 확인합니다.
- unpacked build에 파일이 실제 포함됐는지 확인합니다.
- 이전 `.remixprj`를 `--no-build`로 배포하지 않았는지 확인합니다.

### Vite import asset과 URL이 다름

import asset의 build URL을 `context.resources.url()`에 다시 넣지 않습니다. 두 API는 서로 다른 package root를 사용합니다.

### media 재생이 시작되지 않음

URL load 오류와 browser autoplay 제한을 구분합니다. 사용자 입력 handler에서 `play()`를 호출하고 Promise rejection을 기록합니다.

## 관련 문서

- [project package](../concepts/project-package.md)
- [RemixAppContext](../reference/context.md)
- [문제 해결](troubleshooting.md)
