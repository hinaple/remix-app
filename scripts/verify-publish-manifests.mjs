import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apachePackageDirectories = [
  "packages/app",
  "packages/sdk",
  "packages/core",
  "packages/cli",
  "packages/create-remixapp",
  "packages/runtime",
];
const publicPackages = [
  "packages/sdk",
  "packages/core",
  "packages/cli",
  "packages/create-remixapp",
];
const dependencyFields = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];
const expectedLicense = "Apache-2.0";
const rootLicense = fs.readFileSync(path.join(root, "LICENSE"), "utf8");

assert(
  readManifest(root).license === expectedLicense,
  `root license must be ${expectedLicense}`,
);

for (const relativeDirectory of apachePackageDirectories) {
  const directory = path.resolve(root, relativeDirectory);
  const manifest = readManifest(directory);
  const licensePath = path.join(directory, "LICENSE");

  assert(
    manifest.license === expectedLicense,
    `${manifest.name} license must be ${expectedLicense}`,
  );
  assert(
    fs.existsSync(licensePath) && fs.statSync(licensePath).isFile(),
    `${manifest.name} must include LICENSE`,
  );
  assert(
    fs.readFileSync(licensePath, "utf8") === rootLicense,
    `${manifest.name} LICENSE must match the root Apache-2.0 license`,
  );
}

const templateDirectory = path.join(
  root,
  "packages/create-remixapp/template-default",
);
const templateManifest = readManifest(templateDirectory);
assert(templateManifest.license === "0BSD", "template license must be 0BSD");
assert(
  fs.existsSync(path.join(templateDirectory, "LICENSE")),
  "template must include its 0BSD LICENSE",
);

for (const relativeDirectory of publicPackages) {
  const directory = path.resolve(root, relativeDirectory);
  const manifest = readManifest(directory);

  assert(manifest.private !== true, `${manifest.name} must not be private`);
  assert(
    manifest.publishConfig?.access === "public",
    `${manifest.name} publishConfig.access must be public`,
  );
  assert(
    Array.isArray(manifest.files) && manifest.files.length > 0,
    `${manifest.name} must declare package files`,
  );
  assert(
    fs.statSync(path.join(directory, "README.md")).isFile(),
    `${manifest.name} must include README.md`,
  );
  for (const field of dependencyFields) {
    for (const [name, range] of Object.entries(manifest[field] ?? {})) {
      assert(
        typeof range === "string" && !range.startsWith("workspace:"),
        `${manifest.name} ${field}.${name} must use a publishable version range`,
      );
    }
  }

  for (const [name, target] of Object.entries(manifest.bin ?? {})) {
    assert(
      typeof target === "string" &&
        !target.startsWith("./") &&
        !path.isAbsolute(target) &&
        !target.split(/[\\/]/).includes(".."),
      `${manifest.name} bin.${name} must be a normalized package-relative path`,
    );
  }
}

console.log("Public npm package manifests are publishable.");

function readManifest(directory) {
  return JSON.parse(
    fs.readFileSync(path.join(directory, "package.json"), "utf8"),
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
