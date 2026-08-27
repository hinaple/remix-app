import {
  listPendingChangesets,
  node,
  readChangedPaths,
  run,
  runPnpm,
} from "./utils.mjs";

const options = process.argv.slice(2);

try {
  if (options.some((option) => option !== "--check")) {
    throw new Error("Usage: node scripts/release/publish.mjs [--check]");
  }

  assertPublishReady();
  if (options.includes("--check")) {
    console.log("Release commit is ready for publishing.");
  } else {
    run(node, ["scripts/release/check.mjs --skip-android"]);
    run("git", ["diff", "--exit-code"]);
    run("git", ["diff", "--cached", "--exit-code"]);
    runPnpm(["exec", "changeset", "publish"]);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Release publish error: ${message}`);
  process.exitCode = 1;
}

function assertPublishReady() {
  const pendingChangesets = listPendingChangesets();
  if (pendingChangesets.length > 0) {
    throw new Error(
      `Publishing requires a release commit prepared by release:start. Pending changesets: ${pendingChangesets.join(", ")}`,
    );
  }

  const changedPaths = readChangedPaths();
  if (changedPaths.length > 0) {
    throw new Error(
      `Publishing requires a clean worktree:\n${changedPaths.join("\n")}`,
    );
  }
}
