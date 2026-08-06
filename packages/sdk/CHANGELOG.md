# @remixapp/sdk

## 0.2.0

### Minor Changes

- Add native MQTT, namespaced events, the shared action contract, and paused-Activity native event rules.

  This release changes the project runtime API. Rebuild existing projects and
  migrate event subscriptions to `context.events.on(...)`. The per-status
  `.on(...)` methods and `context.device.runtime` are no longer available.
