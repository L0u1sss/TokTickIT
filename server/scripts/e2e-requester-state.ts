import { loadEnvFile } from "node:process";

try {
  loadEnvFile(".env");
} catch {
  // CI supplies environment variables directly.
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL is required.");

const parsed = new URL(testDatabaseUrl);
const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
const schema = parsed.searchParams.get("schema") ?? "public";
const segments = `${database}/${schema}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
if (
  !["postgres:", "postgresql:"].includes(parsed.protocol) ||
  !segments.some((segment) => ["test", "testing", "ci", "spec"].includes(segment))
) {
  throw new Error("Refusing to mutate a non-test database target.");
}

const [email, requestedState] = process.argv.slice(2);
if (!email || !/^[a-z0-9._-]+@example\.com$/i.test(email)) {
  throw new Error("A seeded example.com requester email is required.");
}
if (requestedState !== "active" && requestedState !== "inactive") {
  throw new Error("Requester state must be active or inactive.");
}

process.env.DATABASE_URL = testDatabaseUrl;
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

try {
  const requester = await prisma.requesterUser.update({
    where: { email },
    data: { isActive: requestedState === "active" },
    select: { id: true },
  });
  console.log(`Requester fixture ${requester.id} is now ${requestedState}.`);
} finally {
  await prisma.$disconnect();
}
