import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

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
  const packagePath =
    options.build === false
      ? await resolveExistingPackage(cwd)
      : await buildProject({ cwd });

  const adb = resolveAdb();
  const devices = listDevices(adb);
  const device = selectDevice(devices, options.device);
  const devicePackagePath = installPackageFile(adb, device, packagePath);

  activateProjectPackage(adb, device, devicePackagePath);
  startHostWithInstall(adb, device, devicePackagePath);

  console.log(`Deployed ${packagePath} to ${device}`);
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

function resolveAdb(): string {
  const executable = process.platform === "win32" ? "adb.exe" : "adb";
  const candidates = [
    process.env.REMIXAPP_ADB,
    process.env.ADB,
    process.env.ANDROID_HOME
      ? path.join(process.env.ANDROID_HOME, "platform-tools", executable)
      : undefined,
    process.env.ANDROID_SDK_ROOT
      ? path.join(process.env.ANDROID_SDK_ROOT, "platform-tools", executable)
      : undefined,
    process.env.LOCALAPPDATA
      ? path.join(
          process.env.LOCALAPPDATA,
          "Android",
          "Sdk",
          "platform-tools",
          executable,
        )
      : undefined,
    "adb",
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const result = run(candidate, ["version"], { allowFailure: true });

    if (result.status === 0) {
      return candidate;
    }
  }

  throw new RemixCliError(
    "Failed to run adb. Set REMIXAPP_ADB or add Android SDK platform-tools to PATH.",
  );
}

function listDevices(adb: string): string[] {
  const result = run(adb, ["devices"]);
  return result.stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/))
    .filter(([, state]) => state === "device")
    .map(([serial]) => serial);
}

function selectDevice(devices: string[], requested: string | undefined): string {
  if (requested) {
    if (!devices.includes(requested)) {
      throw new RemixCliError(
        `ADB device not found: ${requested}\nConnected devices: ${devices.join(", ") || "none"}`,
      );
    }

    return requested;
  }

  if (devices.length === 0) {
    throw new RemixCliError("No connected adb devices found.");
  }

  return devices[0];
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

interface RunOptions {
  allowFailure?: boolean;
}

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

function run(command: string, args: string[], options: RunOptions = {}): RunResult {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe",
  });

  const status = result.status ?? 1;
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";

  if (!options.allowFailure && status !== 0) {
    throw new RemixCliError(
      [`Command failed: ${command} ${args.join(" ")}`, stdout, stderr]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return { status, stdout, stderr };
}
