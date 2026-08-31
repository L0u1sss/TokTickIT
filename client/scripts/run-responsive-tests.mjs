import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const viteEntry = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const playwrightEntry = fileURLToPath(
  new URL("../node_modules/@playwright/test/cli.js", import.meta.url),
);
const baseUrl = "http://127.0.0.1:4173";

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

async function waitForServer(server) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Vite exited before ${baseUrl} became ready.`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.ok && server.exitCode === null) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Vite did not become ready at ${baseUrl}.`);
}

const server = spawn(
  process.execPath,
  [viteEntry, "--host", "127.0.0.1", "--port", "4173", "--strictPort"],
  { stdio: "ignore", windowsHide: true },
);
const serverExit = waitForExit(server);

let exitCode;
try {
  await waitForServer(server);
  const runner = spawn(
    process.execPath,
    [playwrightEntry, "test", "e2e/lab-02/responsive.spec.ts", ...process.argv.slice(2)],
    {
      env: { ...process.env, PLAYWRIGHT_EXTERNAL_SERVER: "1" },
      stdio: "inherit",
      windowsHide: true,
    },
  );
  const result = await waitForExit(runner);
  exitCode = result.code ?? 1;
} finally {
  if (server.exitCode === null) server.kill();
  await Promise.race([
    serverExit,
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
}

process.exitCode = exitCode ?? 1;
