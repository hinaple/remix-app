# 프로젝트 lifecycle

remixApp project lifecycle은 package 설치, Host load, project `mount`, Android Activity pause/resume, reset 또는 교체에 따른 `unmount`로 구성됩니다. project cleanup과 context 자동 정리의 경계를 이해하면 reset과 hot reload에서도 남는 listener나 timer를 방지할 수 있습니다.

## lifecycle 개요

```text
.remixprj install
      │
      ▼
active project 선택
      │
      ▼
manifest 검증 → policy 적용 → style/module load
      │
      ▼
mount(container, context)
      │
      ├── Activity paused / resumed
      │
      ├── context.project.reset()
      │          │
      │          └── stop → 같은 package start
      │
      └── project 교체 / Host 종료
                 │
                 ▼
destroyed event → project cleanup → context/Host cleanup
```

## 설치와 active project

Android Host의 package import는 다음 filesystem slot을 사용합니다.

```text
files/remix/projects/
├─ staging/
├─ active/
└─ previous/
```

새 package를 staging에 unpack한 뒤 기존 active를 previous로 옮기고 staging을 active로 바꿉니다. slot 교체가 끝나면 previous는 삭제되고 native foreground runtime이 active manifest를 다시 읽습니다.

이 단계는 project JavaScript가 실행되기 전입니다. package 교체 성공이 `mount()` 성공까지 의미하지는 않습니다.

## Host start 순서

Android Host의 project runtime은 다음 순서로 시작합니다.

1. 기존 project가 있으면 먼저 stop합니다.
2. base URL을 정규화합니다.
3. `project.json`을 fetch합니다.
4. manifest shape와 compatibility version을 검증합니다.
5. project별 subscription scope와 event bus를 만듭니다.
6. native status, lifecycle, MQTT와 action bridge를 연결합니다.
7. manifest의 project policy를 적용합니다.
8. keyboard layout과 Shadow DOM mount host를 준비합니다.
9. `src/style.css`를 load합니다.
10. cache-buster가 붙은 `src/index.js`를 dynamic import합니다.
11. `mount(container, context)`를 await합니다.
12. 반환값이 함수면 cleanup으로 보관합니다.
13. native runtime에 mounted 상태를 알리고 `project:lifecycle: mounted`를 emit합니다.

project는 Shadow DOM 안의 전용 `<section data-remix-project-mount>`에 mount됩니다. Host admin UI나 Host root를 직접 소유하지 않습니다.

## mount 계약

```ts
export type RemixAppMount = (
  container: HTMLElement,
  context: RemixAppContext,
) =>
  | void
  | Promise<void>
  | RemixAppUnmount
  | Promise<RemixAppUnmount>;
```

동기 예:

```ts
export const mount: RemixAppMount = (container) => {
  const root = document.createElement("main");
  container.append(root);
};
```

비동기 초기화와 cleanup:

```ts
export const mount: RemixAppMount = async (container) => {
  const controller = new AbortController();
  const response = await fetch("https://example.com/state", {
    signal: controller.signal,
  });
  const root = document.createElement("main");
  root.textContent = await response.text();
  container.append(root);

  return () => {
    controller.abort();
  };
};
```

`mount`가 reject하거나 throw하면 project start가 실패하고 Host는 생성된 context subscription, policy, style과 mount host를 정리한 뒤 오류를 표시합니다.

## Android Activity lifecycle

project가 mounted된 동안 Activity 상태는 `context.events`로 전달됩니다.

```ts
context.events.on("project:lifecycle", ({ state }) => {
  if (state === "paused") pauseVisualEffects();
  if (state === "resumed") resumeVisualEffects();
});
```

| 상태 | 원천 |
| --- | --- |
| `mounted` | project `mount()` 성공 후 Host runtime |
| `paused` | Android plugin `handleOnPause()` |
| `resumed` | Android plugin `handleOnResume()` |
| `destroyed` | project runtime stop 시작 |

Activity pause는 project unmount가 아닙니다. project DOM과 JavaScript context는 유지됩니다. native foreground service와 MQTT connection도 별도 lifecycle로 계속 동작할 수 있습니다.

WebView가 inactive일 때 실행되어야 하는 제한된 action은 [nativeEvents](../reference/native-events.md)를 사용합니다.

## stop과 unmount 순서

project reset, 교체 또는 Host exit 시 다음 순서로 stop합니다.

1. runtime이 current project 참조를 비웁니다.
2. native runtime mounted state를 `false`로 바꿉니다.
3. `project:lifecycle`의 `destroyed`를 emit합니다.
4. project `mount`가 반환한 cleanup을 await합니다.
5. context subscription scope를 일괄 정리합니다.
6. keyboard layout을 dispose합니다.
7. kiosk, input, orientation, keyboard, timeout, system UI와 screen policy를 해제합니다.
8. project가 만든 Host panel 내용을 지웁니다.
9. project stylesheet와 mount container 내용을 제거합니다.

cleanup이 throw하더라도 Host는 `finally` chain을 통해 context와 Host-owned 자원 정리를 계속 시도합니다. project cleanup error 자체는 여전히 호출한 reset/stop 흐름의 실패 원인이 될 수 있으므로 cleanup은 반복 호출에 안전하고 가능한 한 실패하지 않게 작성합니다.

## 자동 정리되는 것

Host project scope가 소유하므로 unmount 시 자동으로 정리됩니다.

- `context.events.on()` 구독
- 해당 event source가 연 status listener와 native plugin listener
- project-owned Host panel 내용
- Host가 load한 `src/style.css`
- project mount container의 DOM
- manifest 및 runtime 호출로 적용된 project policy
- Host keyboard layout helper

프로젝트가 실행되는 동안 계속 필요한 context event 구독을 cleanup에 따로 모을 필요는 없습니다.

## 프로젝트가 직접 정리할 것

context 밖에서 project code가 만든 자원은 Host subscription scope에 등록되지 않습니다.

- `window`/`document` global listener
- interval, long timeout, `requestAnimationFrame` loop
- WebSocket, EventSource, 직접 생성한 MQTT client
- external store/event emitter subscription
- observer (`ResizeObserver`, `MutationObserver`, `IntersectionObserver`)
- MediaStream, AudioContext 등 명시적 종료가 필요한 browser resource

```ts
export const mount: RemixAppMount = (container, context) => {
  context.events.on("device:key", handleDeviceKey); // Host가 자동 정리

  const observer = new ResizeObserver(layout);
  observer.observe(container);

  const timer = window.setInterval(updateClock, 1000);

  return () => {
    observer.disconnect();
    window.clearInterval(timer);
  };
};
```

## reset

```ts
await context.project.reset();
```

reset은 현재 base URL을 보관한 뒤 완전한 `stop()`과 `start()`를 실행합니다. 다음 값은 새로 만들어집니다.

- mount container 내용
- `RemixAppContext`
- event bus와 subscription scope
- runtime status bridge
- project module import URL의 cache-buster

module-level state가 bundler/browser module cache 때문에 항상 초기화된다고 가정하지 마세요. reset의 확실한 초기화 경계는 `mount`가 만든 instance state와 cleanup된 외부 resource입니다. 완전한 초기 상태가 필요하면 mount 시 명시적으로 구성합니다.

## browser dev와 HMR

`remix-cli dev`에서 entry module이 HMR로 갱신되면 browser 개발 Host도 기존 project를 stop하고 새 module을 mount합니다. cleanup과 context subscription 자동 정리는 Android runtime과 같은 순서를 따릅니다.

browser dev의 pause/resume, native policy와 MQTT는 simulation 또는 unsupported 동작이므로 Android lifecycle 최종 검증을 대체하지 않습니다.

## 관련 문서

- [아키텍처](architecture.md)
- [project package](project-package.md)
- [이벤트와 상태](../reference/events.md)
- [nativeEvents](../reference/native-events.md)
- [문제 해결](../guides/troubleshooting.md)
