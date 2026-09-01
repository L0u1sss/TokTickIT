import { loadEnvFile } from "node:process";

// Database-backed projects may read TEST_DATABASE_URL from server/.env, but
// they must never fall back to the shared development DATABASE_URL.
try {
  loadEnvFile(".env");
} catch {
  // The explicit environment-variable checks below provide the useful error.
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL is required. Point it to a disposable PostgreSQL test database or test-marked schema.",
  );
}

let parsedTestDatabaseUrl: URL;

try {
  parsedTestDatabaseUrl = new URL(testDatabaseUrl);
} catch {
  throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
}

if (
  parsedTestDatabaseUrl.protocol !== "postgresql:" &&
  parsedTestDatabaseUrl.protocol !== "postgres:"
) {
  throw new Error("TEST_DATABASE_URL must use the PostgreSQL protocol.");
}

const databaseName = decodeURIComponent(
  parsedTestDatabaseUrl.pathname.replace(/^\//, ""),
);
const schemaName = parsedTestDatabaseUrl.searchParams.get("schema") ?? "public";
const isolationLabel = `${databaseName}/${schemaName}`.toLowerCase();
const isolationSegments = isolationLabel.split(/[^a-z0-9]+/).filter(Boolean);

if (
  !isolationSegments.some((segment) =>
    ["test", "testing", "ci", "spec"].includes(segment),
  )
) {
  throw new Error(
    "TEST_DATABASE_URL must identify a database or schema with a delimited test, testing, ci, or spec marker.",
  );
}

const developmentDatabaseUrl = process.env.DATABASE_URL;

if (developmentDatabaseUrl) {
  try {
    const parsedDevelopmentDatabaseUrl = new URL(developmentDatabaseUrl);
    const developmentDatabaseName = decodeURIComponent(
      parsedDevelopmentDatabaseUrl.pathname.replace(/^\//, ""),
    );
    const developmentSchemaName =
      parsedDevelopmentDatabaseUrl.searchParams.get("schema") ?? "public";
    const testTarget = [
      parsedTestDatabaseUrl.hostname.toLowerCase(),
      parsedTestDatabaseUrl.port || "5432",
      databaseName,
      schemaName,
    ].join("/");
    const developmentTarget = [
      parsedDevelopmentDatabaseUrl.hostname.toLowerCase(),
      parsedDevelopmentDatabaseUrl.port || "5432",
      developmentDatabaseName,
      developmentSchemaName,
    ].join("/");

    if (testTarget === developmentTarget) {
      throw new Error(
        "TEST_DATABASE_URL must target a different database or schema from DATABASE_URL.",
      );
    }
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.startsWith("TEST_DATABASE_URL must target")
    ) {
      throw error;
    }

    throw new Error("DATABASE_URL must be a valid PostgreSQL URL when set.", {
      cause: error,
    });
  }
}

process.env.DATABASE_URL = testDatabaseUrl;

