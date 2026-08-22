import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.resolve(root, ".remix/release-packs");
const packageDirs = [
  "packages/sdk",
  "packages/core",
  "packages/cli",
  "packages/create-remixapp",
];
const pnpmScript = process.env.npm_execpath;

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const relativeDir of packageDirs) {
  const packageDir = path.resolve(root, relativeDir);
  const command = pnpmScript
    ? process.execPath
    : process.platform === "win32"
      ? "cmd.exe"
      : "pnpm";
  const prefix = pnpmScript
    ? [pnpmScript]
    : process.platform === "win32"
      ? ["/d", "/s", "/c", "pnpm"]
      : [];
  const result = spawnSync(
    command,
    [...prefix, "--dir", packageDir, "pack", "--pack-destination", output],
    { cwd: root, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const tarballs = fs.readdirSync(output).filter((file) => file.endsWith(".tgz"));
if (tarballs.length !== packageDirs.length) {
  throw new Error(
    `Expected ${packageDirs.length} release tarballs, found ${tarballs.length}`,
  );
}
console.log(`Release packages created in ${output}`);
