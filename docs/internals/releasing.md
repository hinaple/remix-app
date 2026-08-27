# remixApp 릴리스

이 문서는 remixApp toolchain의 버전을 준비하고 검증한 뒤 npm과 GitHub에 배포하는 저장소 관리자용 가이드입니다. 일반 프로젝트의 `.remixprj` package를 Android Host에 배포하려면 [Android Host로 프로젝트 배포](../getting-started/deploy-to-android.md)를 사용하세요.

## 전체 흐름

릴리스는 `develop`에서 준비하고 `main`에 병합한 뒤 GitHub Actions에서 배포합니다.

```text
기능 개발과 changeset 작성
  → develop commit/push
  → release:start로 버전 생성과 전체 검증
  → release/<version> → main PR
  → PR CI와 병합
  → main Release workflow
  → npm package, GitHub Release, debug APK artifact
```

branch별 책임은 다음과 같습니다.

| branch | 책임 |
| --- | --- |
| `develop` | 기능 변경과 pending changeset, 검증된 release commit을 보관합니다. |
| `release/<version>` | release PR의 head를 특정 검증 commit으로 고정합니다. |
| `main` | 병합된 release commit을 기준으로 npm과 GitHub 배포를 시작합니다. |

개발자가 실행하는 기본 순서는 다음과 같습니다.

```sh
pnpm changeset
pnpm changeset:status
pnpm release:start --dry-run
pnpm release:start
```

`release:start` 전에는 source 변경과 changeset을 commit하고 `develop`에 push합니다. 이미 해당 변경의 changeset이 commit되어 있다면 `pnpm changeset`을 다시 실행하지 않습니다.

## 버전 모델

공식 toolchain package는 하나의 SemVer를 공유합니다.

| package | npm 배포 | 역할 |
| --- | --- | --- |
| `@remixapp/app` | 아니요 | Android Host app |
| `@remixapp/cli` | 예 | 프로젝트 개발·build·deploy CLI |
| `@remixapp/core` | 예 | Capacitor plugin과 Android native 구현 |
| `@remixapp/runtime` | 아니요 | Host와 CLI의 내부 runtime |
| `@remixapp/sdk` | 예 | 프로젝트 공개 API |
| `@remixapp/create` | 예 | 프로젝트 생성기 |

Changesets의 `fixed` group이 이 package들을 lockstep으로 관리합니다. changeset에서 일부 package만 선택해도 릴리스할 때 공식 package 전체가 같은 버전으로 맞춰집니다.

toolchain 버전이 바뀌면 다음 값도 함께 동기화됩니다.

- root `package.json` 버전
- CLI의 SDK와 runtime 내부 의존성 버전
- 기본 template의 CLI와 SDK 범위
- SDK의 `REMIX_TOOLCHAIN_VERSION`
- Android `versionName`
- Android `versionCode`

Android `versionName`은 toolchain SemVer와 같고, `versionCode`는 product version이 바뀔 때 1 증가합니다. package version이나 `packages/app/android/version.properties`를 개별적으로 수정하지 마세요.

프로젝트의 `remix.config.ts` 버전은 toolchain 버전과 별개입니다. `project.json`의 `formatVersion`과 `runtimeApiVersion`도 각각 package format과 runtime API 호환성을 나타내므로 일반적인 product SemVer 변경만으로 올리지 않습니다.

## changeset 작성

사용자에게 보이는 package 변경에는 changeset을 추가합니다.

```sh
pnpm changeset
```

명령은 다음 내용을 대화형으로 입력받습니다.

1. 변경된 package
2. `patch`, `minor`, `major` 중 bump 종류
3. changelog에 기록할 변경 요약

입력을 마치면 `.changeset/*.md` 파일이 생성됩니다. 이 파일은 아직 버전과 changelog에 반영되지 않은 pending changeset이며, 실제 versioning이나 npm 배포는 수행하지 않습니다. 생성된 파일은 기능 변경과 함께 commit하고 `develop`에 push합니다.

버전 종류는 다음 기준으로 선택합니다.

| 종류 | 예 | 기준 |
| --- | --- | --- |
| `patch` | `0.2.0` → `0.2.1` | 호환되는 수정 |
| `minor` | `0.2.0` → `0.3.0` | 새 기능 또는 `0.x` 기간의 breaking change |
| `major` | `0.2.0` → `1.0.0` | 안정화 이후의 명시적인 breaking release |

breaking change는 changeset 요약에 영향과 필요한 대응을 분명하게 적습니다. 배포 package에 영향을 주지 않는 저장소 내부 문서나 운영 설정만 바뀌었다면 changeset이 필요하지 않을 수 있습니다.

pending changeset을 확인합니다.

```sh
pnpm changeset:status
```

pending changeset 없이 `pnpm release:start`를 실행하면 명령은 중단되고 `pnpm changeset` 실행을 안내합니다.

## 릴리스 전 준비

`release:start`를 실행하기 전에 다음 조건을 모두 만족해야 합니다.

- 현재 branch가 `develop`입니다.
- 모든 source 변경과 changeset을 commit했습니다.
- worktree에 staged, unstaged, untracked 변경이 없습니다.
- 로컬 `develop` HEAD가 `origin/develop`과 정확히 같습니다.
- `main`에만 존재하고 `develop`에 반영되지 않은 변경이 없습니다.
- 진행 중인 다른 release PR과 같은 버전의 원격 release branch가 없습니다.
- GitHub CLI를 설치하고 현재 repository에 인증했습니다.
- Android SDK와 JDK를 포함한 release gate 실행 환경을 준비했습니다.

GitHub CLI 인증은 최초 한 번 수행합니다.

```sh
gh auth login
```

Android SDK 위치는 `ANDROID_HOME`, `ANDROID_SDK_ROOT` 또는 `packages/app/android/local.properties`로 확인할 수 있어야 합니다. `release:start`는 격리 worktree에서 Android build를 실행할 때 현재 checkout의 `local.properties`를 복사합니다.

GitHub Release workflow에는 npm 배포 권한이 있는 `NPM_TOKEN` repository secret이 필요합니다. workflow는 Windows에서 Changesets가 사용할 home directory를 별도로 설정합니다.

## 로컬 검증

전체 release gate를 직접 실행합니다.

```sh
pnpm release:check
```

검증 항목은 다음과 같습니다.

- lockstep package, root, template, SDK, Android 버전 정합성
- pending changeset이 있을 때 plan 유효성
- SDK와 core package 계약 build
- 전체 workspace typecheck와 production build
- 공개 npm package manifest와 license 경계
- production dependency audit
- 공개 package tarball 생성과 개수
- `@remixapp/create` 테스트
- unpack된 example의 manifest
- Capacitor Android sync
- Android debug APK build

이 검증은 일반적인 feature-local 검사보다 오래 걸립니다. release script 변경, public package 변경 또는 실제 릴리스 직전의 최종 gate로 사용합니다.

버전 관련 값이 어긋났다면 자동 동기화를 실행한 뒤 변경 내용을 검토합니다.

```sh
pnpm release:sync
pnpm release:check
```

## 릴리스 계획 미리보기

실제 변경 전에 release preflight와 다음 버전을 확인합니다.

```sh
pnpm release:start --dry-run
```

이 명령은 다음 작업만 수행합니다.

- `origin/main`과 `origin/develop` fetch
- branch, clean worktree, 원격 동기화 상태 확인
- GitHub CLI 인증과 기존 release PR 확인
- pending changeset을 이용한 다음 lockstep 버전 계산
- package 목록, bump 종류와 release note 출력

release 파일, commit, push, PR은 만들지 않습니다. 다만 원격 상태를 검증하기 위해 remote-tracking ref는 갱신합니다.

## 릴리스 시작

계획을 확인한 뒤 릴리스를 시작합니다.

```sh
pnpm release:start
```

명령은 계산된 버전과 changeset 요약을 출력하고 다음 확인을 요청합니다.

```text
Start the <version> release? [y/N]
```

`y` 또는 `yes`를 입력하면 다음 작업을 수행합니다.

1. 현재 `develop` commit에서 격리된 임시 Git worktree를 만듭니다.
2. frozen lockfile로 의존성을 설치합니다.
3. pending changeset을 package 버전과 changelog에 반영합니다.
4. root, CLI 의존성, template, SDK 상수와 Android 버전을 동기화합니다.
5. lockfile을 새 버전에 맞춥니다.
6. versioning 결과에서 전체 release gate를 실행합니다.
7. release allowlist 밖의 파일이 바뀌지 않았는지 확인합니다.
8. `chore: release <version>` commit을 만듭니다.
9. 원격 `main`과 `develop`이 준비 중 변경되지 않았는지 다시 확인합니다.
10. 로컬 `develop`을 검증된 commit으로 fast-forward합니다.
11. `develop`과 `release/<version>`을 하나의 atomic push로 갱신합니다.
12. `release/<version>`에서 `main`으로 향하는 PR을 생성합니다.
13. PR의 title, base, head branch와 head SHA가 예상값과 같은지 검증합니다.
14. 기본적으로 merge commit 방식의 Auto-merge 등록을 시도합니다.

versioning 단계에서 허용되는 변경은 package version과 changelog, 사용한 changeset 삭제, root lockfile, template dependency, SDK version 상수, Android version 파일입니다. 다른 tracked 파일이 바뀌면 release commit을 만들지 않습니다.

스크립트는 PR을 만들고 Auto-merge를 등록한 뒤 종료합니다. PR CI, 실제 병합과 npm 배포가 끝날 때까지 terminal에서 기다리지는 않습니다.

### 옵션

| 옵션 | 동작 |
| --- | --- |
| `--dry-run` | preflight와 release plan만 확인합니다. |
| `--yes` | terminal 확인 질문을 생략합니다. CI나 비대화형 환경에서 사용합니다. |
| `--no-auto-merge` | Auto-merge를 등록하지 않고 PR을 열린 상태로 둡니다. |

GitHub repository에서 Auto-merge를 허용하지 않거나 설정에 실패하면 release PR URL과 경고를 출력합니다. 이 경우 PR CI를 확인한 뒤 GitHub에서 merge commit 방식으로 직접 병합합니다.

## Release PR과 CI

모든 Pull Request에서 GitHub Actions의 CI workflow가 다음 명령을 실행합니다.

```sh
node scripts/release/check.mjs
```

release PR도 동일한 전체 gate를 clean Windows runner에서 다시 통과해야 합니다. 로컬 격리 검증과 PR CI가 같은 검증 진입점을 사용하므로 OS, dependency install, generated Android source와 packaging 차이를 병합 전에 확인할 수 있습니다.

Auto-merge가 등록되어 있고 required check가 모두 통과하면 GitHub가 PR을 병합합니다. Auto-merge를 사용하지 않는 경우 CI가 성공하고 PR head가 예상한 release commit인지 확인한 뒤 직접 병합합니다.

## npm과 GitHub 배포

release PR이 `main`에 병합되면 Release workflow가 실행됩니다.

1. repository를 전체 history와 함께 checkout합니다.
2. frozen lockfile로 의존성을 설치합니다.
3. pending changeset이 없고 checkout이 clean한지 확인합니다.
4. 전체 release gate를 다시 실행합니다.
5. gate 이후 tracked 변경이 생기지 않았는지 확인합니다.
6. Changesets로 공개 package를 npm에 배포합니다.
7. 배포된 package의 tag와 GitHub Release를 만듭니다.
8. 실제 publish가 발생했다면 검증 과정에서 만든 Host debug APK를 artifact로 업로드합니다.

npm에 배포되는 package는 다음 네 개입니다.

```text
@remixapp/sdk
@remixapp/core
@remixapp/cli
@remixapp/create
```

`@remixapp/app`과 `@remixapp/runtime`은 같은 버전으로 관리하지만 private package이므로 npm에 배포하거나 tag를 만들지 않습니다.

workflow가 업로드하는 `app-debug.apk`는 build 검증과 개발 설치를 위한 debug artifact입니다. production signing과 keystore가 적용된 현장 배포용 APK로 사용하지 마세요.

## 명령 요약

| 명령 | 사용자 | 용도 |
| --- | --- | --- |
| `pnpm changeset` | 개발자 | 다음 릴리스의 package, bump와 요약을 기록합니다. |
| `pnpm changeset:status` | 개발자 | pending changeset과 예상 버전을 확인합니다. |
| `pnpm release:check` | 개발자 | 전체 release gate를 실행합니다. |
| `pnpm release:sync` | 개발자 | 버전 관련 파일을 현재 toolchain 버전에 맞춥니다. |
| `pnpm release:start --dry-run` | 릴리스 관리자 | 원격 preflight와 release plan을 확인합니다. |
| `pnpm release:start` | 릴리스 관리자 | 버전 commit, push와 release PR을 생성합니다. |
| `node scripts/release/check.mjs` | GitHub Actions | PR과 publish job에서 전체 gate를 실행합니다. |
| `node scripts/release/publish.mjs --check` | GitHub Actions | main checkout의 publish 사전 조건을 확인합니다. |
| `node scripts/release/publish.mjs` | Changesets Action | 검증 후 실제 npm publish를 수행합니다. |

GitHub Actions 내부 명령은 개발자가 일반 작업에서 직접 실행하지 않습니다. 특히 `node scripts/release/publish.mjs`는 실제 npm 배포를 시도하므로 로컬 검증 명령으로 사용하지 마세요.

## 실패 복구

### pending changeset이 없을 때

실제 package 변경을 릴리스하려는 경우 changeset을 만들고 commit한 뒤 `develop`에 push합니다.

```sh
pnpm changeset
git add .changeset
git commit -m "chore: add changeset"
git push origin develop
```

### worktree가 clean하지 않을 때

릴리스와 관련된 모든 변경을 commit하거나 임시 변경을 stash합니다. release script가 source 변경을 자동 commit하지는 않습니다.

### 버전이 일치하지 않을 때

```sh
pnpm release:sync
git diff
pnpm release:check
```

동기화 결과가 의도한 버전인지 확인한 뒤 commit합니다. package와 Android 버전을 따로 수정하지 마세요.

### 격리 검증이 실패할 때

versioning과 release gate는 임시 worktree에서 실행되므로 검증된 release commit을 만들기 전의 실패는 현재 checkout을 변경하지 않습니다. 원인을 수정하고 변경사항과 changeset을 commit/push한 뒤 `pnpm release:start`를 다시 실행합니다.

### 준비 중 `origin/develop`이 바뀌었을 때

스크립트는 push 직전에 원격을 다시 fetch하고 시작 commit과 비교합니다. 다른 commit이 먼저 들어왔다면 push하지 않습니다. 변경을 로컬 `develop`에 정상적으로 반영하고 전체 절차를 다시 검토합니다. 검증된 commit을 강제로 push하지 마세요.

### atomic push가 실패할 때

atomic push는 `develop`과 `release/<version>`을 모두 반영하거나 모두 거부합니다. 실패했다면 원격 branch가 부분적으로 생성되었다고 가정하지 말고 다음 상태를 먼저 확인합니다.

```sh
git fetch origin
git log -1 --oneline
git ls-remote --heads origin refs/heads/develop refs/heads/release/<version>
```

로컬 `develop`에는 검증된 release commit이 적용되어 있을 수 있습니다. 원격 상태와 commit SHA를 확인하지 않은 채 `release:start`를 다시 실행하거나 force-push하지 마세요.

### PR 생성 또는 Auto-merge 등록이 실패할 때

atomic push가 성공했다면 `origin/develop`과 `origin/release/<version>`에는 동일한 검증 commit이 있습니다. 출력된 오류와 원격 branch를 확인하고 `release/<version>`에서 `main`으로 향하는 PR을 생성합니다. Auto-merge만 실패했다면 PR CI 통과 후 merge commit 방식으로 직접 병합합니다.

### PR CI가 실패할 때

CI log에서 실패한 release gate 단계를 확인합니다. 로컬에서 `pnpm release:check`로 재현하고, fix commit이 `develop`과 release PR branch에 모두 반영되는지 확인합니다. 이미 검증한 commit을 amend하거나 release branch를 force-push하지 마세요.

### npm publish가 실패할 때

인증, registry 또는 network 문제를 수정한 뒤 실패한 workflow를 재실행합니다. 일부 package가 이미 배포되었다면 npm registry에서 각 package와 version을 먼저 확인합니다. npm에 올라간 version의 내용을 덮어쓸 수 없으므로 같은 version에 다른 artifact를 publish하려고 하지 마세요.

## 운영 원칙

- 사용자에게 보이는 package 변경에는 changeset을 남깁니다.
- package, root, SDK와 Android 버전은 개별 편집하지 않습니다.
- release PR의 head branch와 commit SHA를 확인한 뒤 병합합니다.
- `main` publish workflow와 수동 npm publish를 동시에 실행하지 않습니다.
- 이미 npm에 배포된 version에 다른 내용을 다시 배포하지 않습니다.
- debug APK artifact를 production 배포물로 사용하지 않습니다.
- release 실패를 우회하기 위해 `develop`, `main` 또는 release branch를 force-push하지 않습니다.

## 관련 문서

- [저장소 개발](contributing.md)
- [Android Host 개발](android-development.md)
- [아키텍처](../concepts/architecture.md)
- [문제 해결](../guides/troubleshooting.md)
