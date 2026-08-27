import fs from "node:fs";
import path from "node:path";
import { listPendingChangesets, node, root, run, runPnpm } from "./utils.mjs";

const options = process.argv.slice(2);
const skipAndroid = options.includes("--skip-android");

const unknownOptions = options.filter((option) => option !== "--skip-android");
if (unknownOptions.length > 0) {
  throw new Error(`Unknown option(s): ${unknownOptions.join(", ")}`);
}

const publicPackageDirectories = [
  "packages/sdk",
  "packages/core",
  "packages/cli",
  "packages/create-remixapp",
];

const hasPendingChangesets = listPendingChangesets().length > 0;

const commandStep = (label, command, args) => [label, () => run(command, args)];

const pnpmStep = (label, args) => [label, () => runPnpm(args)];

const steps = [
  commandStep("release versions", node, [
    "scripts/release/versions.mjs",
    "check",
  ]),

  ...(hasPendingChangesets
    ? [pnpmStep("changesets", ["exec", "changeset", "status"])]
    : []),

  pnpmStep("build package contracts", [
    "--filter",
    "@remixapp/sdk",
    "--filter",
    "@remixapp/core",
    "build",
  ]),

  pnpmStep("typecheck", ["typecheck"]),

  pnpmStep("workspace build", ["build"]),

  commandStep("publish manifests", node, [
    "scripts/verify-publish-manifests.mjs",
  ]),

  pnpmStep("production dependency audit", ["audit", "--prod"]),

  ["release package tarballs", createReleasePacks],

  pnpmStep("@remixapp/create tests", ["--filter", "@remixapp/create", "test"]),

  pnpmStep("example unpack", ["build:example:unpack"]),

  commandStep("example manifest", node, [
    "scripts/verify-example-manifest.mjs",
  ]),

  pnpmStep("Capacitor sync", ["cap:sync"]),

  ...(skipAndroid ? [] : [pnpmStep("Android debug APK", ["android:build"])]),
];

for (const [label, execute] of steps) {
  console.log(`\n==> ${label}`);
  execute();
}

console.log("\nRelease check passed.");

function createReleasePacks() {
  const output = path.resolve(root, ".remix/release-packs");

  fs.rmSync(output, {
    recursive: true,
    force: true,
  });

  fs.mkdirSync(output, {
    recursive: true,
  });

  for (const relativeDirectory of publicPackageDirectories) {
    runPnpm([
      "--dir",
      path.resolve(root, relativeDirectory),
      "pack",
      "--pack-destination",
      output,
    ]);
  }

  const tarballs = fs
    .readdirSync(output)
    .filter((file) => file.endsWith(".tgz"));

  if (tarballs.length !== publicPackageDirectories.length) {
    throw new Error(
      `Expected ${publicPackageDirectories.length} release tarballs, found ${tarballs.length}`,
    );
  }

  console.log(`Release packages created in ${output}`);
}
