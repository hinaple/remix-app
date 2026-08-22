# Host panel 제어

`context.host.panel`은 remixApp Host의 admin panel에 project별 상태와 operator action을 표시합니다. 일반 project UI와 분리된 진단·운영 control에 사용합니다.

## 구성

```text
context.host.panel
├─ status
│  ├─ set(items)
│  ├─ setText(id, text)
│  ├─ remove(id)
│  └─ clear()
└─ buttons
   ├─ set(buttons)
   └─ clear()
```

Host panel은 project container 밖의 Host UI입니다. project code가 DOM selector로 직접 접근하지 않고 context API를 사용합니다.

## 상태 목록 설정

```ts
context.host.panel.status.set([
  {
    id: "scene",
    label: "Scene",
    text: "Lobby",
  },
  {
    id: "mqtt",
    label: "MQTT",
    text: "Connecting",
  },
]);
```

각 status item:

| 필드 | 설명 |
| --- | --- |
| `id` | 이후 update/remove에 사용하는 project 내부 식별자 |
| `label` | operator에게 보이는 항목 이름 |
| `text` | 현재 값 |

`set()`은 기존 project status 목록 전체를 교체합니다. 여러 module이 각각 `set()`을 호출하면 마지막 호출의 목록만 남으므로, 한 곳에서 전체 panel model을 관리하거나 이후에는 `setText()`를 사용합니다.

## 상태 text 갱신

```ts
context.host.panel.status.setText("scene", "Runway");
```

존재하지 않는 `id`는 새 항목을 만들지 않고 무시됩니다. 먼저 `set()`으로 항목을 등록하세요.

## 상태 제거와 초기화

```ts
context.host.panel.status.remove("mqtt");
context.host.panel.status.clear();
```

`remove()`는 하나의 `id`, `clear()`는 project status 전체를 제거합니다.

## 버튼 설정

```ts
context.host.panel.buttons.set([
  {
    label: "Wake screen",
    action: () => context.device.screen.wake(),
  },
  {
    label: "Reset project",
    action: () => context.project.reset(),
  },
]);
```

`set()`은 기존 button 목록을 교체합니다. button을 누르면 Host는 action이 완료될 때까지 해당 button을 비활성화합니다.

action이 성공하면 Host status에 완료 메시지를 표시하고, 실패하면 오류를 Host error 영역과 Console에 기록합니다. action 안에서 오류를 숨기지 않고 throw/reject하면 operator가 실패를 확인할 수 있습니다.

```ts
context.host.panel.buttons.set([
  {
    label: "Reconnect scene",
    action: async () => {
      await reconnectScene();
      context.host.panel.status.setText("scene", "Connected");
    },
  },
]);
```

## button 제거

```ts
context.host.panel.buttons.clear();
```

빈 배열로 교체할 수도 있습니다.

```ts
context.host.panel.buttons.set([]);
```

## event와 상태 연결

```ts
context.host.panel.status.set([
  { id: "battery", label: "Battery", text: "Reading..." },
  { id: "network", label: "Network", text: "Reading..." },
]);

context.events.on("device:status:battery", ({ level, charging }) => {
  const percent = Math.round(level * 100);
  context.host.panel.status.setText(
    "battery",
    `${percent}%${charging ? " charging" : ""}`,
  );
});

context.events.on("device:status:network", ({ connected, type }) => {
  context.host.panel.status.setText(
    "network",
    connected ? `Connected (${type})` : "Offline",
  );
});
```

위 context event 구독은 project 종료 시 자동 해제됩니다.

## project lifecycle

Host는 project reset, 교체 또는 stop 시 project-owned status와 button을 자동으로 지웁니다. 따라서 project가 실행되는 동안 계속 표시할 panel을 cleanup에서 반드시 `clear()`할 필요는 없습니다.

실행 중 특정 mode가 끝나 panel을 먼저 숨기고 싶을 때만 `remove()` 또는 `clear()`를 호출합니다.

panel button의 callback에 연결한 외부 client나 timer가 있다면 해당 외부 resource는 project cleanup에서 별도로 해제합니다. Host가 panel DOM을 지우는 것과 callback이 참조한 외부 resource 수명은 같지 않습니다.

## nativeEvents에서 panel 사용

serializable한 status action은 nativeEvents에서 사용할 수 있습니다.

```ts
{
  type: "host.panel.status.setText",
  args: { id: "mqtt", text: "Message received" },
}
```

이 action은 WebView executor이므로 Activity가 resume될 때까지 기다립니다. `expiresIn` 전에 resume하지 않으면 폐기될 수 있습니다.

`host.panel.buttons.set`은 JavaScript callback을 포함하므로 nativeEvents에서 사용할 수 없습니다. `host.panel.buttons.clear`는 callback 인자가 없어 사용할 수 있습니다.

## browser 개발 Host

`remix-cli dev`는 browser 안에 Host panel simulation을 표시합니다. button action, status update와 reset 흐름을 확인할 수 있습니다. 실제 기기의 admin page 전환과 hardware key 진입 방식은 Android Host에서 확인합니다.

## 사용 지침

- player-facing UI 대신 operator용 상태와 복구 action에 사용합니다.
- `id`는 화면 label과 분리된 안정적인 값으로 정합니다.
- 빠르게 변하는 raw event를 모두 표시하지 말고 진단에 필요한 상태로 요약합니다.
- destructive action은 label을 명확히 하고 project 내부에서 추가 확인이 필요한지 검토합니다.
- button action은 중복 호출에 안전하게 작성합니다. Host는 같은 button을 실행 중 disable하지만 다른 경로의 호출까지 막지는 않습니다.

## 관련 문서

- [RemixAppContext](../reference/context.md)
- [이벤트와 상태](../reference/events.md)
- [nativeEvents](../reference/native-events.md)
- [lifecycle](../concepts/lifecycle.md)
