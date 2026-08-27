# remixApp

English | [한국어](README_ko.md)

**remixApp** stands for **Room Escape Mobile Interface eXecution**.

remixApp runs interactive projects on operator-managed Android devices in fixed installations such as escape rooms. It consists of an Android Host app and project packages that can be built, installed, and replaced independently.

## Overview

- `@remixapp/app` is the Android Host APK.
- A project is built as a `.remixprj` package.
- The Host loads the package and calls its exported `mount` function.
- Project code accesses device features through `RemixAppContext`.
- Android permissions, kiosk behavior, lifecycle, and native integrations remain owned by the Host.

Project code must not import Capacitor plugins or `@remixapp/core` directly.

## How it works

```text
source project
  remix.config.ts
  src/
  resources/
        │
        │ remix-cli build
        ▼
name-version.remixprj
        │
        │ install / load
        ▼
@remixapp/app Android Host
  ├─ RemixAppContext → project API
  └─ @remixapp/core  → Android native bridge
```

The built package is a ZIP archive with a normalized layout:

```text
project.json
src/
├─ index.js
└─ style.css
resources/        # optional
```

See [Project package](docs/concepts/project-package.md) for the complete build and runtime contract.

## Quick start

Node.js 20 or later is required.

Create a project:

```sh
npm create @remixapp@latest -- --name my-room --version 0.1.0
cd my-room
```

Start the browser development Host:

```sh
npm run dev
```

Build a project package:

```sh
npm run build
```

The output is written to:

```text
dist/my-room-0.1.0.remixprj
```

With a development Host installed on an ADB-connected device, deploy the project with:

```sh
npm run deploy
```

See [Quick start](docs/getting-started/quick-start.md) and [Deploy to Android](docs/getting-started/deploy-to-android.md) for details.

## Project entry

The configured entry module must export `mount`:

```ts
import type { RemixAppMount } from "@remixapp/sdk";

export const mount: RemixAppMount = (container, context) => {
  const button = document.createElement("button");
  button.textContent = "Wake screen";

  button.addEventListener("click", () => {
    void context.device.screen.wake();
  });

  container.append(button);
};
```

The Host provides the DOM container and `RemixAppContext`. The context exposes project metadata, resources, device controls, events, MQTT, and Host panel controls.

Context-owned event subscriptions are cleared automatically when the project is unmounted. Project-owned global listeners, timers, external connections, and other resources must be released by a cleanup function returned from `mount`.

See [RemixAppContext](docs/reference/context.md) and [Project lifecycle](docs/concepts/lifecycle.md) for the complete contract.

## Packages

| Package | Role | Used directly by projects |
| --- | --- | --- |
| `@remixapp/app` | Android Host APK | No |
| `@remixapp/sdk` | Configuration and project API contracts | Yes |
| `@remixapp/cli` | Development server, build, and Android deploy | Yes |
| `@remixapp/create` | Project generator | During project creation |
| `@remixapp/core` | Capacitor and Android native bridge | No |
| `@remixapp/runtime` | Shared internal Host runtime | No |

## Documentation

- [Developer documentation](docs/README.md)
- [Architecture](docs/concepts/architecture.md)
- [Project configuration](docs/reference/configuration.md)
- [Constants](docs/reference/constants.md)
- [CLI reference](docs/reference/cli.md)
- [Events and status](docs/reference/events.md)
- [MQTT](docs/reference/mqtt.md)
- [nativeEvents](docs/reference/native-events.md)
- [Device control](docs/guides/device-control.md)
- [Troubleshooting](docs/guides/troubleshooting.md)

## Trust model and current scope

remixApp is designed for controlled devices running trusted project packages. It is not a sandbox for untrusted third-party code.

The current system focuses on one active project per Host. Project signing, encryption, delta updates, remote OTA delivery, and automatic rollback after a project load failure are not currently provided.

## Repository development

This repository is a pnpm workspace.

```sh
pnpm install
pnpm typecheck
pnpm build
```

See [Repository development](docs/internals/contributing.md) for package boundaries and Android workflows. User-visible package changes require a Changeset. Release procedures are documented in the [Release guide](docs/internals/releasing.md).

## License

remixApp, including the Host and runtime, is licensed under the [Apache License 2.0](LICENSE).

Files generated from `packages/create-remixapp/template-default` are separately licensed under [0BSD](packages/create-remixapp/template-default/LICENSE), allowing generated projects to adopt their own license.
