# 첫 remixApp 프로젝트 만들기

이 가이드에서는 새 프로젝트를 생성하고 브라우저에서 실행한 다음, Android Host가 읽을 수 있는 `.remixprj` 파일로 빌드합니다.

## 사전 조건

- Node.js 20 이상
- npm, pnpm, Yarn 또는 Bun 중 하나

생성기는 실행에 사용한 package manager를 감지하여 의존성을 설치합니다. 감지하지 못하면 npm을 사용합니다.

## 프로젝트 생성

대화형 프롬프트로 이름과 버전을 입력합니다.

```sh
npm create @remixapp@latest
```

자동화하거나 값을 미리 정하려면 옵션으로 전달합니다.

```sh
npm create @remixapp@latest -- --name "Airport Room" --version 0.1.0
```

프로젝트 이름은 앞뒤 공백을 제거하고 소문자로 바꾸며, 연속된 공백은 `-`로 바꿉니다. 위 명령은 현재 디렉터리 아래에 `airport-room`을 생성합니다. 버전은 `0.1.0`과 같은 semantic version이어야 합니다.

생성되는 기본 구조는 다음과 같습니다.

```text
airport-room/
├─ package.json
├─ remix.config.ts
├─ tsconfig.json
└─ src/
   ├─ index.ts
   └─ style.css
```

이미 같은 이름의 디렉터리가 있으면 생성기가 확인을 요청합니다. `--force`는 확인을 생략하고 template과 이름이 같은 파일을 덮어쓸 수 있으므로 대상 디렉터리를 먼저 확인하세요. 기존 디렉터리의 관련 없는 파일을 자동으로 삭제하지는 않습니다.

## 개발 서버 실행

```sh
cd airport-room
npm run dev
```

개발 서버는 `remix.config.ts`를 읽고 프로젝트 entry의 `mount(container, context)`를 실행합니다. 브라우저 개발 Host는 화면 상태와 Host panel 등 개발에 필요한 API를 브라우저에서 확인할 수 있게 제공합니다. Android 고유 동작의 최종 결과는 실제 기기에서 다시 확인해야 합니다.

다른 기기에서 개발 서버에 접속하려면 다음과 같이 실행할 수 있습니다.

```sh
npm run dev -- --host
```

## 프로젝트 entry 작성

프로젝트 entry는 이름이 `mount`인 함수를 export해야 합니다.

```ts
import type { RemixAppMount } from "@remixapp/sdk";

export const mount: RemixAppMount = (container, context) => {
  const main = document.createElement("main");
  const button = document.createElement("button");

  main.append(`${context.project.name} ${context.project.version}`);
  button.textContent = "화면 켜기";
  button.addEventListener("click", () => {
    void context.device.screen.wake();
  });

  main.append(button);
  container.append(main);
};
```

기기 기능은 전달받은 `context`를 사용합니다. 프로젝트에서 Capacitor plugin이나 `@remixapp/core`를 직접 import하지 마세요.

## 상태 읽기와 변화 구독

현재 배터리 상태를 한 번 읽으려면 `get()`을 사용합니다. 이후 변화는 `context.events`로 구독합니다.

```ts
const battery = await context.device.status.battery.get();
console.log(battery.level, battery.charging);

context.events.on("device:status:battery", (nextBattery) => {
  console.log(nextBattery.level, nextBattery.charging);
});
```

`context.events`의 구독은 프로젝트 수명에 속합니다. Host가 프로젝트를 unmount할 때 자동으로 해제하므로 프로젝트가 실행되는 동안 계속 필요한 구독을 cleanup에 반복해서 넣을 필요는 없습니다. 반환되는 unsubscribe 함수는 프로젝트 실행 도중 해당 구독만 먼저 중단할 때 사용합니다.

반면 `window.addEventListener`, `setInterval`, 직접 생성한 WebSocket 또는 외부 라이브러리 구독처럼 context 밖에서 만든 자원은 자동 정리 대상이 아닙니다. 이런 자원은 `mount`가 반환하는 cleanup에서 반드시 해제합니다.

```ts
export const mount: RemixAppMount = (container) => {
  const onResize = () => console.log(window.innerWidth);
  const timer = window.setInterval(() => console.log("tick"), 1000);

  window.addEventListener("resize", onResize);

  return () => {
    window.removeEventListener("resize", onResize);
    window.clearInterval(timer);
  };
};
```

## 프로젝트 빌드

```sh
npm run build
```

빌드가 성공하면 다음과 같은 파일이 생성됩니다.

```text
dist/airport-room-0.1.0.remixprj
```

`.remixprj`는 Android APK나 독립 웹 애플리케이션이 아니라 Host가 설치하는 프로젝트 패키지입니다. 내부 구조를 확인하려면 다음 명령을 사용합니다.

```sh
npm run build:unpack
```

unpacked 결과의 핵심 구조는 다음과 같습니다.

```text
project.json
src/
├─ index.js
└─ style.css
resources/        # source에 있을 때만 포함
```

## 다음 단계

- [remixApp 아키텍처](../concepts/architecture.md)
- [`remix.config.ts` 설정](../reference/configuration.md)
- [`RemixAppContext` API](../reference/context.md)
- [`remix-cli` 명령](../reference/cli.md)
- [Android Host로 배포](deploy-to-android.md)
- [문제 해결](../guides/troubleshooting.md)
