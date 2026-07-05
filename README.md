# remixApp

**remixApp** stands for **Room Escape Mobile Interface eXecution**.

remixApp is a project system for Android devices used in room escape venues and other fixed on-site installations. It is not designed as a general app-store application or a generic web platform. The intended environment is a known device, a known physical space, and an operator-controlled deployment.

## Core Concept

`@remixapp/app` is the real Android APK Host.

It is installed on the Android device and owns the Android permissions, native capabilities, device policy, lifecycle handling, kiosk behavior, wake locks, hardware key capture, and other device-level responsibilities.

A remixApp project is not an Android APK and is not a standalone web app. It is a dynamic project package built as a `.remixprj` ZIP archive. The Host APK imports, unpacks, and loads that package at runtime.

## Relationship

```txt
@remixapp/app APK
  -> installed Android application
  -> owns Android permissions and native capabilities
  -> uses @remixapp/core for Capacitor/native functionality
  -> imports and loads .remixprj project packages
  -> provides a Host container DOM node
  -> creates a RemixAppContext
  -> dynamically imports project src/index.js
  -> calls mount(container, context)

.remixprj project package
  -> project-specific web runtime module loaded by the APK
  -> provides project JS/CSS/UI/assets/resources
  -> does not manage Android permissions directly
  -> does not import native plugins directly
  -> calls Host APK functionality through the SDK context
```

Project code talks to the Host through `RemixAppContext`. It should not import Capacitor plugins or `@remixapp/core` directly.

## Design Priorities

1. Features must work reliably on-site.
2. Project developers should have a high degree of implementation freedom.
3. The system should expose the capabilities needed for room escape installations.
4. The Host APK should strongly provide Android permissions and native functionality.
5. Building, installing, replacing, and loading project packages should stay simple.

Security hardening, sandboxing, strict isolation, permission minimization, project signing, encryption, rollback, and delta updates are not initial priorities. The early system favors functionality, flexibility, and predictable operation on controlled devices.

## Package Names

- Product/system name: `remixApp`
- CLI executable: `remix-cli`
- npm scope: `@remixapp`
- SDK package: `@remixapp/sdk`
- CLI package: `@remixapp/cli`
- Host APK package: `@remixapp/app`
- Native/core package: `@remixapp/core`
- Template package: `@remixapp/template`
- Source config file: `remix.config.ts` or `remix.config.js`
- Built project manifest: `project.json`
- Project package extension: `.remixprj`

The npm scope and package names are lowercase: `@remixapp`, not `@remixApp`.

## Monorepo Structure

The repository is managed as a pnpm workspace.

```txt
packages/
├─ app/
├─ core/
├─ sdk/
├─ cli/
└─ template/
```

Root-level files:

```txt
package.json
pnpm-workspace.yaml
tsconfig.base.json
README.md
README_ko.md
```

## Packages

### @remixapp/app

`@remixapp/app` is the Capacitor + Svelte 5 Android APK Host.

Responsibilities:

- Install and run as the real Android application.
- Own and manage Android permissions.
- Manage native functionality and device policy.
- Use `@remixapp/core` internally for native functionality.
- Import, unpack, and load `.remixprj` project packages.
- Read `project.json`.
- Apply fixed project policy from the manifest.
- Load `src/style.css`.
- Dynamically import `src/index.js`.
- Create `RemixAppContext`.
- Call `mount(container, context)`.
- Store optional unmount cleanup.

`@remixapp/app` is not a package that remixApp project code imports directly.

### @remixapp/core

`@remixapp/core` contains Capacitor plugin bridges and native functionality.

Responsibilities include:

- Android device policy.
- Kiosk, fullscreen, and immersive mode.
- Screen keep-on.
- Wake lock and CPU wake behavior.
- Hardware key capture.
- Back key capture.
- Audio, video, and device-specific native features.
- Other on-site device control functionality.

Project developers do not import `@remixapp/core` directly. The Host APK uses it internally and exposes needed capabilities through `RemixAppContext`.

### @remixapp/sdk

`@remixapp/sdk` is the TypeScript contract used by remixApp projects.

Responsibilities:

- `RemixAppContext` type.
- `RemixAppMount` and `RemixAppUnmount` types.
- Source config and built manifest types.
- Device, event, resource, project, and key types.
- Host/project ABI and type contract.

The SDK should stay lightweight. It should not include Capacitor implementation, native bridges, or heavy runtime dependencies.

### @remixapp/cli

`@remixapp/cli` provides the `remix-cli` executable.

Responsibilities:

- Implement `remix-cli build`.
- Load `remix.config.ts` or `remix.config.js`.
- Validate project configuration.
- Resolve entry and style paths.
- Run a Vite-based build.
- Allow user Vite configuration while preserving the remixApp output contract.
- Normalize the built entry to `src/index.js`.
- Normalize built styles to `src/style.css`.
- Copy `resources/` without bundling, hashing, renaming, or transforming files.
- Generate normalized `project.json`.
- Create `dist/<name>-<version>.remixprj`.

The CLI must fail clearly for missing config files, invalid config, missing entry, missing configured styles, Vite build failures, missing generated JS entry, resource copy failures, and ZIP package failures.

### @remixapp/template

`@remixapp/template` is the minimal starter project and build fixture.

It should include:

- `package.json`
- `remix.config.ts` or `remix.config.js`
- `src/index.ts`
- `src/App.svelte`
- `src/style.css`
- `resources/`

The template should be a minimal Svelte 5 remixApp project that can be built by `remix-cli build`.

## Source Project Shape

Example:

```txt
airport/
├─ remix.config.ts
├─ src/
│  ├─ index.ts
│  ├─ App.svelte
│  ├─ messenger.ts
│  ├─ call.ts
│  ├─ style.css
│  └─ assets/
│     ├─ icon.png
│     └─ background.png
└─ resources/
   ├─ images/
   │  ├─ passport.png
   │  └─ ticket.png
   ├─ audio/
   │  ├─ ring.wav
   │  └─ voice-01.wav
   └─ video/
      └─ intro.mp4
```

Example source config:

```ts
import { defineConfig } from '@remixapp/sdk/config'

export default defineConfig({
  name: 'airport',
  version: '1.0.0',
  entry: 'src/index.ts',
  styles: ['src/style.css'],
  kiosk: true,
  runtime: {
    foreground: true,
    keepCpuAwake: true
  },
  screen: {
    keepOn: false,
    timeout: 30000
  },
  input: {
    capturedKeys: ['VOLUME_UP', 'VOLUME_DOWN'],
    captureBack: true
  },
  vite: {
    base: './'
  }
})
```

The source config is a build-time file. It may contain JavaScript/TypeScript configuration, including Vite configuration. The built project package does not include this file.

## Built Project Package

A `.remixprj` file is a ZIP archive. The archive root must contain the package files directly, without an extra project directory.

Correct archive layout:

```txt
airport-1.0.0.remixprj
├─ project.json
├─ src/
│  ├─ index.js
│  ├─ style.css
│  ├─ runtime-C82JD.js
│  └─ logo-A72KD.png
└─ resources/
   ├─ audio/
   │  ├─ ring.wav
   │  └─ voice-01.wav
   └─ video/
      └─ intro.mp4
```

Incorrect archive layout:

```txt
airport-1.0.0.remixprj
└─ airport/
   ├─ project.json
   ├─ src/
   └─ resources/
```

Required built files:

```txt
project.json
src/index.js
src/style.css
```

If no CSS is present, the CLI still creates an empty `src/style.css`.

## project.json

`project.json` is the built runtime manifest read by the Host APK.

Example:

```json
{
  "name": "airport",
  "version": "1.0.0",
  "entry": "src/index.js",
  "styles": ["src/style.css"],
  "kiosk": true,
  "runtime": {
    "foreground": true,
    "keepCpuAwake": true
  },
  "screen": {
    "keepOn": false,
    "timeout": 30000
  },
  "input": {
    "capturedKeys": ["VOLUME_UP", "VOLUME_DOWN"],
    "captureBack": true
  }
}
```

The Host does not need to know the original source entry or source style list. It always loads the normalized built files.

## Build Rules

- Source entry may be `src/index.ts`, `src/main.ts`, `src/runtime.js`, or another configured module.
- Built entry is always normalized to `src/index.js`.
- Built style is always normalized to `src/style.css`.
- Configured CSS files must exist. Missing configured styles are build errors.
- Configured style order must be preserved.
- CSS imported from JS/TS/Svelte should be included in the final `src/style.css`.
- JavaScript entry is not required to import configured CSS.
- Vite output must use relative paths and must not assume a web root `/`.
- ES module output is required.
- Code splitting and dynamic imports are allowed.
- Generated chunks and bundled assets are placed under built `src/`.
- `resources/` is copied as-is and is not processed by Vite.
- Source `src/` and `resources/` must not be modified by the build.
- The CLI should use isolated temporary build directories.
- Stale output should be cleaned on each build.
- Final package staging must exactly match the archive layout.

## Resources

`resources/` is the runtime resource directory. Files in this directory keep their original names, extensions, and directory hierarchy.

Typical resources:

- Large video files.
- Audio files.
- Dialogue resources.
- Scene resources.
- Dynamically selected images.
- Files selected by runtime-generated paths.

Project code accesses these files through the SDK context:

```ts
const video = document.createElement('video')
video.src = context.resources.url('video/intro.mp4')
```

`context.resources.url(path)` returns a URL that can be used directly by browser/WebView APIs. Android filesystem details should not be exposed to project code by default.

## Mount Contract

Project entry modules export `mount`.

```ts
import type { RemixAppMount } from '@remixapp/sdk'

export const mount: RemixAppMount = (container, context) => {
  const button = document.createElement('button')

  button.textContent = 'NEXT'
  button.onclick = () => {
    void context.device.screen.wake()
  }

  container.append(button)

  return () => {
    button.remove()
  }
}
```

Svelte 5 example:

```ts
import { mount as mountSvelte, unmount } from 'svelte'
import App from './App.svelte'
import type { RemixAppMount } from '@remixapp/sdk'

export const mount: RemixAppMount = (container, context) => {
  const app = mountSvelte(App, {
    target: container,
    props: { context }
  })

  return () => {
    unmount(app)
  }
}
```

## Host Load Flow

1. Read built `project.json`.
2. Validate manifest and compatibility.
3. Apply fixed device policy:
   - kiosk
   - runtime foreground behavior
   - CPU wake behavior
   - screen keep-on
   - screen timeout
   - captured hardware keys
   - back key capture
4. Load `src/style.css`.
5. Dynamically import `src/index.js`.
6. Verify exported `mount` exists.
7. Prepare the runtime container DOM node.
8. Create `RemixAppContext`.
9. Await `module.mount(container, context)`.
10. Store optional unmount cleanup if returned.

The Host remains mounted and alive. The remixApp project mounts only inside the provided project container.

## Initial Milestones

1. Monorepo skeleton.
2. `@remixapp/sdk` type contract.
3. `@remixapp/cli` validate/build/package flow.
4. `@remixapp/template` builds successfully.
5. `@remixapp/app` loads the template `.remixprj`.
6. `@remixapp/core` connects native functionality incrementally.

## Initially Excluded

- Visual project editor.
- JSON scenario engine.
- Hot reload protocol.
- Project server synchronization.
- OTA transfer.
- Delta patching.
- Project signing.
- Project encryption.
- Resource hashing.
- Project rollback.
- Multiple simultaneously mounted remixApps.
- General app-store-grade security hardening.

## Early Goal

A room escape project developer should be able to:

1. Start from the template.
2. Write `remix.config.ts` or `remix.config.js`.
3. Export `mount(container, context)` from `src/index.ts`.
4. Place large runtime files under `resources/`.
5. Run `npm run build` or `remix-cli build`.
6. Obtain `dist/<name>-<version>.remixprj`.
7. Load that package in the `@remixapp/app` Android APK.
8. Use Host-provided native/device functionality through `RemixAppContext`.
