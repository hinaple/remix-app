# remixApp release guide

## Version model

The official toolchain packages use one lockstep semantic version:

- `@remixapp/app`
- `@remixapp/cli`
- `@remixapp/core`
- `@remixapp/runtime`
- `@remixapp/sdk`
- `@remixapp/create`

An individual project's `remix.config.ts` version is independent from the toolchain. Android `versionName` follows the toolchain version, while Android `versionCode` is a monotonically increasing integer.

`project.json` carries two numeric compatibility contracts:

- `formatVersion`: `.remixprj` and manifest layout
- `runtimeApiVersion`: context, events, and actions

Increase one of these constants only when that contract changes. Product SemVer changes do not automatically require a compatibility version change.

## During development

Add a changeset for every user-visible package change:

```sh
pnpm changeset
```

Use `patch` for compatible fixes and `minor` for new features or breaking changes during the `0.x` period. Clearly call out breaking changes in the changeset summary.

## Local validation

Run the complete release gate:

```sh
pnpm release:check
```

It verifies lockstep versions, pending changesets, TypeScript, every workspace build, public npm manifests, Apache-2.0 package licensing and the 0BSD template boundary, production dependency advisories, npm package tarballs, `@remixapp/create`, the unpacked example manifest, and the Android debug APK.

## Versioning a release

Normally the Changesets GitHub Action creates and maintains the release PR. To perform the same operation locally:

```sh
pnpm release:version
```

This command:

1. applies pending changesets;
2. updates package versions and changelogs;
3. synchronizes the root version and generated-project dependency ranges;
4. updates the SDK toolchain constant;
5. updates Android `versionName`;
6. increments Android `versionCode` once when the product version changes.

Do not edit lockstep package versions or `version.properties` individually. Run `pnpm release:sync` after resolving a version conflict, then run `pnpm release:check`.

## Publishing

After the release PR is merged, the release workflow runs:

```sh
pnpm release:publish
```

The command repeats the full release gate before publishing non-private npm packages. GitHub Actions requires an `NPM_TOKEN` repository secret. Private packages such as the Host app and runtime are versioned but not published.

The workflow is the preferred publishing path. For a manual first release, run
`npm publish` inside the public package directories in dependency order:
`packages/sdk`, `packages/core`, `packages/cli`, then
`packages/create-remixapp`. Do not run manual publishing in parallel with the
`main` branch release workflow.

The workflow uploads the verified debug APK as a build artifact. A distributable release APK still requires the production signing configuration and keystore secrets; do not distribute the debug artifact to installed field devices.

## Recovery

- Version mismatch: `pnpm release:sync`
- Invalid release plan: edit or remove the relevant file under `.changeset/`
- Failed verification: fix the failure and rerun `pnpm release:check`
- Failed npm publication: do not reuse a published version; correct the problem and create a patch changeset
