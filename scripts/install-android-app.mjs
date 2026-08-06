#!/usr/bin/env node

import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  listAndroidDevices,
  resolveAdb,
  run,
  selectAndroidDevice,
} from "../packages/cli/android-tools/index.mjs";

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

let adb;
let devices;

try {
  adb = resolveAdb();
  devices = listAndroidDevices(adb);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

try {
  if (installAll && devices.length === 0) {
    await selectAndroidDevice(devices);
  }
  const targets = installAll
    ? devices
    : [await selectAndroidDevice(devices)];
  for (const device of targets) {
    console.log(`Installing ${apkPath} to ${device.serial}`);
    run(adb, ["-s", device.serial, "install", "-r", apkPath], {
      stdio: "inherit",
    });
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
