import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "../src/prisma.js";

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
      prisma.requesterUser.upsert({
        where: { email },
        update: data,
        create: { email, ...data },
      }),
    ),
  ]);

  console.log(
    `Seeded ${categories.length} categories, ${relatedSystems.length} related systems, and ${requesters.length} requesters.`,
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
