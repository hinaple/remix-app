import { capture, run } from "./utils.mjs";

export function assertGitHubReady() {
  const auth = run("gh", ["auth", "status"], {
    allowFailure: true,
    capture: true,
  });
  if (auth.status !== 0) {
    throw new Error(
      "GitHub CLI is unavailable or unauthenticated. Run: gh auth login",
    );
  }

  const pullRequests = JSON.parse(
    capture("gh", [
      "pr",
      "list",
      "--base",
      "main",
      "--state",
      "open",
      "--json",
      "title,url,headRefName",
    ]),
  );
  const releases = pullRequests.filter(
    (pullRequest) =>
      pullRequest.headRefName.startsWith("release/") ||
      pullRequest.title.startsWith("Release remixApp "),
  );
  if (releases.length > 0) {
    throw new Error(
      `Resolve the existing release pull request first:\n${releases
        .map((pullRequest) => `- ${pullRequest.title}: ${pullRequest.url}`)
        .join("\n")}`,
    );
  }
}

export function createReleasePullRequest({
  branch,
  changesets,
  commit,
  version,
}) {
  const body = [
    `Release remixApp packages at version ${version}.`,
    "",
    ...changesets.map((changeset) => `- ${changeset.summary}`),
  ].join("\n");
  const url = capture("gh", [
    "pr",
    "create",
    "--base",
    "main",
    "--head",
    branch,
    "--title",
    `Release remixApp ${version}`,
    "--body",
    body,
  ]);
  const pullRequest = JSON.parse(
    capture("gh", [
      "pr",
      "view",
      url,
      "--json",
      "url,title,headRefOid,baseRefName,headRefName,state",
    ]),
  );

  const expected = {
    baseRefName: "main",
    headRefName: branch,
    headRefOid: commit,
    state: "OPEN",
    title: `Release remixApp ${version}`,
  };
  const mismatches = Object.entries(expected)
    .filter(([key, value]) => pullRequest[key] !== value)
    .map(([key]) => key);
  if (mismatches.length > 0) {
    throw new Error(
      `Created pull request failed validation: ${mismatches.join(", ")}`,
    );
  }
  return pullRequest;
}

export function enableAutoMerge(url) {
  return (
    run("gh", ["pr", "merge", url, "--auto", "--merge"], {
      allowFailure: true,
    }).status === 0
  );
}
