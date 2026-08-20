import { randomInt, randomUUID } from "node:crypto";
import {
  Prisma,
  PrismaClient,
  Priority,
  Status,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedDatabase } from "../../prisma/seed.js";

const prisma = new PrismaClient();

const categoryNames = [
  "Account and Access",
  "Hardware",
  "Software",
  "Network",
];
const relatedSystemNames = [
  "Email",
  "Campus Wi-Fi",
  "VPN",
  "LEB2 App",
  "Grade Submission App",
  "Corporate Laptop",
];
const requesterEmails = [
  "jennifer.a@example.com",
  "michael.b@example.com",
  "sarah.j@example.com",
  "david.l@example.com",
  "inactive.user@example.com",
];

const testRunId = randomUUID();
const ticketYear = new Date().getUTCFullYear();
let ticketSequence = 0;
let fileSequence = 0;
const createdTicketIds: number[] = [];
const createdAttachmentIds: number[] = [];

let requesterId: number;
let categoryId: number;
let relatedSystemId: number;

function nextTicketNumber() {
  ticketSequence += 1;
  return `TKT-${ticketYear}-${ticketSequence.toString().padStart(6, "0")}`;
}

function nextFileKey() {
  fileSequence += 1;
  return `db-schema-tests/${testRunId}/${fileSequence}`;
}

function validTicketData(
  overrides: Partial<Prisma.TicketUncheckedCreateInput> = {},
): Prisma.TicketUncheckedCreateInput {
  return {
    ticketNumber: nextTicketNumber(),
    summary: "Database constraint verification",
    description: "A valid description used by the database schema tests.",
    requestedPriority: Priority.MEDIUM,
    requesterId,
    categoryId,
    relatedSystemId,
    ...overrides,
  };
}

async function createTestTicket(
  overrides: Partial<Prisma.TicketUncheckedCreateInput> = {},
) {
  const ticket = await prisma.ticket.create({
    data: validTicketData(overrides),
  });
  createdTicketIds.push(ticket.id);
  return ticket;
}

async function createTestAttachment(ticketId: number) {
  const attachment = await prisma.attachment.create({
    data: {
      ticketId,
      fileName: "database-evidence.pdf",
      fileKey: nextFileKey(),
      fileSize: 1_024,
      mimeType: "application/pdf",
    },
  });
  createdAttachmentIds.push(attachment.id);
  return attachment;
}

async function seededRecordCounts() {
  const [
    categories,
    relatedSystems,
    requesters,
    activeRequesters,
    inactiveRequesters,
  ] = await Promise.all([
    prisma.category.count({ where: { name: { in: categoryNames } } }),
    prisma.relatedSystem.count({
      where: { name: { in: relatedSystemNames } },
    }),
    prisma.requesterUser.count({
      where: { email: { in: requesterEmails } },
    }),
    prisma.requesterUser.count({
      where: { email: { in: requesterEmails }, isActive: true },
    }),
    prisma.requesterUser.count({
      where: { email: { in: requesterEmails }, isActive: false },
    }),
  ]);

  return {
    categories,
    relatedSystems,
    requesters,
    activeRequesters,
    inactiveRequesters,
  };
}

async function expectCheckConstraintFailure(
  operation: Promise<unknown>,
  constraintName: string,
) {
  try {
    await operation;
    throw new Error(`Expected ${constraintName} to reject the write`);
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain(constraintName);
  }
}

async function reserveUnusedTicketNumberBlock() {
  const blockSize = 32;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const firstSequence = randomInt(0, 1_000_000 - blockSize);
    const candidates = Array.from({ length: blockSize }, (_, offset) =>
      `TKT-${ticketYear}-${(firstSequence + offset + 1)
        .toString()
        .padStart(6, "0")}`,
    );
    const existingCount = await prisma.ticket.count({
      where: { ticketNumber: { in: candidates } },
    });

    if (existingCount === 0) {
      ticketSequence = firstSequence;
      return;
    }
  }

  throw new Error("Unable to reserve unique ticket numbers for schema tests");
}

beforeAll(async () => {
  await seedDatabase(prisma);
  await reserveUnusedTicketNumberBlock();

  const [requester, category, relatedSystem] = await Promise.all([
    prisma.requesterUser.findUnique({
      where: { email: "jennifer.a@example.com" },
      select: { id: true },
    }),
    prisma.category.findUnique({
      where: { name: "Hardware" },
      select: { id: true },
    }),
    prisma.relatedSystem.findUnique({
      where: { name: "Corporate Laptop" },
      select: { id: true },
    }),
  ]);

  if (!requester || !category || !relatedSystem) {
    throw new Error("Required Lab 2 seed records are missing");
  }

  requesterId = requester.id;
  categoryId = category.id;
  relatedSystemId = relatedSystem.id;
});

afterAll(async () => {
  if (createdAttachmentIds.length > 0) {
    await prisma.attachment.deleteMany({
      where: { id: { in: createdAttachmentIds } },
    });
  }

  if (createdTicketIds.length > 0) {
    await prisma.ticket.deleteMany({
      where: { id: { in: createdTicketIds } },
    });
  }

  await prisma.$disconnect();
});

describe("Lab 2 database schema", () => {
  it("keeps the seed idempotent when its upserts run repeatedly", async () => {
    const before = await seededRecordCounts();

    await expect(seedDatabase(prisma)).resolves.toBeUndefined();
    await expect(seedDatabase(prisma)).resolves.toBeUndefined();

    const after = await seededRecordCounts();
    expect(after).toEqual(before);
    expect(after).toEqual({
      categories: 4,
      relatedSystems: 6,
      requesters: 5,
      activeRequesters: 4,
      inactiveRequesters: 1,
    });
  });

  it("rejects duplicate requester emails", async () => {
    await expect(
      prisma.requesterUser.create({
        data: {
          name: "Duplicate Jennifer",
          email: "jennifer.a@example.com",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("rejects duplicate category and related-system names", async () => {
    await expect(
      prisma.category.create({ data: { name: "Hardware" } }),
    ).rejects.toMatchObject({ code: "P2002" });

    await expect(
      prisma.relatedSystem.create({ data: { name: "Email" } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("rejects duplicate ticket numbers", async () => {
    const ticketNumber = nextTicketNumber();
    await createTestTicket({ ticketNumber });

    await expect(
      prisma.ticket.create({ data: validTicketData({ ticketNumber }) }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("rejects tickets with missing requester or category foreign keys", async () => {
    await expect(
      prisma.ticket.create({
        data: validTicketData({ requesterId: 2_147_483_647 }),
      }),
    ).rejects.toMatchObject({ code: "P2003" });

    await expect(
      prisma.ticket.create({
        data: validTicketData({ categoryId: 2_147_483_647 }),
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("applies NEW and false defaults to tickets and attachments", async () => {
    const ticket = await createTestTicket();
    expect(ticket.currentStatus).toBe(Status.NEW);

    const attachment = await createTestAttachment(ticket.id);
    expect(attachment.isRemoved).toBe(false);
    expect(attachment.removedAt).toBeNull();
    expect(attachment.removalReason).toBeNull();
  });

  it("persists all soft-removal fields together", async () => {
    const ticket = await createTestTicket();
    const attachment = await createTestAttachment(ticket.id);
    const removedAt = new Date();
    const removalReason = "Uploaded a corrected replacement file.";

    const removed = await prisma.attachment.update({
      where: { id: attachment.id },
      data: { isRemoved: true, removedAt, removalReason },
    });

    expect(removed.isRemoved).toBe(true);
    expect(removed.removedAt).toEqual(removedAt);
    expect(removed.removalReason).toBe(removalReason);
  });

  it("enforces ticket and attachment check constraints", async () => {
    await expectCheckConstraintFailure(
      prisma.ticket.create({
        data: validTicketData({ ticketNumber: "BAD-2026-000001" }),
      }),
      "Ticket_ticketNumber_check",
    );

    await expectCheckConstraintFailure(
      prisma.ticket.create({ data: validTicketData({ summary: "four" }) }),
      "Ticket_summary_check",
    );

    await expectCheckConstraintFailure(
      prisma.ticket.create({
        data: validTicketData({ description: "123456789" }),
      }),
      "Ticket_description_check",
    );

    const ticket = await createTestTicket();
    await expectCheckConstraintFailure(
      prisma.attachment.create({
        data: {
          ticketId: ticket.id,
          fileName: "oversized.pdf",
          fileKey: nextFileKey(),
          fileSize: 5_242_881,
          mimeType: "application/pdf",
        },
      }),
      "Attachment_fileSize_check",
    );

    await expectCheckConstraintFailure(
      prisma.attachment.create({
        data: {
          ticketId: ticket.id,
          fileName: "mismatched.png",
          fileKey: nextFileKey(),
          fileSize: 1_024,
          mimeType: "application/pdf",
        },
      }),
      "Attachment_type_check",
    );

    await expectCheckConstraintFailure(
      prisma.attachment.create({
        data: {
          ticketId: ticket.id,
          fileName: "incomplete-removal.pdf",
          fileKey: nextFileKey(),
          fileSize: 1_024,
          mimeType: "application/pdf",
          isRemoved: true,
        },
      }),
      "Attachment_removalState_check",
    );
  });

  it("creates all required ticket and attachment indexes", async () => {
    const indexes = await prisma.$queryRaw<
      { indexname: string; indexdef: string }[]
    >`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename IN ('Ticket', 'Attachment')
    `;

    const indexesByName = new Map(
      indexes.map(({ indexname, indexdef }) => [indexname, indexdef]),
    );
    const expectedIndexes = new Map([
      ["Ticket_requesterId_idx", '("requesterId")'],
      ["Ticket_ticketNumber_idx", '("ticketNumber")'],
      ["Ticket_currentStatus_idx", '("currentStatus")'],
      ["Ticket_createdAt_idx", '("createdAt")'],
      ["Attachment_ticketId_idx", '("ticketId")'],
      ["Attachment_isRemoved_idx", '("isRemoved")'],
    ]);

    for (const [indexName, indexedColumns] of expectedIndexes) {
      expect(indexesByName.get(indexName)).toContain(indexedColumns);
    }
  });
});
