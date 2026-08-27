# @remixapp/cli

## 0.3.0

### Minor Changes

- 3b5e5da: Add per-rule native event `activityState` control with `always` as the default for newly built projects.
- 20c7c35: 안정적인 프로젝트 ID와 기기별 프로젝트 Constants를 추가하고, Host의 override 관리, 필수 값 검증, 런타임 설정 템플릿 및 `context.constants`를 지원합니다.
- 20c7c35: SDK, 개발 런타임 및 Android Host 전반에 단발, 패턴, 프리셋, 세기, 반복 재생 및 명시적 중지를 지원하는 진동 제어를 추가합니다.

### Patch Changes

- Updated dependencies [3b5e5da]
- Updated dependencies [20c7c35]
- Updated dependencies [20c7c35]
  - @remixapp/sdk@0.3.0

## 0.2.0

### Minor Changes

- Add native MQTT, namespaced events, the shared action contract, and paused-Activity native event rules.

  Projects built by this release require runtime API 2. Rebuild older project
  packages before installing them into Host 0.2.

### Patch Changes

- Updated dependencies
  - @remixapp/sdk@0.2.0
