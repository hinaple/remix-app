import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] ?? "check";
const packageFiles = [
  ["@remixapp/app", "packages/app/package.json"],
  ["@remixapp/cli", "packages/cli/package.json"],
  ["@remixapp/core", "packages/core/package.json"],
  ["@remixapp/runtime", "packages/runtime/package.json"],
  ["@remixapp/sdk", "packages/sdk/package.json"],
  ["@remixapp/create", "packages/create-remixapp/package.json"],
];
const sdkVersionFile = resolve("packages/sdk/src/version.ts");
const androidVersionFile = resolve("packages/app/android/version.properties");
const templatePackageFile = resolve(
  "packages/create-remixapp/template-default/package.json",
);
const documentationFiles = [resolve("README.md"), resolve("README_ko.md")];

if (mode !== "check" && mode !== "sync") {
  fail("Usage: node scripts/release-versions.mjs <check|sync>");
}

const packages = packageFiles.map(([expectedName, relativePath]) => {
  const file = resolve(relativePath);
  const value = readJson(file);
  if (value.name !== expectedName) {
    fail(`Expected ${expectedName} at ${relativePath}, found ${String(value.name)}`);
  }
  if (!isSemanticVersion(value.version)) {
    fail(`${expectedName} has an invalid version: ${String(value.version)}`);
  }
  return { name: expectedName, file, value, version: value.version };
});

const productVersion = packages.find(({ name }) => name === "@remixapp/sdk")
  ?.version;
if (!productVersion) fail("Could not resolve @remixapp/sdk version");

const mismatchedPackages = packages.filter(
  ({ version }) => version !== productVersion,
);
if (mismatchedPackages.length > 0) {
  fail(
    `Lockstep package versions do not match ${productVersion}: ${mismatchedPackages
      .map(({ name, version }) => `${name}@${version}`)
      .join(", ")}`,
  );
}

if (mode === "sync") {
  syncRootVersion(productVersion);
  syncPublicInternalDependencies(productVersion);
  syncTemplateDependencies(productVersion);
  syncSdkVersionConstant(productVersion);
  syncAndroidVersion(productVersion);
  syncDocumentationVersions(productVersion);
}

checkRootVersion(productVersion);
checkPublicInternalDependencies(productVersion);
checkTemplateDependencies(productVersion);
checkSdkVersionConstant(productVersion);
checkDocumentationVersions(productVersion);
const android = checkAndroidVersion(productVersion);

console.log(
  `Release versions are consistent: ${productVersion} (Android versionCode ${android.code})`,
);

function syncRootVersion(version) {
  const file = resolve("package.json");
  const value = readJson(file);
  if (value.version === version) return;
  value.version = version;
  writeJson(file, value);
}

function syncPublicInternalDependencies(version) {
  const cli = packages.find(({ name }) => name === "@remixapp/cli");
  if (!cli) fail("Could not resolve @remixapp/cli");

  let changed = false;
  for (const [field, name] of [
    ["dependencies", "@remixapp/sdk"],
    ["devDependencies", "@remixapp/runtime"],
  ]) {
    cli.value[field] ??= {};
    if (cli.value[field][name] !== version) {
      cli.value[field][name] = version;
      changed = true;
    }
  }
  if (changed) writeJson(cli.file, cli.value);
}

function syncTemplateDependencies(version) {
  const value = readJson(templatePackageFile);
  value.devDependencies ??= {};
  let changed = false;
  for (const name of ["@remixapp/cli", "@remixapp/sdk"]) {
    const expected = `^${version}`;
    if (value.devDependencies[name] !== expected) {
      value.devDependencies[name] = expected;
      changed = true;
    }
  }
  if (changed) writeJson(templatePackageFile, value);
}

function syncSdkVersionConstant(version) {
  const source = fs.readFileSync(sdkVersionFile, "utf8");
  const updated = source.replace(
    /export const REMIX_TOOLCHAIN_VERSION = "[^"]+";/,
    `export const REMIX_TOOLCHAIN_VERSION = "${version}";`,
  );
  if (updated === source) return;
  fs.writeFileSync(sdkVersionFile, updated, "utf8");
}

function syncAndroidVersion(version) {
  const current = readAndroidVersion();
  if (current.name === version) return;
  fs.writeFileSync(
    androidVersionFile,
    `REMIX_VERSION_NAME=${version}\nREMIX_VERSION_CODE=${current.code + 1}\n`,
    "utf8",
  );
}

function syncDocumentationVersions(version) {
  for (const file of documentationFiles) {
    const source = fs.readFileSync(file, "utf8");
    const updated = source.replace(
      /(\"builtWith\":\s*\{\s*\"cli\":\s*\")[^\"]+(\",\s*\"sdk\":\s*\")[^\"]+(\")/,
      `$1${version}$2${version}$3`,
    );
    if (updated === source) continue;
    fs.writeFileSync(file, updated, "utf8");
  }
}

function checkRootVersion(version) {
  const rootPackage = readJson(resolve("package.json"));
  if (rootPackage.version !== version) {
    fail(`Root package version must be ${version}, found ${String(rootPackage.version)}`);
  }
}

function checkPublicInternalDependencies(version) {
  const cli = packages.find(({ name }) => name === "@remixapp/cli");
  if (!cli) fail("Could not resolve @remixapp/cli");

  for (const [field, name] of [
    ["dependencies", "@remixapp/sdk"],
    ["devDependencies", "@remixapp/runtime"],
  ]) {
    const actual = cli.value[field]?.[name];
    if (actual !== version) {
      fail(`@remixapp/cli ${field}.${name} must be ${version}, found ${String(actual)}`);
    }
  }
}

function checkTemplateDependencies(version) {
  const template = readJson(templatePackageFile);
  for (const name of ["@remixapp/cli", "@remixapp/sdk"]) {
    const expected = `^${version}`;
    const actual = template.devDependencies?.[name];
    if (actual !== expected) {
      fail(`Template dependency ${name} must be ${expected}, found ${String(actual)}`);
    }
  }
}

function checkSdkVersionConstant(version) {
  const source = fs.readFileSync(sdkVersionFile, "utf8");
  const match = source.match(/export const REMIX_TOOLCHAIN_VERSION = "([^"]+)";/);
  if (match?.[1] !== version) {
    fail(`REMIX_TOOLCHAIN_VERSION must be ${version}, found ${match?.[1] ?? "missing"}`);
  }
}

function checkDocumentationVersions(version) {
  for (const file of documentationFiles) {
    const source = fs.readFileSync(file, "utf8");
    const match = source.match(
      /\"builtWith\":\s*\{\s*\"cli\":\s*\"([^\"]+)\",\s*\"sdk\":\s*\"([^\"]+)\"/,
    );
    if (match?.[1] !== version || match?.[2] !== version) {
      fail(
        `${path.relative(root, file)} builtWith example must use ${version}`,
      );
    }
  }
}

function checkAndroidVersion(version) {
  const android = readAndroidVersion();
  if (android.name !== version) {
    fail(`Android versionName must be ${version}, found ${android.name}`);
  }
  return android;
}

function readAndroidVersion() {
  const entries = Object.fromEntries(
    fs
      .readFileSync(androidVersionFile, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
  const name = entries.REMIX_VERSION_NAME;
  const code = Number(entries.REMIX_VERSION_CODE);
  if (!isSemanticVersion(name) || !Number.isInteger(code) || code < 1) {
    fail("Android version.properties must contain a SemVer name and positive integer code");
  }
  return { name, code };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isSemanticVersion(value) {
  return (
    typeof value === "string" &&
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
      value,
    )
  );
}

function resolve(relativePath) {
  return path.resolve(root, relativePath);
}

function fail(message) {
  console.error(`Release version error: ${message}`);
  process.exit(1);
}
