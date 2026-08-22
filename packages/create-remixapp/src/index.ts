import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createInterface, type Interface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const DEFAULT_VERSION = "0.1.0";
const TEMPLATE_NAME_TOKEN = "__REMIXAPP_NAME__";
const TEMPLATE_VERSION_TOKEN = "__REMIXAPP_VERSION__";
const renameFiles: Record<string, string | undefined> = {
  _gitignore: ".gitignore",
};

interface CreateOptions {
  name?: string;
  version?: string;
  force: boolean;
}

class CreateRemixAppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreateRemixAppError";
  }
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));

  if (options === "help") {
    printHelp();
    return;
  }

  const prompt = new PromptSession();

  try {
    const name = await resolveName(options.name, prompt);
    const version = await resolveVersion(options.version, prompt);
    const targetDir = path.resolve(process.cwd(), name);

    if (!(await confirmExistingDirectory(targetDir, options.force, prompt))) {
      console.log("Operation cancelled.");
      return;
    }

    scaffoldProject(targetDir, name, version);

    const packageManager = detectPackageManager();
    installDependencies(targetDir, packageManager);

    console.log(`\nCreated ${name} at ${targetDir}`);
  } finally {
    prompt.close();
  }
}

function parseOptions(args: string[]): CreateOptions | "help" {
  const options: CreateOptions = { force: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      return "help";
    }

    if (arg === "--force" || arg === "-f") {
      options.force = true;
      continue;
    }

    if (arg === "--name" || arg === "-n") {
      options.name = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--version" || arg === "-v") {
      options.version = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    throw new CreateRemixAppError(`Unknown option: ${arg}`);
  }

  return options;
}

function readOptionValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];

  if (!value || value.startsWith("-")) {
    throw new CreateRemixAppError(`Missing value for ${option}`);
  }

  return value;
}

async function resolveName(
  providedName: string | undefined,
  prompt: PromptSession,
): Promise<string> {
  if (providedName !== undefined) {
    return validateAndNormalizeName(providedName);
  }

  prompt.assertInteractive("Missing project name. Use --name <name>.");

  while (true) {
    const answer = await prompt.question("Project name: ");

    try {
      return validateAndNormalizeName(answer);
    } catch (error) {
      console.warn(formatError(error));
    }
  }
}

async function resolveVersion(
  providedVersion: string | undefined,
  prompt: PromptSession,
): Promise<string> {
  if (providedVersion !== undefined) {
    return validateVersion(providedVersion);
  }

  prompt.assertInteractive("Missing project version. Use --version <version>.");

  while (true) {
    const answer = await prompt.question(`Project version (${DEFAULT_VERSION}): `);

    try {
      return validateVersion(answer || DEFAULT_VERSION);
    } catch (error) {
      console.warn(formatError(error));
    }
  }
}

function validateAndNormalizeName(value: string): string {
  const name = value.trim().toLowerCase().replace(/\s+/g, "-");

  if (!name) {
    throw new CreateRemixAppError("Project name must not be empty.");
  }

  if (!/^[a-z\d\-~][a-z\d\-._~]*$/.test(name)) {
    throw new CreateRemixAppError(
      "Project name must be a valid unscoped npm package name after normalization.",
    );
  }

  return name;
}

function validateVersion(value: string): string {
  const version = value.trim();
  const semverPattern =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

  if (!semverPattern.test(version)) {
    throw new CreateRemixAppError(
      `Invalid project version: ${value}. Expected a semantic version such as 0.1.0.`,
    );
  }

  return version;
}

async function confirmExistingDirectory(
  targetDir: string,
  force: boolean,
  prompt: PromptSession,
): Promise<boolean> {
  if (!fs.existsSync(targetDir)) {
    return true;
  }

  if (!fs.statSync(targetDir).isDirectory()) {
    throw new CreateRemixAppError(
      `Cannot create project because the target is not a directory: ${targetDir}`,
    );
  }

  if (force) {
    return true;
  }

  console.warn(`Warning: target directory already exists: ${targetDir}`);
  prompt.assertInteractive(
    "Use --force to create the project in the existing directory without confirmation.",
  );

  const answer = (await prompt.question("Continue and overwrite template files? (y/N) "))
    .trim()
    .toLowerCase();
  return answer === "y" || answer === "yes";
}

function scaffoldProject(targetDir: string, name: string, version: string): void {
  const templateDir = path.resolve(
    fileURLToPath(import.meta.url),
    "../..",
    "template-default",
  );

  if (!fs.existsSync(templateDir) || !fs.statSync(templateDir).isDirectory()) {
    throw new CreateRemixAppError(`Bundled template not found: ${templateDir}`);
  }

  fs.mkdirSync(targetDir, { recursive: true });

  for (const file of fs.readdirSync(templateDir)) {
    if (file === "package.json" || file === "remix.config.ts") {
      continue;
    }

    const targetName = renameFiles[file] ?? file;
    copy(path.join(templateDir, file), path.join(targetDir, targetName));
  }

  writePackageJson(templateDir, targetDir, name, version);
  writeRemixConfig(templateDir, targetDir, name, version);
}

function writePackageJson(
  templateDir: string,
  targetDir: string,
  name: string,
  version: string,
): void {
  const templatePath = path.join(templateDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(templatePath, "utf8")) as {
    name: string;
    version: string;
  };

  packageJson.name = name;
  packageJson.version = version;

  fs.writeFileSync(
    path.join(targetDir, "package.json"),
    `${JSON.stringify(packageJson, null, 2)}\n`,
    "utf8",
  );
}

function writeRemixConfig(
  templateDir: string,
  targetDir: string,
  name: string,
  version: string,
): void {
  const templatePath = path.join(templateDir, "remix.config.ts");
  const template = fs.readFileSync(templatePath, "utf8");

  if (
    !template.includes(TEMPLATE_NAME_TOKEN) ||
    !template.includes(TEMPLATE_VERSION_TOKEN)
  ) {
    throw new CreateRemixAppError(
      "Bundled remix.config.ts is missing required project placeholders.",
    );
  }

  const config = template
    .replaceAll(TEMPLATE_NAME_TOKEN, JSON.stringify(name))
    .replaceAll(TEMPLATE_VERSION_TOKEN, JSON.stringify(version));

  fs.writeFileSync(path.join(targetDir, "remix.config.ts"), config, "utf8");
}

function copy(source: string, target: string): void {
  const stat = fs.statSync(source);

  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });

    for (const child of fs.readdirSync(source)) {
      copy(path.join(source, child), path.join(target, child));
    }

    return;
  }

  fs.copyFileSync(source, target);
}

function detectPackageManager(): "npm" | "pnpm" | "yarn" | "bun" {
  const agent = process.env.npm_config_user_agent?.split(" ")[0]?.split("/")[0];

  if (agent === "pnpm" || agent === "yarn" || agent === "bun") {
    return agent;
  }

  return "npm";
}

function installDependencies(
  targetDir: string,
  packageManager: "npm" | "pnpm" | "yarn" | "bun",
): void {
  if (process.env.REMIXAPP_CREATE_SKIP_INSTALL === "1") {
    console.log(`Skipping dependency installation with ${packageManager}.`);
    return;
  }

  const args = packageManager === "yarn" ? [] : ["install"];
  const command =
    process.platform === "win32" ? `${packageManager}.cmd` : packageManager;

  console.log(`Installing dependencies with ${packageManager}...`);
  const result = spawnSync(command, args, {
    cwd: targetDir,
    stdio: "inherit",
  });

  if (result.error) {
    throw new CreateRemixAppError(
      `Failed to run ${packageManager}: ${result.error.message}`,
    );
  }

  if (result.status !== 0) {
    throw new CreateRemixAppError(
      `${packageManager} dependency installation failed with exit code ${result.status ?? "unknown"}.`,
    );
  }
}

class PromptSession {
  private interface: Interface | undefined;

  assertInteractive(message: string): void {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      throw new CreateRemixAppError(message);
    }
  }

  async question(message: string): Promise<string> {
    this.interface ??= createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return await this.interface.question(message);
  }

  close(): void {
    this.interface?.close();
  }
}

function printHelp(): void {
  console.log(`create-remixapp

Usage:
  create-remixapp [--name <name>] [--version <version>] [--force]

Options:
  -n, --name <name>        project name and target directory
  -v, --version <version>  initial project version
  -f, --force              use an existing directory without confirmation
  -h, --help               display this help
`);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error: unknown) => {
  console.error(`Error: ${formatError(error)}`);
  process.exitCode = 1;
});
