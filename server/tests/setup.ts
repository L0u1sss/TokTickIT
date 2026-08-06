import { loadEnvFile } from "node:process";

// Load server/.env so DB-backed tests (e.g. GET /api/categories) can reach
// PostgreSQL. The file is gitignored, so no credentials land in the repo.
try {
  loadEnvFile(".env");
} catch {
  // No .env present — tests that need DATABASE_URL will fail loudly.
}
