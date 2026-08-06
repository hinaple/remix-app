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
- Project creator package: `@remixapp/create`
- Host APK package: `@remixapp/app`
- Native/core package: `@remixapp/core`
- Android application ID: `com.fainthit.remix`
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
└─ create-remixapp/
   └─ template-default/
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

`@remixapp/app` is the Capacitor + vanilla TypeScript/JavaScript Android APK Host.

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
- Restart only the mounted project through `context.project.reset()` without restarting the Host APK.

The Android application ID is `com.fainthit.remix`. Dedicated devices are provisioned as Device Owner through Android QR-code provisioning. Device Owner policy and kiosk implementation belong to the Host/Core native layer, not project code.

The Device Owner admin component is `com.fainthit.remix/.RemixDeviceAdminReceiver`. The Host also provides the Android 12+ provisioning mode and policy compliance activities required for QR provisioning. A deployable QR payload still requires the final signed APK download URL and signing-certificate checksum.

`@remixapp/app` is not a package that remixApp project code imports directly.

### @remixapp/core

`@remixapp/core` contains Capacitor plugin bridges and native functionality.

Responsibilities include:

- Android device policy.
- Kiosk, fullscreen, and immersive mode.
- Screen keep-on.
- Automatic brightness and screen brightness control.
- Always-on foreground runtime and CPU wake lock ownership.
- Hardware key capture.
- Back key capture.
- Audio, video, and device-specific native features.
- Other on-site device control functionality.

The initial Android bridge provides screen wake, screen keep-on, automatic brightness control, screen brightness control, an always-on foreground runtime and CPU wake lock, lock-task kiosk control, Device Owner status, Android back capture, and supported hardware-key events. The Host applies fixed manifest policy before mounting a project and releases project-owned screen/input policy during unmount/reset.

Project developers do not import `@remixapp/core` directly. The Host APK uses it internally and exposes needed capabilities through `RemixAppContext`.

### @remixapp/sdk

`@remixapp/sdk` is the TypeScript contract used by remixApp projects.

Responsibilities:

- `RemixAppContext` type.
- `RemixAppMount` and `RemixAppUnmount` types.
- Source config and built manifest types.
- Device, event, resource, project, and key types.
- Project-only restart through `context.project.reset()`.
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

### @remixapp/create

`@remixapp/create` provides the `npm create @remixapp@latest` project generator.

```sh
npm create @remixapp@latest
npm create @remixapp@latest -- --name "My Room" --version 0.1.0
npm create @remixapp@latest -- --name "My Room" --version 0.1.0 --force
```

Responsibilities:

- Prompt for a project name and version when they are not provided as options.
- Normalize project names to lowercase dash-separated npm package names.
- Create the project under the normalized name in the current working directory.
- Copy the bundled `template-default` directory from the installed npm package.
- Generate project-specific `package.json` and `remix.config.ts` values.
- Install dependencies with the invoking package manager, defaulting to npm.
- Require confirmation before writing into an existing directory unless `--force` is used.

The bundled template is a minimal vanilla TypeScript/JavaScript remixApp project that can be built by `remix-cli build`. The generator does not initialize a Git repository.

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
import { defineConfig } from "@remixapp/sdk/config";

export default defineConfig({
  name: "airport",
  version: "1.0.0",
  entry: "src/index.ts",
  styles: ["src/style.css"],
  kiosk: true,
  screen: {
    keepOn: false,
    autoBrightness: false,
    timeout: 30000,
  },
  input: {
    capturedKeys: ["VOLUME_UP", "VOLUME_DOWN"],
    captureBack: true,
  },
  vite: {
    base: "./",
  },
});
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
  "formatVersion": 1,
  "runtimeApiVersion": 2,
  "builtWith": {
    "cli": "0.2.0",
    "sdk": "0.2.0"
  },
  "name": "airport",
  "version": "1.0.0",
  "entry": "src/index.js",
  "styles": ["src/style.css"],
  "kiosk": true,
  "screen": {
    "keepOn": false,
    "autoBrightness": false,
    "timeout": 30000
  },
  "input": {
    "capturedKeys": ["VOLUME_UP", "VOLUME_DOWN"],
    "captureBack": true
  }
}
```

The CLI writes `formatVersion` and `runtimeApiVersion`; projects do not configure them directly. `builtWith` is diagnostic metadata rather than the primary compatibility check. Packages created before these fields existed are treated as project format 1 and runtime API 1. Host 0.2 requires runtime API 2, so rebuild older projects before installing them.

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
const video = document.createElement("video");
video.src = context.resources.url("video/intro.mp4");
```

`context.resources.url(path)` returns a URL that can be used directly by browser/WebView APIs. Android filesystem details should not be exposed to project code by default.

## MQTT

MQTT connections and fixed subscriptions are declared only in `remix.config.ts`:

```ts
export default defineConfig({
  // ...
  mqtt: {
    connections: {
      primary: {
        url: "mqtts://broker.example.com:8883",
        username: "device-user",
        password: "device-password",
        subscriptions: [
          { filter: "devices/+/commands", qos: 1 },
        ],
      },
    },
  },
});
```

The CLI writes a normalized MQTT section to `project.json`. Credentials are stored directly in that package manifest, so they are configuration values rather than protected secrets. The Android foreground service owns each connection and keeps it independent from the WebView lifecycle. Project code can inspect status and publish, but cannot connect, disconnect, or change subscriptions at runtime.

```ts
const offStatus = context.events.on("mqtt:status", (status) => {
  console.log(status.connection, status.state);
});

const offMessage = context.events.on("mqtt:message", (message) => {
  console.log(message.connection, message.topic, message.payload);
});

await context.mqtt.publish("primary", "devices/kiosk-1/state", "ready", {
  qos: 1,
  retain: true,
});
```

`keepAliveSeconds`, `cleanSession`, `reconnect`, and subscription `qos` default to `30`, `true`, `true`, and `0`. When `clientId` is omitted, the Android Host generates a stable device-and-project-specific value. Initial support is MQTT 3.1.1 over `mqtt://` or `mqtts://` with the Android system trust store. Messages received while no JavaScript listener exists are not buffered for later JavaScript delivery.

## Native Events

`nativeEvents` compares native events against configured conditions and runs actions in order while a project remains mounted and its Activity is paused. Rules can only be declared in `remix.config.ts`; runtime code cannot add or change them.

```ts
export default defineConfig({
  // ...
  nativeEvents: {
    rules: [
      {
        on: "device:status:battery",
        when: {
          level: { lte: 0.15 },
          charging: false,
        },
        actions: [
          { type: "device.screen.wake" },
          {
            type: "device.vibration.trigger",
            args: { duration: 500 },
          },
          {
            type: "host.panel.status.setText",
            args: { id: "battery", text: "Low battery" },
          },
        ],
        expiresIn: 10000,
      },
    ],
  },
});
```

Keys in `when` use dot notation. Conditions may use direct value equality or the `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `contains`, and `exists` matchers. Native actions run immediately while the Activity is paused. WebView actions wait for the Activity to resume, so place `device.screen.wake` first when the remaining actions should run as soon as the screen wakes. Actions preserve their authored order, and a WebView action that cannot complete within `expiresIn` is discarded.

The SDK common action registry owns action names, argument validation, and execution location, so context APIs and nativeEvents use the same action contract. `host.panel.buttons.set` remains context-only because it contains callbacks and cannot be used by nativeEvents.

## Mount Contract

Project entry modules export `mount`.

```ts
import type { RemixAppMount } from "@remixapp/sdk";

export const mount: RemixAppMount = (container, context) => {
  const button = document.createElement("button");

  button.textContent = "NEXT";
  button.onclick = () => {
    void context.device.screen.wake();
    void context.device.screen.setBrightness(0.8);
  };

  container.append(button);

  return () => {
    button.remove();
  };
};
```

Svelte 5 example:

```ts
import { mount as mountSvelte, unmount } from "svelte";
import App from "./App.svelte";
import type { RemixAppMount } from "@remixapp/sdk";

export const mount: RemixAppMount = (container, context) => {
  const app = mountSvelte(App, {
    target: container,
    props: { context },
  });

  return () => {
    unmount(app);
  };
};
```

## Host Load Flow

1. Read built `project.json`.
2. Validate manifest and compatibility.
3. Apply fixed device policy:
   - kiosk
   - screen keep-on
   - automatic brightness
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

The Android Host foreground service and partial CPU wake lock are always-on Host invariants, independent of project configuration. Neither `remix.config.ts` nor `project.json` exposes an option to disable them.

## Initial Milestones

1. Monorepo skeleton.
2. `@remixapp/sdk` type contract.
3. `@remixapp/cli` validate/build/package flow.
4. `@remixapp/create` creates and builds a project successfully from its bundled template.
5. `@remixapp/app` loads the generated `.remixprj`.
6. `@remixapp/core` connects native functionality incrementally.

## Releases

Follow the [release guide](docs/internals/releasing.md) for Changesets, lockstep package versions, Android Host versioning, and template synchronization.

## License

remixApp, including the Host app and runtime, is licensed under the [Apache License 2.0](LICENSE). The project files generated from `packages/create-remixapp/template-default` are separately licensed under the [0BSD License](packages/create-remixapp/template-default/LICENSE), so applications created from the template may adopt any license.

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
