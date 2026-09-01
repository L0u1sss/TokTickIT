import { randomInt, randomUUID } from "node:crypto";
import {
  Prisma,
  PrismaClient,
  Priority,
  Status,
} from "@prisma/client";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import { seedDatabase } from "../../prisma/seed.js";

const expectedCategories = [
  "Account and Access",
  "Hardware",
  "Software",
  "Network",
] as const;
const expectedRelatedSystems = [
  "Email",
  "Campus Wi-Fi",
  "VPN",
  "LEB2 App",
  "Grade Submission App",
  "Corporate Laptop",
] as const;
const expectedRequesters = [
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

const prisma = new PrismaClient();
const testRunId = randomUUID();
const testMarker = testRunId.replaceAll("-", "").slice(0, 12);
const storageKeyPrefix = `db-schema-tests/${testRunId}/`;
const ticketYear = new Date().getUTCFullYear();
const trackedClientRequestIds = new Set<string>();
const trackedStorageKeys = new Set<string>();

let ticketSequence = 0;
let fileSequence = 0;
let requesterId: number;
let categoryId: number;
let relatedSystemId: number;

function nextTicketNumber() {
  ticketSequence += 1;
  return `TKT-${ticketYear}-${ticketSequence.toString().padStart(6, "0")}`;
}

function nextStorageKey() {
  fileSequence += 1;
  const storageKey = `${storageKeyPrefix}${fileSequence}`;
  trackedStorageKeys.add(storageKey);
  return storageKey;
}

function validTicketData(
  overrides: Partial<Prisma.TicketUncheckedCreateInput> = {},
): Prisma.TicketUncheckedCreateInput {
  const data: Prisma.TicketUncheckedCreateInput = {
    ticketNumber: nextTicketNumber(),
    clientRequestId: randomUUID(),
    summary: "Database constraint verification",
    description: "A valid description used by the database schema tests.",
    requestedPriority: Priority.MEDIUM,
    requesterId,
    categoryId,
    relatedSystemId,
    ...overrides,
  };

  trackedClientRequestIds.add(data.clientRequestId);
  return data;
}

function validAttachmentData(
  ticketId: number,
  overrides: Partial<Prisma.AttachmentUncheckedCreateInput> = {},
): Prisma.AttachmentUncheckedCreateInput {
  const data: Prisma.AttachmentUncheckedCreateInput = {
    ticketId,
    originalName: "database-evidence.pdf",
    storageKey: nextStorageKey(),
    sizeBytes: 1_024,
    mimeType: "application/pdf",
    uploadedByRequesterId: requesterId,
    ...overrides,
  };

  trackedStorageKeys.add(data.storageKey);
  return data;
}

async function createTestTicket(
  overrides: Partial<Prisma.TicketUncheckedCreateInput> = {},
) {
  return prisma.ticket.create({ data: validTicketData(overrides) });
}

async function createTestAttachment(
  ticketId: number,
  overrides: Partial<Prisma.AttachmentUncheckedCreateInput> = {},
) {
  return prisma.attachment.create({
    data: validAttachmentData(ticketId, overrides),
  });
}

async function expectDatabaseFailure(
  run: () => Promise<unknown>,
  expectedMessageParts: string | readonly string[],
) {
  let caught: unknown;

  try {
    await run();
  } catch (error: unknown) {
    caught = error;
  }

  expect(
    caught,
    `Expected the database write to fail with ${String(expectedMessageParts)}`,
  ).toBeInstanceOf(Error);

  const message = (caught as Error).message;
  const expectedParts = Array.isArray(expectedMessageParts)
    ? expectedMessageParts
    : [expectedMessageParts];

  for (const expectedPart of expectedParts) {
    expect(message).toContain(expectedPart);
  }
}

async function seedSnapshot() {
  const [categoryRows, systemRows, requesterRows] = await Promise.all([
    prisma.category.findMany({
      where: { name: { in: [...expectedCategories] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, isActive: true },
    }),
    prisma.relatedSystem.findMany({
      where: { name: { in: [...expectedRelatedSystems] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, isActive: true },
    }),
    prisma.requesterUser.findMany({
      where: { email: { in: expectedRequesters.map(({ email }) => email) } },
      orderBy: { email: "asc" },
      select: {
        id: true,
        displayName: true,
        email: true,
        isActive: true,
      },
    }),
  ]);

  return { categoryRows, systemRows, requesterRows };
}

async function cleanupTestRows() {
  const storageKeys = [...trackedStorageKeys];
  const clientRequestIds = [...trackedClientRequestIds];

  if (storageKeys.length > 0) {
    await prisma.attachment.deleteMany({
      where: { storageKey: { in: storageKeys } },
    });
  }

  await prisma.attachment.deleteMany({
    where: { storageKey: { startsWith: storageKeyPrefix } },
  });

  if (clientRequestIds.length > 0) {
    await prisma.ticket.deleteMany({
      where: { clientRequestId: { in: clientRequestIds } },
    });
  }

  await prisma.requesterUser.deleteMany({
    where: { email: { contains: testMarker } },
  });
  await prisma.category.deleteMany({
    where: { name: { contains: testMarker } },
  });
  await prisma.relatedSystem.deleteMany({
    where: { name: { contains: testMarker } },
  });

  trackedStorageKeys.clear();
  trackedClientRequestIds.clear();
}

async function reserveUnusedTicketNumberBlock() {
  const blockSize = 128;

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
  await prisma.$connect();
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

afterEach(cleanupTestRows);

afterAll(async () => {
  await cleanupTestRows();
  await prisma.$disconnect();
});

describe("Lab 2 database integration contract", () => {
  it("applies the migration chain and exposes the five required models", async () => {
    const migrations = await prisma.$queryRaw<
      { migration_name: string; finished_at: Date | null }[]
    >`
      SELECT migration_name, finished_at
      FROM "_prisma_migrations"
      WHERE rolled_back_at IS NULL
    `;
    const completedMigrationNames = new Set(
      migrations
        .filter(({ finished_at }) => finished_at !== null)
        .map(({ migration_name }) => migration_name),
    );

    expect(completedMigrationNames.has("20260806000000_add_category")).toBe(
      true,
    );
    expect(
      completedMigrationNames.has("20260820130000_init_lab02_schema"),
    ).toBe(true);
    expect(
      completedMigrationNames.has("20260825000000_align_lab02_contract"),
    ).toBe(true);

    const columns = await prisma.$queryRaw<
      { tableName: string; columnName: string }[]
    >`
      SELECT table_name AS "tableName", column_name AS "columnName"
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name IN (
          'RequesterUser',
          'Category',
          'RelatedSystem',
          'Ticket',
          'Attachment'
        )
    `;
    const columnsByTable = new Map<string, string[]>();

    for (const { tableName, columnName } of columns) {
      const tableColumns = columnsByTable.get(tableName) ?? [];
      tableColumns.push(columnName);
      columnsByTable.set(tableName, tableColumns);
    }

    const expectedColumns = new Map<string, string[]>([
      [
        "RequesterUser",
        ["createdAt", "displayName", "email", "id", "isActive", "updatedAt"],
      ],
      [
        "Category",
        ["createdAt", "id", "isActive", "name", "updatedAt"],
      ],
      [
        "RelatedSystem",
        [
          "createdAt",
          "description",
          "id",
          "isActive",
          "name",
          "updatedAt",
        ],
      ],
      [
        "Ticket",
        [
          "categoryId",
          "clientRequestId",
          "createdAt",
          "description",
          "id",
          "relatedSystemId",
          "requestedPriority",
          "requesterId",
          "status",
          "summary",
          "ticketNumber",
          "updatedAt",
        ],
      ],
      [
        "Attachment",
        [
          "createdAt",
          "id",
          "mimeType",
          "originalName",
          "removalReason",
          "removedAt",
          "removedByRequesterId",
          "sizeBytes",
          "storageKey",
          "ticketId",
          "uploadedByRequesterId",
        ],
      ],
    ]);

    expect([...columnsByTable.keys()].sort()).toEqual(
      [...expectedColumns.keys()].sort(),
    );
    for (const [tableName, tableColumns] of expectedColumns) {
      expect(columnsByTable.get(tableName)?.sort()).toEqual(tableColumns.sort());
    }

    const enumValues = await prisma.$queryRaw<
      { enumName: string; enumValue: string }[]
    >`
      SELECT type.typname AS "enumName", enum.enumlabel AS "enumValue"
      FROM pg_type AS type
      JOIN pg_enum AS enum ON enum.enumtypid = type.oid
      JOIN pg_namespace AS namespace ON namespace.oid = type.typnamespace
      WHERE namespace.nspname = current_schema()
        AND type.typname IN ('Priority', 'Status')
      ORDER BY type.typname, enum.enumsortorder
    `;

    expect(enumValues).toEqual([
      { enumName: "Priority", enumValue: "LOW" },
      { enumName: "Priority", enumValue: "MEDIUM" },
      { enumName: "Priority", enumValue: "HIGH" },
      { enumName: "Status", enumValue: "NEW" },
    ]);
  });

  it("keeps the exact deterministic seed stable across repeated upserts", async () => {
    const before = await seedSnapshot();

    await expect(seedDatabase(prisma)).resolves.toBeUndefined();
    await expect(seedDatabase(prisma)).resolves.toBeUndefined();

    const after = await seedSnapshot();
    expect(after).toEqual(before);
    expect(after.categoryRows).toHaveLength(4);
    expect(after.systemRows).toHaveLength(6);
    expect(after.requesterRows).toHaveLength(5);
    expect(after.categoryRows.map(({ name }) => name).sort()).toEqual(
      [...expectedCategories].sort(),
    );
    expect(after.systemRows.map(({ name }) => name).sort()).toEqual(
      [...expectedRelatedSystems].sort(),
    );
    expect(
      after.requesterRows.map(({ displayName, email, isActive }) => ({
        displayName,
        email,
        isActive,
      })),
    ).toEqual(
      [...expectedRequesters]
        .map(({ displayName, email, isActive }) => ({
          displayName,
          email,
          isActive,
        }))
        .sort((left, right) => left.email.localeCompare(right.email)),
    );
    expect(after.requesterRows.filter(({ isActive }) => isActive)).toHaveLength(
      4,
    );
    expect(
      after.requesterRows.filter(({ isActive }) => !isActive),
    ).toHaveLength(1);
  });

  it("enforces all six unique business keys", async () => {
    await expect(
      prisma.requesterUser.create({
        data: {
          displayName: "Duplicate Jennifer",
          email: "jennifer.a@example.com",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      prisma.category.create({ data: { name: "Hardware" } }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      prisma.relatedSystem.create({ data: { name: "Email" } }),
    ).rejects.toMatchObject({ code: "P2002" });

    const ticketNumber = nextTicketNumber();
    const clientRequestId = randomUUID();
    await createTestTicket({ ticketNumber, clientRequestId });

    await expect(
      prisma.ticket.create({ data: validTicketData({ ticketNumber }) }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      prisma.ticket.create({ data: validTicketData({ clientRequestId }) }),
    ).rejects.toMatchObject({ code: "P2002" });

    const ticket = await createTestTicket();
    const storageKey = nextStorageKey();
    await createTestAttachment(ticket.id, { storageKey });
    await expect(
      prisma.attachment.create({
        data: validAttachmentData(ticket.id, { storageKey }),
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("enforces requester, category, and related-system field checks", async () => {
    await expectDatabaseFailure(
      () =>
        prisma.requesterUser.create({
          data: {
            displayName: ` Invalid ${testMarker} `,
            email: `display-${testMarker}@db-schema.invalid`,
          },
        }),
      "RequesterUser_displayName_check",
    );
    await expectDatabaseFailure(
      () =>
        prisma.requesterUser.create({
          data: {
            displayName: `Invalid Email ${testMarker}`,
            email: `invalid-${testMarker}@DB-SCHEMA.INVALID`,
          },
        }),
      "RequesterUser_email_check",
    );
    await expectDatabaseFailure(
      () =>
        prisma.category.create({
          data: { name: ` Invalid Category ${testMarker} ` },
        }),
      "Category_name_check",
    );
    await expectDatabaseFailure(
      () =>
        prisma.relatedSystem.create({
          data: { name: ` Invalid System ${testMarker} ` },
        }),
      "RelatedSystem_name_check",
    );
    await expectDatabaseFailure(
      () =>
        prisma.relatedSystem.create({
          data: {
            name: `Invalid Trimmed Description ${testMarker}`,
            description: ` Invalid description ${testMarker} `,
          },
        }),
      "RelatedSystem_description_check",
    );
    await expect(
      prisma.relatedSystem.create({
        data: {
          name: `Oversized Description ${testMarker}`,
          description: "x".repeat(501),
        },
      }),
    ).rejects.toMatchObject({ code: "P2000" });
  });

  it("enforces ticket boundaries and the exact priority/status enums", async () => {
    await expectDatabaseFailure(
      () =>
        prisma.ticket.create({
          data: validTicketData({ ticketNumber: "BAD-2026-000001" }),
        }),
      "Ticket_ticketNumber_check",
    );
    await expectDatabaseFailure(
      () =>
        prisma.ticket.create({
          data: validTicketData({ summary: "four" }),
        }),
      "Ticket_summary_check",
    );
    await expectDatabaseFailure(
      () =>
        prisma.ticket.create({
          data: validTicketData({ description: "123456789" }),
        }),
      "Ticket_description_check",
    );

    const invalidPriorityData = validTicketData();
    await expectDatabaseFailure(
      () =>
        prisma.$executeRawUnsafe(
          `INSERT INTO "Ticket" (
             "ticketNumber", "clientRequestId", "summary", "description",
             "requestedPriority", "status", "requesterId", "categoryId",
             "relatedSystemId", "updatedAt"
           ) VALUES ($1, $2::uuid, $3, $4, $5::"Priority", $6::"Status", $7, $8, $9, CURRENT_TIMESTAMP)`,
          invalidPriorityData.ticketNumber,
          invalidPriorityData.clientRequestId,
          invalidPriorityData.summary,
          invalidPriorityData.description,
          "CRITICAL",
          "NEW",
          invalidPriorityData.requesterId,
          invalidPriorityData.categoryId,
          invalidPriorityData.relatedSystemId,
        ),
      ["invalid input value for enum", "CRITICAL"],
    );

    const invalidStatusData = validTicketData();
    await expectDatabaseFailure(
      () =>
        prisma.$executeRawUnsafe(
          `INSERT INTO "Ticket" (
             "ticketNumber", "clientRequestId", "summary", "description",
             "requestedPriority", "status", "requesterId", "categoryId",
             "relatedSystemId", "updatedAt"
           ) VALUES ($1, $2::uuid, $3, $4, $5::"Priority", $6::"Status", $7, $8, $9, CURRENT_TIMESTAMP)`,
          invalidStatusData.ticketNumber,
          invalidStatusData.clientRequestId,
          invalidStatusData.summary,
          invalidStatusData.description,
          "LOW",
          "OPEN",
          invalidStatusData.requesterId,
          invalidStatusData.categoryId,
          invalidStatusData.relatedSystemId,
        ),
      ["invalid input value for enum", "OPEN"],
    );
  });

  it("applies status, timestamp, and active-attachment defaults", async () => {
    const ticket = await createTestTicket({ requestedPriority: Priority.HIGH });
    expect(ticket.status).toBe(Status.NEW);
    expect(ticket.createdAt).toBeInstanceOf(Date);
    expect(ticket.updatedAt).toBeInstanceOf(Date);

    const attachment = await createTestAttachment(ticket.id);
    expect(attachment.removedAt).toBeNull();
    expect(attachment.removalReason).toBeNull();
    expect(attachment.removedByRequesterId).toBeNull();

    const [defaultRequester, defaultCategory, defaultRelatedSystem] =
      await Promise.all([
        prisma.requesterUser.create({
          data: {
            displayName: `Default Requester ${testMarker}`,
            email: `default-${testMarker}@db-schema.invalid`,
          },
        }),
        prisma.category.create({
          data: { name: `Default Category ${testMarker}` },
        }),
        prisma.relatedSystem.create({
          data: { name: `Default System ${testMarker}` },
        }),
      ]);
    expect(defaultRequester.isActive).toBe(true);
    expect(defaultCategory.isActive).toBe(true);
    expect(defaultRelatedSystem.isActive).toBe(true);

    const activeDefaults = await prisma.$queryRaw<
      { tableName: string; columnDefault: string | null; isNullable: string }[]
    >`
      SELECT
        table_name AS "tableName",
        column_default AS "columnDefault",
        is_nullable AS "isNullable"
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND column_name = 'isActive'
        AND table_name IN ('RequesterUser', 'Category', 'RelatedSystem')
      ORDER BY table_name
    `;
    expect(activeDefaults).toEqual([
      { tableName: "Category", columnDefault: "true", isNullable: "NO" },
      { tableName: "RelatedSystem", columnDefault: "true", isNullable: "NO" },
      { tableName: "RequesterUser", columnDefault: "true", isNullable: "NO" },
    ]);

    const [category, relatedSystem] = await Promise.all([
      prisma.category.findUniqueOrThrow({ where: { id: categoryId } }),
      prisma.relatedSystem.findUniqueOrThrow({
        where: { id: relatedSystemId },
      }),
    ]);
    expect(category.createdAt).toBeInstanceOf(Date);
    expect(category.updatedAt).toBeInstanceOf(Date);
    expect(relatedSystem.createdAt).toBeInstanceOf(Date);
    expect(relatedSystem.updatedAt).toBeInstanceOf(Date);
  });

  it("enforces attachment name, storage, media type, and size boundaries", async () => {
    const ticket = await createTestTicket();

    await expect(
      createTestAttachment(ticket.id, { sizeBytes: 1 }),
    ).resolves.toMatchObject({ sizeBytes: 1 });
    await expect(
      createTestAttachment(ticket.id, { sizeBytes: 5_242_880 }),
    ).resolves.toMatchObject({ sizeBytes: 5_242_880 });

    await expectDatabaseFailure(
      () => createTestAttachment(ticket.id, { sizeBytes: 0 }),
      "Attachment_sizeBytes_check",
    );
    await expectDatabaseFailure(
      () => createTestAttachment(ticket.id, { sizeBytes: 5_242_881 }),
      "Attachment_sizeBytes_check",
    );
    await expectDatabaseFailure(
      () =>
        createTestAttachment(ticket.id, {
          originalName: " invalid.pdf ",
        }),
      "Attachment_originalName_check",
    );
    await expectDatabaseFailure(
      () => createTestAttachment(ticket.id, { storageKey: " " }),
      "Attachment_storageKey_check",
    );
    await expectDatabaseFailure(
      () =>
        createTestAttachment(ticket.id, {
          originalName: "mismatched.png",
          mimeType: "application/pdf",
        }),
      "Attachment_type_check",
    );
  });

  it("derives active state from removedAt and requires complete removal audit data", async () => {
    const ticket = await createTestTicket();
    const attachment = await createTestAttachment(ticket.id);
    const removedAt = new Date();
    const removalReason = "Uploaded a corrected replacement file.";

    const removed = await prisma.attachment.update({
      where: { id: attachment.id },
      data: { removedAt, removalReason, removedByRequesterId: requesterId },
    });
    expect(removed.removedAt).toEqual(removedAt);
    expect(removed.removalReason).toBe(removalReason);
    expect(removed.removedByRequesterId).toBe(requesterId);

    await expectDatabaseFailure(
      () =>
        createTestAttachment(ticket.id, {
          removedAt: new Date(),
          removalReason,
        }),
      "Attachment_removalState_check",
    );
    await expectDatabaseFailure(
      () =>
        createTestAttachment(ticket.id, {
          removalReason,
          removedByRequesterId: requesterId,
        }),
      "Attachment_removalState_check",
    );
  });

  it("enforces every ticket and attachment foreign key", async () => {
    const missingId = 2_147_483_647;

    await expect(
      prisma.ticket.create({
        data: validTicketData({ requesterId: missingId }),
      }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(
      prisma.ticket.create({
        data: validTicketData({ categoryId: missingId }),
      }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(
      prisma.ticket.create({
        data: validTicketData({ relatedSystemId: missingId }),
      }),
    ).rejects.toMatchObject({ code: "P2003" });

    const ticket = await createTestTicket();
    await expect(
      prisma.attachment.create({
        data: validAttachmentData(missingId),
      }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(
      prisma.attachment.create({
        data: validAttachmentData(ticket.id, {
          uploadedByRequesterId: missingId,
        }),
      }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(
      prisma.attachment.create({
        data: validAttachmentData(ticket.id, {
          removedAt: new Date(),
          removalReason: "Requester supplied an audit reason.",
          removedByRequesterId: missingId,
        }),
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("uses restrictive deletes and cascading key updates for all relations", async () => {
    const foreignKeys = await prisma.$queryRaw<
      { constraintName: string; deleteAction: string; updateAction: string }[]
    >`
      SELECT
        conname AS "constraintName",
        confdeltype::text AS "deleteAction",
        confupdtype::text AS "updateAction"
      FROM pg_constraint
      JOIN pg_class AS relation ON relation.oid = conrelid
      JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE contype = 'f'
        AND namespace.nspname = current_schema()
        AND relation.relname IN ('Ticket', 'Attachment')
    `;
    const foreignKeysByName = new Map(
      foreignKeys.map((foreignKey) => [foreignKey.constraintName, foreignKey]),
    );
    const expectedForeignKeyNames = [
      "Ticket_requesterId_fkey",
      "Ticket_categoryId_fkey",
      "Ticket_relatedSystemId_fkey",
      "Attachment_ticketId_fkey",
      "Attachment_uploadedByRequesterId_fkey",
      "Attachment_removedByRequesterId_fkey",
    ];

    expect([...foreignKeysByName.keys()].sort()).toEqual(
      expectedForeignKeyNames.sort(),
    );
    for (const foreignKeyName of expectedForeignKeyNames) {
      expect(foreignKeysByName.get(foreignKeyName)).toMatchObject({
        deleteAction: "r",
        updateAction: "c",
      });
    }
  });

  it("installs the required checks and exact unique/FK/query index signatures", async () => {
    const checks = await prisma.$queryRaw<{ constraintName: string }[]>`
      SELECT conname AS "constraintName"
      FROM pg_constraint
      JOIN pg_class AS relation ON relation.oid = conrelid
      JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE contype = 'c'
        AND namespace.nspname = current_schema()
        AND relation.relname IN (
          'RequesterUser',
          'Category',
          'RelatedSystem',
          'Ticket',
          'Attachment'
        )
    `;
    const checkNames = new Set(checks.map(({ constraintName }) => constraintName));
    const requiredChecks = [
      "RequesterUser_id_check",
      "RequesterUser_displayName_check",
      "RequesterUser_email_check",
      "Category_id_check",
      "Category_name_check",
      "RelatedSystem_id_check",
      "RelatedSystem_name_check",
      "RelatedSystem_description_check",
      "Ticket_id_check",
      "Ticket_ticketNumber_check",
      "Ticket_summary_check",
      "Ticket_description_check",
      "Ticket_status_check",
      "Attachment_id_check",
      "Attachment_originalName_check",
      "Attachment_storageKey_check",
      "Attachment_sizeBytes_check",
      "Attachment_type_check",
      "Attachment_removalState_check",
    ];

    for (const checkName of requiredChecks) {
      expect(checkNames.has(checkName), `Missing check ${checkName}`).toBe(true);
    }

    const indexes = await prisma.$queryRaw<
      { indexName: string; indexDefinition: string }[]
    >`
      SELECT indexname AS "indexName", indexdef AS "indexDefinition"
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename IN (
          'RequesterUser',
          'Category',
          'RelatedSystem',
          'Ticket',
          'Attachment'
        )
    `;
    const indexDefinitions = new Map(
      indexes.map(({ indexName, indexDefinition }) => [
        indexName,
        indexDefinition,
      ]),
    );
    const expectedIndexes: readonly [string, boolean, string][] = [
      ["RequesterUser_email_key", true, '("email")'],
      ["Category_name_key", true, '("name")'],
      ["RelatedSystem_name_key", true, '("name")'],
      ["Ticket_ticketNumber_key", true, '("ticketNumber")'],
      ["Ticket_clientRequestId_key", true, '("clientRequestId")'],
      ["Attachment_storageKey_key", true, '("storageKey")'],
      [
        "RequesterUser_isActive_displayName_idx",
        false,
        '("isActive", "displayName")',
      ],
      ["Category_isActive_name_idx", false, '("isActive", "name")'],
      ["RelatedSystem_isActive_name_idx", false, '("isActive", "name")'],
      ["Ticket_requesterId_idx", false, '("requesterId")'],
      ["Ticket_categoryId_idx", false, '("categoryId")'],
      ["Ticket_relatedSystemId_idx", false, '("relatedSystemId")'],
      [
        "Ticket_requesterId_createdAt_idx",
        false,
        '("requesterId", "createdAt" DESC)',
      ],
      [
        "Ticket_requesterId_status_createdAt_idx",
        false,
        '("requesterId", status, "createdAt" DESC)',
      ],
      [
        "Ticket_requesterId_requestedPriority_createdAt_idx",
        false,
        '("requesterId", "requestedPriority", "createdAt" DESC)',
      ],
      [
        "Ticket_requesterId_categoryId_createdAt_idx",
        false,
        '("requesterId", "categoryId", "createdAt" DESC)',
      ],
      [
        "Ticket_requesterId_relatedSystemId_createdAt_idx",
        false,
        '("requesterId", "relatedSystemId", "createdAt" DESC)',
      ],
      ["Attachment_ticketId_idx", false, '("ticketId")'],
      [
        "Attachment_uploadedByRequesterId_idx",
        false,
        '("uploadedByRequesterId")',
      ],
      [
        "Attachment_removedByRequesterId_idx",
        false,
        '("removedByRequesterId")',
      ],
      [
        "Attachment_ticketId_removedAt_createdAt_idx",
        false,
        '("ticketId", "removedAt", "createdAt")',
      ],
    ];

    for (const [indexName, unique, signature] of expectedIndexes) {
      const definition = indexDefinitions.get(indexName);
      expect(definition, `Missing index ${indexName}`).toBeDefined();
      expect(definition?.replaceAll('"', "")).toContain(
        signature.replaceAll('"', ""),
      );
      expect(definition?.startsWith("CREATE UNIQUE INDEX")).toBe(unique);
    }
  });
});
