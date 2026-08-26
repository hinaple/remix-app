import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  REMIX_PROJECT_FORMAT_VERSION,
  REMIX_RUNTIME_API_VERSION,
  REMIX_TOOLCHAIN_VERSION,
} from "../packages/sdk/dist/version.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exampleConfig = fs.readFileSync(
  path.resolve(root, "projects/example/remix.config.ts"),
  "utf8",
);
const version = exampleConfig.match(/version:\s*"([^"]+)"/)?.[1];
if (!version) throw new Error("Could not resolve example project version");

const manifest = readJson(
  `projects/example/dist/example-${version}-unpacked/project.json`,
);
assert(
  manifest.formatVersion === REMIX_PROJECT_FORMAT_VERSION,
  `example formatVersion must be ${REMIX_PROJECT_FORMAT_VERSION}`,
);
assert(
  manifest.runtimeApiVersion === REMIX_RUNTIME_API_VERSION,
  `example runtimeApiVersion must be ${REMIX_RUNTIME_API_VERSION}`,
);
assert(
  manifest.builtWith?.cli === REMIX_TOOLCHAIN_VERSION &&
    manifest.builtWith?.sdk === REMIX_TOOLCHAIN_VERSION,
  "example builtWith versions must match the toolchain",
);
assert(Array.isArray(manifest.nativeEvents?.rules), "example nativeEvents must be built");
assert(
  manifest.nativeEvents.rules.every((rule) => rule.activityState === "always"),
  "example nativeEvents must default activityState to always",
);
console.log(`Example manifest verified for toolchain ${REMIX_TOOLCHAIN_VERSION}.`);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(root, relativePath), "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
