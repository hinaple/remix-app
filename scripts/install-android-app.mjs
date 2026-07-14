#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const apkPath = join(
  root,
  "packages",
  "app",
  "android",
  "app",
  "build",
  "outputs",
  "apk",
  "debug",
  "app-debug.apk",
);
const installAll = process.argv.includes("--all");

if (!existsSync(apkPath)) {
  fail(`APK not found: ${apkPath}\nRun "pnpm android:build" first.`);
}

const devicesResult = run("adb", ["devices"], { allowFailure: true });

if (devicesResult.status !== 0) {
  fail(
    `Failed to run adb. Make sure Android SDK platform-tools is on PATH.\n${devicesResult.stderr}`,
  );
}

const devices = parseDevices(devicesResult.stdout);

if (devices.length === 0) {
  fail("No connected adb devices found.");
}

const targets = installAll ? devices : [devices[0]];

for (const device of targets) {
  console.log(`Installing ${apkPath} to ${device}`);
  run("adb", ["-s", device, "install", "-r", apkPath]);
}

function parseDevices(output) {
  return output
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/))
    .filter(([, state]) => state === "device")
    .map(([serial]) => serial);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: options.allowFailure ? "pipe" : "inherit",
  });

  if (!options.allowFailure && result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
