import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = path.join(packageDir, "index.js");

test("keeps generated remixApp dependency versions aligned", () => {
  const templatePackage = readJson(path.join(packageDir, "template-default", "package.json"));
  const cliPackage = readJson(path.resolve(packageDir, "..", "cli", "package.json"));
  const sdkPackage = readJson(path.resolve(packageDir, "..", "sdk", "package.json"));

  assert.equal(
    templatePackage.devDependencies["@remixapp/cli"],
    `^${cliPackage.version}`,
  );
  assert.equal(
    templatePackage.devDependencies["@remixapp/sdk"],
    `^${sdkPackage.version}`,
  );
});

test("creates a normalized project from bundled template", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "create-remixapp-"));

  try {
    const result = runCreate(cwd, ["-n", "My Room", "-v", "1.2.3"]);
    assert.equal(result.status, 0, result.stderr);

    const projectDir = path.join(cwd, "my-room");
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(projectDir, "package.json"), "utf8"),
    );
    const config = fs.readFileSync(path.join(projectDir, "remix.config.ts"), "utf8");

    assert.equal(packageJson.name, "my-room");
    assert.equal(packageJson.version, "1.2.3");
    assert.equal(packageJson.license, "0BSD");
    assert.match(config, /name: "my-room"/);
    assert.match(config, /version: "1\.2\.3"/);
    assert.equal(fs.existsSync(path.join(projectDir, ".gitignore")), true);
    assert.equal(fs.existsSync(path.join(projectDir, "LICENSE")), true);
    assert.equal(fs.existsSync(path.join(projectDir, "src", "index.ts")), true);
    assert.equal(fs.existsSync(path.join(projectDir, "resources", "example.txt")), true);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("requires force for an existing directory in non-interactive mode", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "create-remixapp-"));
  const projectDir = path.join(cwd, "existing");
  fs.mkdirSync(projectDir);

  try {
    const result = runCreate(cwd, ["-n", "existing", "-v", "0.1.0"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /target directory already exists/);

    fs.writeFileSync(path.join(projectDir, "keep.txt"), "keep", "utf8");
    const forced = runCreate(cwd, ["-n", "existing", "-v", "0.1.0", "-f"]);
    assert.equal(forced.status, 0, forced.stderr);
    assert.doesNotMatch(forced.stderr, /target directory already exists/);
    assert.equal(fs.readFileSync(path.join(projectDir, "keep.txt"), "utf8"), "keep");
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("rejects invalid names and versions", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "create-remixapp-"));

  try {
    const invalidName = runCreate(cwd, ["-n", "bad/name", "-v", "0.1.0"]);
    assert.notEqual(invalidName.status, 0);
    assert.match(invalidName.stderr, /valid unscoped npm package name/);

    const invalidVersion = runCreate(cwd, ["-n", "valid", "-v", "one"]);
    assert.notEqual(invalidVersion.status, 0);
    assert.match(invalidVersion.stderr, /Expected a semantic version/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

function runCreate(cwd, args) {
  return spawnSync(process.execPath, [entry, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      REMIXAPP_CREATE_SKIP_INSTALL: "1",
      npm_config_user_agent: "npm/10.0.0 node/v20.0.0 win32 x64",
    },
  });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
