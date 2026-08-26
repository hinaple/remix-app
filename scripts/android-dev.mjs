#!/usr/bin/env node

import { spawn } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  listAndroidDevices,
  resolveAdb,
  run,
  selectAndroidDevice,
} from "../packages/cli/android-tools/index.mjs";
import { installAndLaunchAndroidHost } from "./android-host.mjs";

const HOST = "127.0.0.1";
const PORT = 5173;
const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appDir = path.join(root, "packages", "app");
const androidDir = path.join(appDir, "android");
const generatedSourceDir = path.join(
  androidDir,
  "app",
  "build",
  "remixapp-live-reload",
);
const pnpmCli = process.env.npm_execpath?.endsWith(".cjs")
  ? process.env.npm_execpath
  : undefined;
const pnpm = pnpmCli
  ? process.execPath
  : process.platform === "win32"
    ? "pnpm.cmd"
    : "pnpm";
const pnpmArgs = pnpmCli ? [pnpmCli] : [];
const gradle = process.platform === "win32" ? "gradlew.bat" : "./gradlew";

let vite;
let adb;
let device;
let reverseInstalled = false;
let requestedExitCode;

try {
  adb = resolveAdb();
  const devices = listAndroidDevices(adb);
  device = await selectAndroidDevice(devices);
  console.log(`Using Android device: ${device.serial}`);

  run(pnpm, [...pnpmArgs, "--filter", "@remixapp/app...", "build"], {
    cwd: root,
    stdio: "inherit",
  });
  run(pnpm, [...pnpmArgs, "--filter", "@remixapp/app", "cap:sync"], {
    cwd: root,
    stdio: "inherit",
  });

  createLiveReloadSource();
  run(
    gradle,
    [
      ":app:assembleLiveReload",
      `-PremixLiveReloadSourceDir=${generatedSourceDir}`,
    ],
    { cwd: androidDir, stdio: "inherit" },
  );

  const apk = findLiveReloadApk();
  run(adb, ["-s", device.serial, "reverse", `tcp:${PORT}`, `tcp:${PORT}`]);
  reverseInstalled = true;

  vite = spawn(
    pnpm,
    [
      ...pnpmArgs,
      "--filter",
      "@remixapp/app",
      "dev",
      "--host",
      HOST,
      "--port",
      String(PORT),
      "--strictPort",
    ],
    {
      cwd: root,
      shell: process.platform === "win32" && !pnpmCli,
      stdio: "inherit",
    },
  );
  const viteExit = waitForExit(vite);
  installSignalHandlers();
  await waitForServer(vite);

  installAndLaunchAndroidHost(adb, device.serial, apk);

  console.log(`Live reload ready on ${device.serial}. Press Ctrl+C to stop.`);
  const code = await viteExit;
  if (requestedExitCode === undefined && code !== 0) {
    throw new Error(`Vite exited with code ${code ?? 1}.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (reverseInstalled && adb && device) {
    run(adb, ["-s", device.serial, "reverse", "--remove", `tcp:${PORT}`], {
      allowFailure: true,
    });
  }

  if (requestedExitCode !== undefined) {
    process.exitCode = requestedExitCode;
  }
}

function createLiveReloadSource() {
  const mainConfigPath = path.join(
    androidDir,
    "app",
    "src",
    "main",
    "assets",
    "capacitor.config.json",
  );
  const config = JSON.parse(readFileSync(mainConfigPath, "utf8"));
  config.server = {
    ...config.server,
    url: `http://${HOST}:${PORT}`,
  };

  const assetsDir = path.join(generatedSourceDir, "assets");
  mkdirSync(assetsDir, { recursive: true });
  writeFileSync(
    path.join(assetsDir, "capacitor.config.json"),
    `${JSON.stringify(config, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    path.join(generatedSourceDir, "AndroidManifest.xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:usesCleartextTraffic="true" />
</manifest>
`,
    "utf8",
  );
}

function findLiveReloadApk() {
  const outputDir = path.join(
    androidDir,
    "app",
    "build",
    "outputs",
    "apk",
    "liveReload",
  );
  const apks = findFiles(outputDir, (name) => name.endsWith(".apk"));
  if (apks.length !== 1) {
    throw new Error(
      `Expected one live reload APK in ${outputDir}, found ${apks.length}.`,
    );
  }
  return apks[0];
}

function findFiles(directory, accept) {
  const matches = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      matches.push(...findFiles(entryPath, accept));
    } else if (accept(entry.name)) {
      matches.push(entryPath);
    }
  }
  return matches;
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    const timeoutAt = Date.now() + 30_000;
    let timer;

    const onExit = (code) => {
      clearTimeout(timer);
      reject(new Error(`Vite exited before startup with code ${code ?? 1}.`));
    };
    child.once("exit", onExit);

    const connect = () => {
      const socket = net.createConnection({ host: HOST, port: PORT });
      socket.once("connect", () => {
        socket.destroy();
        child.off("exit", onExit);
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() >= timeoutAt) {
          child.off("exit", onExit);
          reject(new Error(`Vite did not start on ${HOST}:${PORT}.`));
          return;
        }
        timer = setTimeout(connect, 200);
      });
    };

    connect();
  });
}

function waitForExit(child) {
  return new Promise((resolve) => child.once("exit", resolve));
}

function installSignalHandlers() {
  process.once("SIGINT", () => stop(130));
  process.once("SIGTERM", () => stop(143));
}

function stop(exitCode) {
  requestedExitCode = exitCode;
  if (vite && !vite.killed) {
    vite.kill();
  }
}
