#!/usr/bin/env node

import { existsSync } from "node:fs";
import { join } from "node:path";

import { listDevices, resolveAdb, run } from "./android-tools.mjs";

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
  devices = listDevices(adb);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

if (devices.length === 0) {
  fail("No connected adb devices found.");
}

const targets = installAll ? devices : [devices[0]];

try {
  for (const device of targets) {
    console.log(`Installing ${apkPath} to ${device}`);
    run(adb, ["-s", device, "install", "-r", apkPath]);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
