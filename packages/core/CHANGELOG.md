# @remixapp/core

## 0.3.1

## 0.3.0

### Minor Changes

- 3b5e5da: Add per-rule native event `activityState` control with `always` as the default for newly built projects.
- 20c7c35: 안정적인 프로젝트 ID와 기기별 프로젝트 Constants를 추가하고, Host의 override 관리, 필수 값 검증, 런타임 설정 템플릿 및 `context.constants`를 지원합니다.
- 20c7c35: SDK, 개발 런타임 및 Android Host 전반에 단발, 패턴, 프리셋, 세기, 반복 재생 및 명시적 중지를 지원하는 진동 제어를 추가합니다.

### Patch Changes

- 20c7c35: Android 화면 깨우기 동작을 수정하고, Host가 Device Owner로 프로비저닝된 경우 선언된 위험 권한을 자동으로 허용합니다.
- 20c7c35: Host 런타임, MQTT 및 native event 설정이 동일한 활성 프로젝트 manifest를 사용하도록 조회 경로를 native core 저장소로 통합합니다.

## 0.2.0

### Minor Changes

- Add native MQTT, namespaced events, the shared action contract, and paused-Activity native event rules.

  Host 0.2 implements runtime API 2 and rejects older project runtime contracts
  instead of loading them as compatible.
