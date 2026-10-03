import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const root = fileURLToPath(new URL("../", import.meta.url));
const issueOption = process.argv.slice(2).find(arg => arg.startsWith("--issue="));
const issue = issueOption ? Number(issueOption.slice("--issue=".length)) : 59;
if (![59, 60].includes(issue)) throw new Error("Supported evidence issues: 59, 60.");
const output = path.resolve(root, `artifacts/lab-04/issue-${issue}`);
await mkdir(output, { recursive: true });
const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true }).trim();
const sourcePaths = git(["ls-files", "--cached", "--others", "--exclude-standard", "-z", "server", "client", "scripts", ".github"])
  .split("\0").filter(Boolean).sort();
async function sourceHashes() {
  const hashes = {};
  for (const file of sourcePaths) hashes[file] = createHash("sha256").update(await readFile(path.join(root, file))).digest("hex");
  return hashes;
}
const source = await sourceHashes();
const manifest = { issue, branch: git(["branch", "--show-current"]), baselineCommit: git(["rev-parse", "HEAD"]),
  baselineStatus: git(["status", "--short"]), sourceHashes: source,
  startedAt: new Date().toISOString(), displayTimezone: "Asia/Bangkok", node: process.version,
  platform: process.platform, architecture: process.arch, cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length,
  memoryGiB: Math.round(os.totalmem() / 1024 ** 3), results: [],
  hostedCI: "Not run for this uncommitted worktree; previous PR CI is historical evidence only." };
const npm = path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
const steps = [
  ["server-lint", "server", [npm, "run", "lint"]],
  ["client-lint", "client", [npm, "run", "lint"]],
  ["prisma-validate", "server", ["node_modules/prisma/build/index.js", "validate"]],
  ["server-build", "server", [npm, "run", "build"]],
  ["client-build", "client", [npm, "run", "build"]],
  ["server-regression", "server", [npm, "run", "test:isolated", "--", "--reporter=default", "--reporter=json", `--outputFile=${path.join(output, "server-results.json")}`]],
  ["client-regression", "client", [npm, "test", "--", "--reporter=default", "--reporter=json", `--outputFile=${path.join(output, "client-results.json")}`]],
  ["dashboard-performance", "server", [npm, "run", "test:performance"]],
  ["actions-e2e", "client", [npm, "run", "test:actions:e2e"]],
  ["resolution-e2e", "client", [npm, "run", "test:workflow:e2e"]],
  ["dashboards-e2e", "client", [npm, "run", "test:dashboards:e2e"]],
  ["authentication-e2e", "client", [npm, "run", "test:auth:e2e"]],
  ["administrator-e2e", "client", [npm, "run", "test:admin:e2e"]],
  ["staff-queue-e2e", "client", ["scripts/run-auth-e2e.mjs", "--staff-queue"]],
  ["staff-workflow-e2e", "client", [npm, "run", "test:staff:e2e"]],
  ["communications-e2e", "client", ["scripts/run-auth-e2e.mjs", "--communications"]],
  ["responsive-e2e", "client", [npm, "run", "test:responsive"]],
  ["ui-hardening-e2e", "client", [npm, "run", "test:ui:lab4"]],
  ["requester-regression-e2e", "client", [npm, "run", "test:e2e"]],
];
// Selective reruns remain explicit in the manifest; they never imply all steps ran.
const selected = process.argv.slice(2).filter(arg => !arg.startsWith("--issue="));
for (const name of selected) if (!steps.some(step => step[0] === name)) throw new Error(`Unknown check: ${name}`);
for (const [name, directory, args] of steps.filter(step => !selected.length || selected.includes(step[0]))) {
  const startedAt = new Date().toISOString();
  console.info(`Starting ${name}`);
  const liveLog = createWriteStream(path.join(output, `${name}.txt`));
  let log = "";
  const child = spawn(process.execPath, args, { cwd: path.join(root, directory), windowsHide: true,
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0", LAB4_PERFORMANCE_OUTPUT: path.join(output, "dashboard-performance.json") },
    stdio: ["ignore", "pipe", "pipe"] });
  for (const stream of [child.stdout, child.stderr]) { stream.setEncoding("utf8"); stream.on("data", data => { log += data; liveLog.write(data); }); }
  const exitCode = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", code => resolve(code ?? 1)); });
  await new Promise(resolve => liveLog.end(resolve));
  log = log.replace(/\u001b\[[0-9;]*m/g, "").replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const logPath = `${name}.txt`;
  await writeFile(path.join(output, logPath), log);
  manifest.results.push({ name, cwd: directory, command: ["node", ...args], startedAt, finishedAt: new Date().toISOString(), exitCode, status: exitCode === 0 ? "PASS" : "FAIL", log: logPath });
  await writeFile(path.join(output, selected.length ? "verification-selected.json" : "verification.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.info(`${name}: ${exitCode === 0 ? "PASS" : "FAIL"}; ${logPath}`);
  if (exitCode !== 0) process.exitCode = 1;
}
manifest.finishedAt = new Date().toISOString();
manifest.sourceUnchangedDuringRun = JSON.stringify(source) === JSON.stringify(await sourceHashes());
if (!manifest.sourceUnchangedDuringRun) process.exitCode = 1;
await writeFile(path.join(output, selected.length ? "verification-selected.json" : "verification.json"), JSON.stringify(manifest, null, 2) + "\n");
