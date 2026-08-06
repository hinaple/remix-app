# @remixapp/sdk

TypeScript contracts used by remixApp projects.

```sh
pnpm add -D @remixapp/sdk
```

Project code receives a `RemixAppContext` from its exported `mount` function. Native functionality should be accessed through that context instead of importing Capacitor or `@remixapp/core` directly.

See the repository [README](https://github.com/hinaple/remix-app#readme) and [Korean README](https://github.com/hinaple/remix-app/blob/main/README_ko.md) for project configuration, events, MQTT, and nativeEvents.
