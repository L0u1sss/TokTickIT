import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

if (process.env.GITHUB_ACTIONS !== "true") throw new Error("CI provenance must be recorded inside GitHub Actions.");
const root = fileURLToPath(new URL("../", import.meta.url));
const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true }).trim();
const runId = process.env.GITHUB_RUN_ID;
if (!/^\d+$/.test(runId ?? "")) throw new Error("Missing GitHub Actions run ID.");
const output = path.join(root, "artifacts/lab-04/issue-61/hosted-ci", runId);
await mkdir(output, { recursive: true });
const sourceHashes = {};
for (const file of git(["ls-files", "-z", "server", "client", "scripts", ".github"]).split("\0").filter(Boolean).sort()) {
  sourceHashes[file] = createHash("sha256").update(await readFile(path.join(root, file))).digest("hex");
}
const reports = {};
for (const role of ["server", "client"]) {
  const outcome = process.env[`${role.toUpperCase()}_TEST_OUTCOME`];
  if (!["success", "failure"].includes(outcome)) {
    reports[role] = { available: false, stepOutcome: outcome || "not executed" }; continue;
  }
  try {
    const raw = await readFile(path.join(output, `${role}-results.json`), "utf8");
    const data = JSON.parse(raw);
    reports[role] = { stepOutcome: outcome, success: data.success, passed: data.numPassedTests, failed: data.numFailedTests, total: data.numTotalTests };
  } catch { reports[role] = { available: false, stepOutcome: outcome }; }
}
const manifest = { recordedAt: new Date().toISOString(), runId, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
  url: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${runId}`,
  checkoutSha: git(["rev-parse", "HEAD"]), githubSha: process.env.GITHUB_SHA, ref: process.env.GITHUB_REF,
  event: process.env.GITHUB_EVENT_NAME, headRef: process.env.GITHUB_HEAD_REF || null,
  jobStatusBeforeArtifactUpload: process.env.VERIFICATION_STATUS, sourceHashes, reports,
  note: "Workflow steps and final run conclusion remain authoritative; this manifest records the actual checkout and reports without replacing peer approval or local final-main evidence." };
await writeFile(path.join(output, "provenance.json"), JSON.stringify(manifest, null, 2) + "\n");
