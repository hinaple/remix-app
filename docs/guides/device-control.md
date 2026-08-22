# 기기 제어

프로젝트는 `context.device`로 화면, hardware input, media volume, 진동과 현재 기기 상태를 사용합니다. config의 고정 startup policy와 실행 중 context 호출을 구분하세요.

## startup policy와 runtime 제어

`remix.config.ts`는 project mount 전에 Host가 적용할 초기 정책입니다.

```ts
export default defineConfig({
  // ...
  kiosk: true,
  screen: {
    keepOn: true,
    autoBrightness: false,
    orientation: "portrait",
    timeout: 30000,
  },
  input: {
    capturedKeys: ["VOLUME_UP", "VOLUME_DOWN"],
    captureBack: true,
  },
});
```

`context.device`는 실행 중 scene이나 operator action에 따라 값을 바꿉니다.

```ts
await context.device.screen.setBrightness(0.35);
```

project 종료 시 Host는 project policy를 해제합니다. runtime 변경을 다음 project에 전달되는 global 상태로 사용하지 마세요.

## 화면 깨우기

```ts
await context.device.screen.wake();
```

Android Host는 Activity window flag와 짧은 wake lock으로 화면을 깨우도록 요청합니다. 기기 lock state, OS version과 device policy에 따라 최종 표시 동작이 다를 수 있습니다.

background event에서 즉시 화면을 깨워야 하면 JavaScript event handler가 아니라 `nativeEvents`의 첫 action으로 `device.screen.wake`를 사용합니다.

## 화면 켜짐 유지

```ts
await context.device.screen.setKeepOn(true);
```

Activity window의 keep-screen-on 상태를 바꿉니다. Host의 foreground service와 CPU wake lock은 별도 invariant이며 이 값으로 끄거나 켜지 않습니다.

## 밝기

```ts
await context.device.screen.setAutoBrightness(false);
await context.device.screen.setBrightness(0.7);
```

brightness는 `0`부터 `1`입니다. SDK action validation은 범위를 벗어나거나 유한하지 않은 값을 거부합니다.

Android Host는 app window brightness를 적용하고 가능한 경우 system brightness setting도 갱신합니다. system setting 권한 또는 device policy 제약에 따라 일부 동작이 실패하거나 제한될 수 있으므로 Promise 오류와 새 screen status를 확인합니다.

```ts
const status = await context.device.status.screen.get();
console.log(status.brightness, status.autoBrightness);
```

## 화면 방향

```ts
await context.device.screen.setOrientation("landscape");
```

지원 값:

```text
portrait | landscape | reversePortrait | reverseLandscape
sensor | fullSensor | locked | unspecified
```

`unspecified`는 Android가 기본 방향 결정을 다시 하도록 요청합니다. `locked`는 호출 시점 방향에 고정될 수 있습니다. 실제 device rotation과 Activity 재구성은 기기에서 확인합니다.

## 화면 timeout

```ts
await context.device.screen.setTimeout(30000);
```

단위는 ms이며 0 이상의 정수입니다. Host는 처음 timeout을 변경할 때 이전 system 값을 보관하고 다음 호출로 복원을 요청할 수 있습니다.

```ts
await context.device.screen.setTimeout(undefined);
```

system setting 변경 권한과 device policy에 따라 적용 또는 복원이 제한될 수 있습니다.

## 화면과 keyboard 상태

```ts
const screen = await context.device.status.screen.get();
const keyboard = await context.device.keyboard.get();
```

변화는 event로 받습니다.

```ts
context.events.on("device:status:screen", renderScreenStatus);
context.events.on("device:status:keyboard", ({ visible, height }) => {
  keyboardSpacer.style.height = visible ? `${height}px` : "0";
});
```

context event 구독은 project unmount 시 자동 정리됩니다. project 밖의 `visualViewport` 또는 window listener를 직접 추가했다면 cleanup에서 해제합니다.

## hardware key capture

config에서 초기 key를 정합니다.

```ts
input: {
  capturedKeys: ["VOLUME_UP", "VOLUME_DOWN"],
  captureBack: true,
}
```

runtime에 목록을 교체합니다.

```ts
await context.device.input.captureKeys(["VOLUME_UP"]);
await context.device.input.captureBack(true);
```

`captureKeys()`는 기존 목록에 추가하는 것이 아니라 교체합니다. 지원 key:

```text
BACK | VOLUME_UP | VOLUME_DOWN | POWER | HOME | MENU
```

event를 처리합니다.

```ts
context.events.on("device:key", ({ key, action }) => {
  if (key === "VOLUME_UP" && action === "down") {
    nextScene();
  }
});
```

long press에서 반복되는 Android key event는 Host capture 정책의 영향을 받을 수 있습니다. scene action은 `down`/`up` 중 하나를 선택하고 중복 호출에 안전하게 만듭니다.

## Android back

```ts
await context.device.input.captureBack(true);
```

capture가 활성화되면 `BACK` event를 project에 전달하고 Android 기본 back 동작을 막습니다. project가 이동 또는 admin UI 정책을 명시적으로 처리해야 합니다.

## media volume

```ts
const current = await context.device.audio.getVolume();
await context.device.audio.setVolume(0.5);
```

값은 `0`부터 `1`입니다. Android media stream의 단계 수에 따라 실제 값은 가장 가까운 system step으로 양자화될 수 있습니다.

volume을 임시로 바꿨다가 되돌려야 한다면 이전 값을 project state에 보관하고 적절한 scene 종료 시 복원합니다. Host project cleanup이 project 이전 media volume을 자동 복원한다고 가정하지 마세요.

## 진동

```ts
await context.device.vibration.trigger();
await context.device.vibration.trigger(500);
```

duration을 지정하면 1 이상의 정수 ms여야 합니다. 기기에 vibrator가 없거나 OS 정책상 진동이 제한되면 실제 feedback이 없을 수 있습니다.

## 오류 처리

device action은 Promise를 반환합니다. 연속 action에서 어느 단계가 실패했는지 남깁니다.

```ts
async function prepareScene(context: RemixAppContext): Promise<void> {
  await context.device.screen.setAutoBrightness(false);
  await context.device.screen.setBrightness(0.8);
  await context.device.audio.setVolume(0.6);
}

void prepareScene(context).catch((error) => {
  console.error("Failed to prepare scene", error);
});
```

browser 개발 Host는 가능한 동작을 simulation합니다. 실제 system brightness, timeout, kiosk, hardware key, volume step과 vibration은 Android 기기에서 검증합니다.

## 관련 문서

- [프로젝트 설정](../reference/configuration.md)
- [RemixAppContext](../reference/context.md)
- [이벤트와 상태](../reference/events.md)
- [nativeEvents](../reference/native-events.md)
- [Android Host 개발](../internals/android-development.md)
