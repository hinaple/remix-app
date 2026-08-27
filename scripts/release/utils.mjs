import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export const node = process.execPath;

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

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    shell: false,
    stdio: options.capture ? "pipe" : "inherit",
  });
  const status = result.status ?? 1;
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";

  if (!options.allowFailure && (result.error || status !== 0)) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        result.error?.message,
        stdout,
        stderr,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return { status, stdout, stderr };
}

export function capture(command, args, options = {}) {
  return run(command, args, { ...options, capture: true }).stdout.trim();
}

export function runPnpm(args, options = {}) {
  return run(pnpmCommand, [...pnpmPrefix, ...args], options);
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function listPendingChangesets(cwd = root) {
  return fs
    .readdirSync(path.join(cwd, ".changeset"))
    .filter((name) => name.endsWith(".md") && name.toLowerCase() !== "readme.md");
}

export function readChangedPaths(cwd = root) {
  const gitPaths = (args) =>
    run("git", args, { capture: true, cwd }).stdout.split("\0").filter(Boolean);

  return [
    ...new Set([
      ...gitPaths(["diff", "--name-only", "--no-renames", "-z"]),
      ...gitPaths(["diff", "--cached", "--name-only", "--no-renames", "-z"]),
      ...gitPaths(["ls-files", "--others", "--exclude-standard", "-z"]),
    ]),
  ];
}
