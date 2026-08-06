import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";

export class AndroidToolsError extends Error {
  constructor(message) {
    super(message);
    this.name = "AndroidToolsError";
  }
}

export function resolveAdb() {
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
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate !== "adb" && !existsSync(candidate)) {
      continue;
    }

    const result = run(candidate, ["version"], { allowFailure: true });
    if (result.status === 0) {
      return candidate;
    }
  }

  throw new AndroidToolsError(
    "Failed to run adb. Set REMIXAPP_ADB or add Android SDK platform-tools to PATH.",
  );
}

export function listAndroidDevices(adb) {
  const result = run(adb, ["devices", "-l"]);
  return result.stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseDeviceLine)
    .filter((device) => device !== undefined);
}

export async function selectAndroidDevice(devices, requestedSerial) {
  if (requestedSerial) {
    const requested = devices.find(
      (device) => device.serial === requestedSerial,
    );
    if (!requested) {
      throw new AndroidToolsError(
        `ADB device not found: ${requestedSerial}\nConnected devices: ${formatDeviceSerials(devices)}`,
      );
    }
    return requested;
  }

  if (devices.length === 0) {
    throw new AndroidToolsError("No connected adb devices found.");
  }

  if (devices.length === 1) {
    return devices[0];
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new AndroidToolsError(
      `Multiple Android devices are connected. Specify one with --device <serial>.\nConnected devices: ${formatDeviceSerials(devices)}`,
    );
  }

  console.log("Connected Android devices:\n");
  devices.forEach((device, index) => {
    console.log(`  ${index + 1}) ${formatDevice(device)}`);
  });
  console.log();

  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    while (true) {
      const answer = await prompt.question(
        `Select device [1-${devices.length}]: `,
      );
      const selectedIndex = Number(answer.trim()) - 1;
      if (
        Number.isInteger(selectedIndex) &&
        selectedIndex >= 0 &&
        selectedIndex < devices.length
      ) {
        return devices[selectedIndex];
      }
      console.log(`Enter a number between 1 and ${devices.length}.`);
    }
  } finally {
    prompt.close();
  }
}

export function run(command, args, options = {}) {
  const useWindowsShell =
    process.platform === "win32" && /\.(?:bat|cmd)$/i.test(command);
  const executable = useWindowsShell
    ? [command, ...args].map(quoteWindowsShellArg).join(" ")
    : command;
  const executableArgs = useWindowsShell ? [] : args;
  const result = spawnSync(executable, executableArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    shell: useWindowsShell,
    stdio: options.stdio ?? "pipe",
  });
  const status = result.status ?? 1;
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";

  if (result.error && !options.allowFailure) {
    throw new AndroidToolsError(result.error.message);
  }

  if (!options.allowFailure && status !== 0) {
    throw new AndroidToolsError(
      [`Command failed: ${command} ${args.join(" ")}`, stdout, stderr]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return { status, stdout, stderr };
}

function parseDeviceLine(line) {
  const [serial, state, ...details] = line.split(/\s+/);
  if (!serial || state !== "device") {
    return undefined;
  }

  const properties = Object.fromEntries(
    details
      .map((detail) => detail.split(":", 2))
      .filter(([key, value]) => Boolean(key && value)),
  );
  return {
    serial,
    model: properties.model,
    product: properties.product,
    device: properties.device,
  };
}

function formatDevice(device) {
  return device.model ? `${device.serial}  ${device.model}` : device.serial;
}

function formatDeviceSerials(devices) {
  return devices.map((device) => device.serial).join(", ") || "none";
}

function quoteWindowsShellArg(value) {
  if (!/[\s"&|<>^()]/.test(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '""')}"`;
}
