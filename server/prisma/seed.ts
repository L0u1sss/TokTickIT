import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "../src/prisma.js";
import { hashPassword } from "../src/password.js";

export const LAB_INITIAL_PASSWORD = "Lab3-Initial-password1!";

export const staffAccounts = [
  { displayName: "Staff One", email: "staff.one@example.com", role: "IT_STAFF" as const, isActive: true },
  { displayName: "Staff Two", email: "staff.two@example.com", role: "IT_STAFF" as const, isActive: true },
  { displayName: "Staff Three", email: "staff.three@example.com", role: "IT_STAFF" as const, isActive: true },
  { displayName: "Inactive Staff", email: "inactive.staff@example.com", role: "IT_STAFF" as const, isActive: false },
  { displayName: "Lab Administrator", email: "admin@example.com", role: "ADMINISTRATOR" as const, isActive: true },
];

export const categories = [
  "Account and Access",
  "Hardware",
  "Software",
  "Network",
] as const;

export const relatedSystems = [
  "Email",
  "Campus Wi-Fi",
  "VPN",
  "LEB2 App",
  "Grade Submission App",
  "Corporate Laptop",
] as const;

export const requesters = [
  {
    displayName: "Jennifer Anderson",
    email: "jennifer.a@example.com",
    isActive: true,
  },
  {
    displayName: "Michael Brown",
    email: "michael.b@example.com",
    isActive: true,
  },
  {
    displayName: "Sarah Johnson",
    email: "sarah.j@example.com",
    isActive: true,
  },
  {
    displayName: "David Lee",
    email: "david.l@example.com",
    isActive: true,
  },
  {
    displayName: "Inactive User",
    email: "inactive.user@example.com",
    isActive: false,
  },
] as const;

export async function seedDatabase(prisma: PrismaClient) {
  if (process.env.NODE_ENV === "production") throw new Error("Lab seed is disabled in production.");
  const passwordHash = await hashPassword(LAB_INITIAL_PASSWORD);
  await prisma.$transaction([
    ...categories.map((name) =>
      prisma.category.upsert({
        where: { name },
        update: { isActive: true },
        create: { name, isActive: true },
      }),
    ),
    ...relatedSystems.map((name) =>
      prisma.relatedSystem.upsert({
        where: { name },
        update: { isActive: true },
        create: { name, isActive: true },
      }),
    ),
    ...requesters.map(({ email, ...data }) =>
      prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, ...data, role: "REQUESTER", passwordHash, mustChangePassword: true },
      }),
    ),
    ...staffAccounts.map(({ email, ...data }) => prisma.user.upsert({
      where: { email }, update: {},
      create: { email, ...data, passwordHash, mustChangePassword: true },
    })),
  ]);

  console.log(
    `Seeded ${categories.length} categories, ${relatedSystems.length} related systems, ${requesters.length} Requesters and ${staffAccounts.length} staff/admin accounts. Local-only initial password: see README; existing credentials are preserved.`,
  );
}

async function runSeedCommand() {
  const prisma = getPrisma();

  try {
    await seedDatabase(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

const entryPath = process.argv[1];
const isDirectExecution =
  entryPath !== undefined &&
  import.meta.url === pathToFileURL(resolve(entryPath)).href;

if (isDirectExecution) {
  void runSeedCommand().catch((error: unknown) => {
    console.error("Database seed failed:", error);
    process.exitCode = 1;
  });
}
