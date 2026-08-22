import { existsSync } from "node:fs";
import path from "node:path";

import {
  listAndroidDevices,
  resolveAdb,
  run,
  selectAndroidDevice,
} from "../android-tools/index.mjs";

import { buildProject } from "./build.js";
import { loadRemixConfig } from "./config.js";
import { RemixCliError } from "./errors.js";
import { packageFileName } from "./paths.js";

const HOST_PACKAGE = "com.fainthit.remix";
const HOST_ACTIVITY = "com.fainthit.remix/.MainActivity";
const DEVICE_IMPORT_DIR = "files/remix/import";
const DEVICE_TMP_DIR = "/data/local/tmp/remixapp";

export interface DeployOptions {
  cwd: string;
  device?: string;
  build?: boolean;
}

export async function deployProject(options: DeployOptions): Promise<void> {
  const cwd = path.resolve(options.cwd);
  const adb = resolveAdb();
  const devices = listAndroidDevices(adb);
  const device = await selectAndroidDevice(devices, options.device);
  const packagePath =
    options.build === false
      ? await resolveExistingPackage(cwd)
      : await buildProject({ cwd });

  const devicePackagePath = installPackageFile(adb, device.serial, packagePath);

  activateProjectPackage(adb, device.serial, devicePackagePath);
  startHostWithInstall(adb, device.serial, devicePackagePath);

  console.log(`Deployed ${packagePath} to ${device.serial}`);
}

async function resolveExistingPackage(cwd: string): Promise<string> {
  const { config } = await loadRemixConfig(cwd);
  const packagePath = path.join(
    cwd,
    "dist",
    packageFileName(config.name, config.version),
  );

  if (!existsSync(packagePath)) {
    throw new RemixCliError(
      `Project package does not exist: ${packagePath}\nRun "remix-cli build" or omit --no-build.`,
    );
  }

  return packagePath;
}

function installPackageFile(
  adb: string,
  device: string,
  packagePath: string,
): string {
  const fileName = path.basename(packagePath);
  const tmpPath = `${DEVICE_TMP_DIR}/${fileName}`;
  const appPath = `${DEVICE_IMPORT_DIR}/${fileName}`;

  run(adb, ["-s", device, "shell", "mkdir", "-p", DEVICE_TMP_DIR]);
  run(adb, ["-s", device, "push", packagePath, tmpPath]);
  run(adb, ["-s", device, "shell", "chmod", "644", tmpPath]);
  run(adb, [
    "-s",
    device,
    "shell",
    "run-as",
    HOST_PACKAGE,
    "mkdir",
    "-p",
    DEVICE_IMPORT_DIR,
  ]);
  run(adb, [
    "-s",
    device,
    "shell",
    "run-as",
    HOST_PACKAGE,
    "cp",
    tmpPath,
    appPath,
  ]);
  run(adb, ["-s", device, "shell", "rm", "-f", tmpPath]);

  return `/data/data/${HOST_PACKAGE}/${appPath}`;
}

function activateProjectPackage(
  adb: string,
  device: string,
  packagePath: string,
): void {
  const script = [
    "rm -rf files/remix/projects/staging files/remix/projects/previous",
    "mkdir -p files/remix/projects/staging",
    `unzip -oq ${shellQuote(packagePath)} -d files/remix/projects/staging`,
    "if [ -d files/remix/projects/active ]; then mv files/remix/projects/active files/remix/projects/previous; fi",
    "mv files/remix/projects/staging files/remix/projects/active",
    "rm -rf files/remix/projects/previous",
  ].join(" && ");

  run(adb, [
    "-s",
    device,
    "shell",
    `run-as ${HOST_PACKAGE} sh -c ${shellQuote(script)}`,
  ]);
}

function startHostWithInstall(
  adb: string,
  device: string,
  packagePath: string,
): void {
  run(adb, [
    "-s",
    device,
    "shell",
    "am",
    "start",
    "-n",
    HOST_ACTIVITY,
    "--es",
    "remix.install",
    packagePath,
  ]);
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
