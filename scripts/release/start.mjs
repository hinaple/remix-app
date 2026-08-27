import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import {
  assertGitHubReady,
  createReleasePullRequest,
  enableAutoMerge,
} from "./github.mjs";
import {
  capture,
  node,
  readChangedPaths,
  readJson,
  root,
  run,
  runPnpm,
} from "./utils.mjs";

const options = new Set(process.argv.slice(2));
const supportedOptions = new Set(["--dry-run", "--no-auto-merge", "--yes"]);

const dryRun = options.has("--dry-run");
const autoMerge = !options.has("--no-auto-merge");
const assumeYes = options.has("--yes");

const releaseFiles = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "packages/app/android/version.properties",
  "packages/create-remixapp/template-default/package.json",
  "packages/sdk/src/version.ts",
]);
const packageReleaseFile =
  /^packages\/(?:app|cli|core|runtime|sdk|create-remixapp)\/(?:package\.json|CHANGELOG\.md)$/;

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Release start error: ${message}`);
  process.exitCode = 1;
}

async function main() {
  assertSupportedOptions();
  console.log("remixApp release\n");

  const context = preflight();
  printPlan(context.plan);

  if (dryRun) {
    console.log(
      "\nDry run passed. No files, commits, pushes, or pull requests were created.",
    );
    return;
  }

  if (!assumeYes) await confirm(context.plan.nextVersion);

  const releaseCommit = prepareRelease(context);
  publishRelease({ ...context, releaseCommit });
}

function preflight() {
  if (capture("git", ["branch", "--show-current"]) !== "develop") {
    fail("Release must start from the develop branch.");
  }
  assertCleanWorktree(root, "start a release");
  assertGitHubReady();

  step("Fetch main and develop");
  run("git", ["fetch", "origin", "develop", "main"]);

  const baseCommit = capture("git", ["rev-parse", "HEAD"]);
  const originDevelop = capture("git", ["rev-parse", "origin/develop"]);
  if (baseCommit !== originDevelop) {
    fail("Local develop must exactly match origin/develop.");
  }
  assertMainIsRepresentedInDevelop("origin/main", baseCommit);

  const plan = resolvePlan(readChangesetPlan());
  const releaseBranch = `release/${plan.nextVersion}`;
  if (readRemoteBranch(releaseBranch)) {
    fail(`Remote branch ${releaseBranch} already exists.`);
  }

  return { baseCommit, plan, releaseBranch };
}

function prepareRelease({ baseCommit, plan }) {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "remixapp-release-"),
  );
  const checkout = path.join(temporaryDirectory, "worktree");
  let worktreeAdded = false;

  try {
    step(`Prepare and verify ${plan.nextVersion}`);
    run("git", ["worktree", "add", "--detach", checkout, baseCommit]);
    worktreeAdded = true;

    copyAndroidSdkConfiguration(checkout);
    runPnpm(["install", "--frozen-lockfile"], { cwd: checkout });
    runPnpm(["exec", "changeset", "version"], { cwd: checkout });
    run(node, ["scripts/release/versions.mjs", "sync"], { cwd: checkout });
    runPnpm(["install", "--lockfile-only", "--ignore-scripts"], {
      cwd: checkout,
    });

    const generatedVersion = readJson(
      path.join(checkout, "package.json"),
    ).version;
    if (generatedVersion !== plan.nextVersion) {
      fail(
        `Generated version does not match the plan: ${generatedVersion} !== ${plan.nextVersion}`,
      );
    }

    run(node, ["scripts/release/check.mjs"], { cwd: checkout });

    const changedPaths = assertExpectedReleaseChanges(checkout);
    run("git", ["add", "--all", "--", ...changedPaths], { cwd: checkout });
    run("git", ["diff", "--cached", "--check"], { cwd: checkout });
    assertNoUnstagedChanges(checkout);

    step("Create verified release commit");
    run("git", ["commit", "-m", `chore: release ${plan.nextVersion}`], {
      cwd: checkout,
    });
    assertCleanWorktree(checkout, "finish release preparation");

    const commit = capture("git", ["rev-parse", "HEAD"], { cwd: checkout });
    console.log(`Verified commit: ${commit}`);
    return commit;
  } finally {
    if (worktreeAdded) {
      const removal = run(
        "git",
        ["worktree", "remove", "--force", checkout],
        { allowFailure: true, capture: true },
      );
      if (removal.status !== 0) {
        warn(`Could not remove temporary worktree: ${checkout}`);
      }
    }
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    run("git", ["worktree", "prune"], { allowFailure: true, capture: true });
  }
}

function publishRelease({ baseCommit, plan, releaseBranch, releaseCommit }) {
  if (capture("git", ["rev-parse", "HEAD"]) !== baseCommit) {
    fail("Local develop changed during release preparation.");
  }
  assertCleanWorktree(root, "publish the verified release");

  step("Recheck remote branches");
  run("git", ["fetch", "origin", "develop", "main"]);
  if (capture("git", ["rev-parse", "origin/develop"]) !== baseCommit) {
    fail("origin/develop changed during release preparation.");
  }
  assertMainIsRepresentedInDevelop("origin/main", baseCommit);
  if (readRemoteBranch(releaseBranch)) {
    fail(`Remote branch ${releaseBranch} was created during preparation.`);
  }

  step("Apply and push verified release commit");
  run("git", ["merge", "--ff-only", releaseCommit]);
  run("git", [
    "push",
    "--atomic",
    "origin",
    `${releaseCommit}:refs/heads/develop`,
    `${releaseCommit}:refs/heads/${releaseBranch}`,
  ]);

  step("Create release pull request");
  const pullRequest = createReleasePullRequest({
    branch: releaseBranch,
    changesets: plan.changesets,
    commit: releaseCommit,
    version: plan.nextVersion,
  });
  console.log(`Release PR: ${pullRequest.url}`);

  if (!autoMerge) {
    console.log("Merge the release PR after CI passes.");
    return;
  }

  if (enableAutoMerge(pullRequest.url)) {
    console.log("Auto-merge is enabled. Publishing starts after the PR merges.");
  } else {
    warn(`Could not enable auto-merge. Merge the PR manually: ${pullRequest.url}`);
  }
}

function readChangesetPlan() {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "remixapp-plan-"),
  );
  const outputFile = path.join(temporaryDirectory, "status.json");

  try {
    runPnpm(["exec", "changeset", "status", `--output=${outputFile}`], {
      capture: true,
    });
    return readJson(outputFile);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function resolvePlan(status) {
  const releases = status.releases.filter((release) => release.type !== "none");
  if (status.changesets.length === 0 || releases.length === 0) {
    fail("No pending changesets were found. Create one first with: pnpm changeset");
  }

  const versions = new Set(releases.map((release) => release.newVersion));
  if (versions.size !== 1) {
    fail(
      `Lockstep packages resolved to different versions: ${[...versions].join(", ")}`,
    );
  }

  const currentVersion = releases.find(
    (release) => release.name === "@remixapp/sdk",
  )?.oldVersion;
  if (!currentVersion) fail("Could not resolve the current toolchain version.");

  return {
    changesets: status.changesets,
    currentVersion,
    nextVersion: [...versions][0],
    releases,
  };
}

function printPlan(plan) {
  console.log(`Current:    ${plan.currentVersion}`);
  console.log(`Next:       ${plan.nextVersion}`);
  console.log(`Changesets: ${plan.changesets.length}`);
  console.log(
    `Packages:   ${plan.releases.map((release) => release.name).join(", ")}`,
  );
  console.log("\nRelease notes:");
  for (const changeset of plan.changesets) {
    const types = [...new Set(changeset.releases.map((release) => release.type))];
    console.log(`- [${types.join(", ")}] ${changeset.summary}`);
  }
}

function assertExpectedReleaseChanges(cwd) {
  const changedPaths = readChangedPaths(cwd);
  if (changedPaths.length === 0) {
    fail("Release versioning did not produce any changes.");
  }

  const unexpected = changedPaths.filter((file) => !isReleaseFile(file));
  if (unexpected.length > 0) {
    fail(`Release versioning changed unexpected files:\n${unexpected.join("\n")}`);
  }
  return changedPaths;
}

function isReleaseFile(file) {
  const normalized = file.replaceAll("\\", "/");
  return (
    releaseFiles.has(normalized) ||
    /^\.changeset\/[^/]+\.md$/.test(normalized) ||
    packageReleaseFile.test(normalized)
  );
}

function assertCleanWorktree(cwd, action) {
  const changedPaths = readChangedPaths(cwd);
  if (changedPaths.length > 0) {
    fail(
      `Commit or stash the working tree before attempting to ${action}:\n${changedPaths.join("\n")}`,
    );
  }
}

function assertNoUnstagedChanges(cwd) {
  const result = run("git", ["diff", "--quiet"], {
    allowFailure: true,
    capture: true,
    cwd,
  });
  if (result.status !== 0) {
    fail("Unstaged changes remain after staging release files.");
  }
}

function assertMainIsRepresentedInDevelop(mainCommit, developCommit) {
  const mergeBase = capture("git", ["merge-base", mainCommit, developCommit]);
  const result = run("git", ["diff", "--quiet", mergeBase, mainCommit], {
    allowFailure: true,
    capture: true,
  });
  if (result.status !== 0) {
    fail("origin/main contains changes that are not represented in develop.");
  }
}

function readRemoteBranch(branch) {
  const output = capture("git", [
    "ls-remote",
    "--heads",
    "origin",
    `refs/heads/${branch}`,
  ]);
  return output ? output.split(/\s+/)[0] : null;
}

function copyAndroidSdkConfiguration(checkout) {
  const relativePath = "packages/app/android/local.properties";
  const source = path.join(root, relativePath);
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, path.join(checkout, relativePath));
  } else if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
    fail(
      "Configure ANDROID_HOME, ANDROID_SDK_ROOT, or packages/app/android/local.properties.",
    );
  }
}

async function confirm(version) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    fail("Interactive confirmation is unavailable. Re-run with --yes.");
  }

  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question(`\nStart the ${version} release? [y/N] `);
    if (!/^(?:y|yes)$/i.test(answer.trim())) fail("Release cancelled.");
  } finally {
    prompt.close();
  }
}

function assertSupportedOptions() {
  const unknown = [...options].filter((option) => !supportedOptions.has(option));
  if (unknown.length > 0) fail(`Unknown option: ${unknown.join(", ")}`);
}

function step(label) {
  console.log(`\n==> ${label}`);
}

function warn(message) {
  console.warn(`Warning: ${message}`);
}

function fail(message) {
  throw new Error(message);
}
