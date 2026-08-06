import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const node = process.execPath;
const pnpmScript = process.env.npm_execpath;
const pnpmCommand = pnpmScript
  ? node
  : process.platform === "win32"
    ? "cmd.exe"
    : "pnpm";
const pnpmPrefix = pnpmScript
  ? [pnpmScript]
  : process.platform === "win32"
    ? ["/d", "/s", "/c", "pnpm"]
    : [];
const pnpmStep = (label, args) => [label, pnpmCommand, [...pnpmPrefix, ...args]];
const hasPendingChangesets = fs
  .readdirSync(path.join(root, ".changeset"))
  .some((name) => name.endsWith(".md") && name.toLowerCase() !== "readme.md");
const steps = [
  ["release versions", node, ["scripts/release-versions.mjs", "check"]],
  ...(hasPendingChangesets
    ? [pnpmStep("changesets", ["changeset", "status"])]
    : []),
  pnpmStep(
    "build package contracts",
    ["--filter", "@remixapp/sdk", "--filter", "@remixapp/core", "build"],
  ),
  pnpmStep("typecheck", ["typecheck"]),
  pnpmStep("workspace build", ["build"]),
  ["publish manifests", node, ["scripts/verify-publish-manifests.mjs"]],
  pnpmStep("production dependency audit", ["audit", "--prod"]),
  pnpmStep("release package tarballs", ["release:pack"]),
  pnpmStep("@remixapp/create tests", ["--filter", "@remixapp/create", "test"]),
  pnpmStep("example unpack", ["build:example:unpack"]),
  ["example manifest", node, ["scripts/verify-example-manifest.mjs"]],
  pnpmStep("Android debug APK", ["android:build"]),
];

for (const [label, command, args] of steps) {
  console.log(`\n==> ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("\nRelease check passed.");
