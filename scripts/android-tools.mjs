import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

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

  throw new Error(
    "Failed to run adb. Set REMIXAPP_ADB or add Android SDK platform-tools to PATH.",
  );
}

export function listDevices(adb) {
  const result = run(adb, ["devices"], { stdio: "pipe" });
  return result.stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/))
    .filter(([, state]) => state === "device")
    .map(([serial]) => serial);
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
    stdio: options.allowFailure ? "pipe" : options.stdio ?? "inherit",
  });

  if (result.error && !options.allowFailure) {
    throw result.error;
  }

  if (!options.allowFailure && result.status !== 0) {
    throw new Error(`${command} exited with code ${result.status ?? 1}.`);
  }

  return result;
}

function quoteWindowsShellArg(value) {
  if (!/[\s"&|<>^()]/.test(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '""')}"`;
}
