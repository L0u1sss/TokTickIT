import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

const clientDirectory = fileURLToPath(new URL("../", import.meta.url));
const serverDirectory = fileURLToPath(new URL("../../server/", import.meta.url));
const serverEnvPath = path.join(serverDirectory, ".env");
const viteEntry = path.join(clientDirectory, "node_modules", "vite", "bin", "vite.js");
const playwrightEntry = path.join(
  clientDirectory,
  "node_modules",
  "@playwright",
  "test",
  "cli.js",
);
const prismaEntry = path.join(
  serverDirectory,
  "node_modules",
  "prisma",
  "build",
  "index.js",
);
const tsxEntry = path.join(serverDirectory, "node_modules", "tsx", "dist", "cli.mjs");
const serverEntry = path.join(serverDirectory, "src", "index.ts");
const serverBinaryDirectory = path.join(serverDirectory, "node_modules", ".bin");
const liveConfig = path.join(clientDirectory, "playwright.live.config.ts");
const clientPort = process.env.E2E_CLIENT_PORT ?? "4174";
const serverPort = process.env.E2E_SERVER_PORT ?? "3100";
const clientUrl = `http://127.0.0.1:${clientPort}`;
const apiUrl = `http://127.0.0.1:${serverPort}`;
const testFiles = [
  "e2e/lab-02/requester-ticket-lifecycle.spec.ts",
  "e2e/lab-02/ownership-isolation.spec.ts",
  "e2e/lab-02/requester-context.spec.ts",
  "e2e/lab-02/ticket-idempotency.spec.ts",
  "e2e/lab-02/state-recovery.spec.ts",
  "e2e/lab-02/accessibility.spec.ts",
];

if (!process.env.TEST_DATABASE_URL) {
  try {
    loadEnvFile(serverEnvPath);
  } catch {
    // The explicit validation below provides the actionable error.
  }
}

function databaseTarget(rawUrl, requireTestMarker) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("TEST_DATABASE_URL must use the PostgreSQL protocol.");
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  const schema = parsed.searchParams.get("schema") ?? "public";
  const segments = `${database}/${schema}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (
    requireTestMarker &&
    !segments.some((segment) => ["test", "testing", "ci", "spec"].includes(segment))
  ) {
    throw new Error("TEST_DATABASE_URL must identify an isolated test target.");
  }
  return [parsed.hostname.toLowerCase(), parsed.port || "5432", database, schema].join("/");
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for live E2E.");
}
const testTarget = databaseTarget(testDatabaseUrl, true);
if (
  process.env.DATABASE_URL &&
  databaseTarget(process.env.DATABASE_URL, false) === testTarget
) {
  throw new Error("TEST_DATABASE_URL must target a different database or schema from DATABASE_URL.");
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

async function stopChild(child, exitPromise) {
  if (child.exitCode === null) child.kill();
  await Promise.race([
    exitPromise,
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
}

async function runNode(entry, args, options = {}) {
  const child = spawn(process.execPath, [entry, ...args], {
    stdio: "inherit",
    windowsHide: true,
    ...options,
  });
  const result = await waitForExit(child);
  if (result.code !== 0) {
    throw new Error(`${path.basename(entry)} exited with code ${result.code ?? "unknown"}.`);
  }
}

async function waitForUrl(url, child, label) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`${label} exited before ${url} became ready.`);
    try {
      const response = await fetch(url);
      if (response.ok && child.exitCode === null) return;
    } catch {
      // The process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`${label} did not become ready at ${url}.`);
}

async function resetTestDatabase() {
  await runNode(
    prismaEntry,
    ["migrate", "reset", "--force", "--skip-generate"],
    {
      cwd: serverDirectory,
      env: {
        ...process.env,
        DATABASE_URL: testDatabaseUrl,
        TEST_DATABASE_URL: testDatabaseUrl,
        PATH: `${serverBinaryDirectory}${path.delimiter}${process.env.PATH ?? ""}`,
      },
    },
  );
}

const storageDirectory = await mkdtemp(path.join(tmpdir(), "toktickit-e2e-storage-"));
const vite = spawn(
  process.execPath,
  [viteEntry, "--host", "127.0.0.1", "--port", clientPort, "--strictPort"],
  {
    cwd: clientDirectory,
    env: { ...process.env, VITE_API_URL: apiUrl },
    stdio: "ignore",
    windowsHide: true,
  },
);
const viteExit = waitForExit(vite);
let exitCode = 0;

try {
  await waitForUrl(clientUrl, vite, "Vite");

  for (const testFile of testFiles) {
    await resetTestDatabase();
    await rm(storageDirectory, { recursive: true, force: true });
    await mkdir(storageDirectory, { recursive: true });

    const server = spawn(process.execPath, [tsxEntry, serverEntry], {
      cwd: serverDirectory,
      env: {
        ...process.env,
        DATABASE_URL: testDatabaseUrl,
        TEST_DATABASE_URL: testDatabaseUrl,
        PORT: serverPort,
        ATTACHMENT_STORAGE_DIR: storageDirectory,
      },
      stdio: "inherit",
      windowsHide: true,
    });
    const serverExit = waitForExit(server);

    try {
      await waitForUrl(`${apiUrl}/api/health`, server, "API server");
      await runNode(
        playwrightEntry,
        ["test", testFile, "--config", liveConfig, ...process.argv.slice(2)],
        {
          cwd: clientDirectory,
          env: {
            ...process.env,
            TEST_DATABASE_URL: testDatabaseUrl,
            E2E_API_URL: apiUrl,
            E2E_CLIENT_URL: clientUrl,
            E2E_SERVER_DIRECTORY: serverDirectory,
          },
        },
      );
    } finally {
      await stopChild(server, serverExit);
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  exitCode = 1;
} finally {
  await stopChild(vite, viteExit);
  await rm(storageDirectory, { recursive: true, force: true });
}

process.exitCode = exitCode;
