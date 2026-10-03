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

const lab4Tickets = [
  { ticketNumber: "TKT-L4-000001", clientRequestId: "40000000-0000-4000-8000-000000000001", summary: "Cannot access campus Wi-Fi", description: "Authentication succeeds but the device cannot obtain network access.", requestedPriority: "HIGH", itPriority: "HIGH", status: "NEW", workflowCycle: 1, resolvedAt: null, requesterEmail: "jennifer.a@example.com", category: "Network", system: "Campus Wi-Fi", ownerEmail: null },
  { ticketNumber: "TKT-L4-000002", clientRequestId: "40000000-0000-4000-8000-000000000002", summary: "VPN disconnects during upload", description: "VPN disconnects while uploading a large course archive.", requestedPriority: "MEDIUM", itPriority: "HIGH", status: "OPEN", workflowCycle: 1, resolvedAt: null, requesterEmail: "michael.b@example.com", category: "Network", system: "VPN", ownerEmail: "staff.one@example.com" },
  { ticketNumber: "TKT-L4-000003", clientRequestId: "40000000-0000-4000-8000-000000000003", summary: "Laptop camera unavailable", description: "The operating system no longer detects the built-in camera.", requestedPriority: "MEDIUM", itPriority: "MEDIUM", status: "IN_PROGRESS", workflowCycle: 1, resolvedAt: null, requesterEmail: "sarah.j@example.com", category: "Hardware", system: "Corporate Laptop", ownerEmail: "staff.two@example.com" },
  { ticketNumber: "TKT-L4-000004", clientRequestId: "40000000-0000-4000-8000-000000000004", summary: "Need screenshot of email error", description: "Support needs more information from the requester.", requestedPriority: "LOW", itPriority: "LOW", status: "WAITING_FOR_REQUESTER", workflowCycle: 1, resolvedAt: null, requesterEmail: "david.l@example.com", category: "Software", system: "Email", ownerEmail: "staff.three@example.com" },
  { ticketNumber: "TKT-L4-000005", clientRequestId: "40000000-0000-4000-8000-000000000005", summary: "Grade submission restored", description: "Submission access was restored after permission repair.", requestedPriority: "HIGH", itPriority: "HIGH", status: "RESOLVED", workflowCycle: 1, resolvedAt: new Date("2026-09-23T08:00:00.000Z"), requesterEmail: "jennifer.a@example.com", category: "Account and Access", system: "Grade Submission App", ownerEmail: "staff.one@example.com" },
  { ticketNumber: "TKT-L4-000006", clientRequestId: "40000000-0000-4000-8000-000000000006", summary: "Email profile repaired", description: "The damaged local email profile was recreated and verified.", requestedPriority: "LOW", itPriority: "LOW", status: "CLOSED", workflowCycle: 1, resolvedAt: new Date("2026-09-22T08:00:00.000Z"), requesterEmail: "michael.b@example.com", category: "Software", system: "Email", ownerEmail: null },
  { ticketNumber: "TKT-L4-000007", clientRequestId: "40000000-0000-4000-8000-000000000007", summary: "VPN issue returned", description: "The requester reports the earlier VPN issue has returned.", requestedPriority: "HIGH", itPriority: "HIGH", status: "REOPENED", workflowCycle: 2, resolvedAt: null, requesterEmail: "sarah.j@example.com", category: "Network", system: "VPN", ownerEmail: "staff.two@example.com" },
  { ticketNumber: "TKT-L4-000008", clientRequestId: "40000000-0000-4000-8000-000000000008", summary: "Duplicate access request", description: "The requester confirmed this duplicates another active Ticket.", requestedPriority: "LOW", itPriority: "LOW", status: "CANCELLED", workflowCycle: 1, resolvedAt: null, requesterEmail: "david.l@example.com", category: "Account and Access", system: "LEB2 App", ownerEmail: null },
] as const;

const lab4Actions = [
  { ticketNumber: "TKT-L4-000002", clientRequestId: "50000000-0000-4000-8000-000000000001", description: "Review VPN gateway logs.", result: null, status: "PLANNED", workflowCycle: 1, recordedByEmail: "staff.one@example.com", performerEmail: null, assigneeEmail: "staff.two@example.com", followUpRequired: true, followUpNote: "Compare the next disconnect timestamp with gateway logs.", attachmentNotes: "See vpn-client-log.txt on the Ticket.", createdAt: new Date("2026-09-24T07:00:00.000Z"), inProgressAt: null, completedAt: null, cancelledAt: null, cancelledByEmail: null, cancellationSource: null },
  { ticketNumber: "TKT-L4-000003", clientRequestId: "50000000-0000-4000-8000-000000000002", description: "Reinstall the approved camera driver.", result: null, status: "IN_PROGRESS", workflowCycle: 1, recordedByEmail: "staff.one@example.com", performerEmail: null, assigneeEmail: "staff.two@example.com", followUpRequired: false, followUpNote: null, attachmentNotes: null, createdAt: new Date("2026-09-24T07:00:00.000Z"), inProgressAt: new Date("2026-09-24T08:00:00.000Z"), completedAt: null, cancelledAt: null, cancelledByEmail: null, cancellationSource: null },
  { ticketNumber: "TKT-L4-000003", clientRequestId: "50000000-0000-4000-8000-000000000003", description: "Run hardware diagnostics after driver installation.", result: "Camera passed the vendor diagnostic and video preview test.", status: "COMPLETED", workflowCycle: 1, recordedByEmail: "staff.one@example.com", performerEmail: "staff.two@example.com", assigneeEmail: "staff.two@example.com", followUpRequired: false, followUpNote: null, attachmentNotes: "Diagnostic summary is attached to the Ticket.", createdAt: new Date("2026-09-22T07:00:00.000Z"), inProgressAt: new Date("2026-09-23T08:00:00.000Z"), completedAt: new Date("2026-09-24T09:00:00.000Z"), cancelledAt: null, cancelledByEmail: null, cancellationSource: null },
  { ticketNumber: "TKT-L4-000005", clientRequestId: "50000000-0000-4000-8000-000000000004", description: "Repair the grade-submission permission mapping.", result: "Requester verified that submission access works.", status: "COMPLETED", workflowCycle: 1, recordedByEmail: "staff.three@example.com", performerEmail: "staff.one@example.com", assigneeEmail: "staff.one@example.com", followUpRequired: false, followUpNote: null, attachmentNotes: null, createdAt: new Date("2026-09-21T08:00:00.000Z"), inProgressAt: new Date("2026-09-22T08:00:00.000Z"), completedAt: new Date("2026-09-23T08:00:00.000Z"), cancelledAt: null, cancelledByEmail: null, cancellationSource: null },
  { ticketNumber: "TKT-L4-000007", clientRequestId: "50000000-0000-4000-8000-000000000005", description: "Replace the saved VPN profile.", result: null, status: "CANCELLED", workflowCycle: 1, recordedByEmail: "staff.two@example.com", performerEmail: null, assigneeEmail: "staff.two@example.com", followUpRequired: false, followUpNote: null, attachmentNotes: null, createdAt: new Date("2026-09-24T07:00:00.000Z"), inProgressAt: null, completedAt: null, cancelledAt: new Date("2026-09-24T10:00:00.000Z"), cancelledByEmail: "staff.two@example.com", cancellationSource: "STAFF_ACTION" },
  { ticketNumber: "TKT-L4-000008", clientRequestId: "50000000-0000-4000-8000-000000000006", description: "Collect the duplicate request evidence for the incident record.", result: null, status: "CANCELLED", workflowCycle: 1, recordedByEmail: "staff.one@example.com", performerEmail: null, assigneeEmail: "staff.three@example.com", followUpRequired: true, followUpNote: "Retain the requester confirmation with the cancelled request.", attachmentNotes: null, createdAt: new Date("2026-09-24T07:00:00.000Z"), inProgressAt: new Date("2026-09-24T08:00:00.000Z"), completedAt: null, cancelledAt: new Date("2026-09-24T11:00:00.000Z"), cancelledByEmail: "staff.two@example.com", cancellationSource: "TICKET_CASCADE" },
] as const;

type SeedActionEvent = {
  actorId: number;
  eventType: "ACTION_CREATED" | "ACTION_UPDATED" | "ACTION_COMPLETED" | "ACTION_CANCELLED" | "TICKET_CASCADE_CANCELLED";
  fromStatus: "PLANNED" | "IN_PROGRESS" | null;
  toStatus: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  changedFields: { fields: string[] };
  createdAt: Date;
};

function lab4TicketNumber(draftNumber: string) {
  return `TKT-2026-9${draftNumber.slice(-5)}`;
}

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

  // Live requester regressions supply their own Ticket fixtures. Keep demo
  // history intact by skipping its creation rather than deleting audit events.
  if (process.env.SEED_REFERENCE_DATA_ONLY === "true") {
    console.log(`Seeded reference data and accounts; demo Tickets and Actions were skipped.`);
    return;
  }

  const [lab4Schema] = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = 'ActionTaken'
    ) AS "exists"
  `;
  if (!lab4Schema?.exists) {
    console.log(
      `Seeded ${categories.length} categories, ${relatedSystems.length} related systems, ${requesters.length} Requesters and ${staffAccounts.length} staff/admin accounts. Lab 4 schema is not present; Ticket and Action fixtures were skipped.`,
    );
    return;
  }

  const [seededUsers, seededCategories, seededSystems] = await Promise.all([
    prisma.user.findMany({ where: { email: { in: [...requesters, ...staffAccounts].map(user => user.email) } }, select: { id: true, email: true } }),
    prisma.category.findMany({ where: { name: { in: [...categories] } }, select: { id: true, name: true } }),
    prisma.relatedSystem.findMany({ where: { name: { in: [...relatedSystems] } }, select: { id: true, name: true } }),
  ]);
  const userId = new Map(seededUsers.map(user => [user.email, user.id]));
  const categoryId = new Map(seededCategories.map(category => [category.name, category.id]));
  const systemId = new Map(seededSystems.map(system => [system.name, system.id]));

  for (const ticket of lab4Tickets) {
    const ticketNumber = lab4TicketNumber(ticket.ticketNumber);
    const requesterId = userId.get(ticket.requesterEmail);
    const selectedCategoryId = categoryId.get(ticket.category);
    const relatedSystemId = systemId.get(ticket.system);
    const ownerId = ticket.ownerEmail ? userId.get(ticket.ownerEmail) : null;
    if (!requesterId || !selectedCategoryId || !relatedSystemId || (ticket.ownerEmail && !ownerId)) throw new Error(`Missing Lab 4 seed reference for ${ticketNumber}.`);
    await prisma.ticket.upsert({
      where: { ticketNumber },
      update: {},
      create: {
        ticketNumber,
        clientRequestId: ticket.clientRequestId,
        summary: ticket.summary,
        description: ticket.description,
        requestedPriority: ticket.requestedPriority,
        itPriority: ticket.itPriority,
        status: ticket.status,
        workflowCycle: ticket.workflowCycle,
        resolvedAt: ticket.resolvedAt,
        requesterId,
        categoryId: selectedCategoryId,
        relatedSystemId,
        ownerId,
      },
    });
  }

  const seededTickets = await prisma.ticket.findMany({ where: { ticketNumber: { in: lab4Tickets.map(ticket => lab4TicketNumber(ticket.ticketNumber)) } }, select: { id: true, ticketNumber: true } });
  const ticketId = new Map(seededTickets.map(ticket => [ticket.ticketNumber, ticket.id]));
  for (const action of lab4Actions) {
    const selectedTicketId = ticketId.get(lab4TicketNumber(action.ticketNumber));
    const recordedById = userId.get(action.recordedByEmail);
    const performedById = action.performerEmail ? userId.get(action.performerEmail) : null;
    const assigneeId = userId.get(action.assigneeEmail);
    const cancelledById = action.cancelledByEmail ? userId.get(action.cancelledByEmail) : null;
    if (!selectedTicketId || !recordedById || !assigneeId || (action.performerEmail && !performedById) || (action.status === "COMPLETED" && !performedById) || (action.cancelledByEmail && !cancelledById) || (action.status === "CANCELLED" && !cancelledById)) throw new Error(`Missing Lab 4 Action seed reference for ${action.clientRequestId}.`);
    const events: SeedActionEvent[] = [
      {
        actorId: recordedById,
        eventType: "ACTION_CREATED" as const,
        fromStatus: null,
        toStatus: "PLANNED" as const,
        changedFields: { fields: ["description", "assigneeId", "followUpRequired", "followUpNote", "attachmentNotes"] },
        createdAt: action.createdAt,
      },
    ];
    if (action.inProgressAt) events.push({ actorId: assigneeId, eventType: "ACTION_UPDATED", fromStatus: "PLANNED", toStatus: "IN_PROGRESS", changedFields: { fields: ["status"] }, createdAt: action.inProgressAt });
    if (action.status === "COMPLETED") {
      if (!performedById || !action.inProgressAt || !action.completedAt) throw new Error(`Missing completion provenance for ${action.clientRequestId}.`);
      events.push({ actorId: performedById, eventType: "ACTION_COMPLETED", fromStatus: "IN_PROGRESS", toStatus: "COMPLETED", changedFields: { fields: ["result", "status", "performedById", "completedAt"] }, createdAt: action.completedAt });
    }
    if (action.status === "CANCELLED") {
      if (!cancelledById || !action.cancelledAt) throw new Error(`Missing cancellation provenance for ${action.clientRequestId}.`);
      const fromStatus = action.inProgressAt ? "IN_PROGRESS" : "PLANNED";
      const eventType = action.cancellationSource === "TICKET_CASCADE" ? "TICKET_CASCADE_CANCELLED" : "ACTION_CANCELLED";
      events.push({ actorId: cancelledById, eventType, fromStatus, toStatus: "CANCELLED", changedFields: { fields: ["status", "cancelledAt", "cancelledById", "cancellationSource"] }, createdAt: action.cancelledAt });
    }
    const seededAction = await prisma.actionTaken.upsert({
      where: { ticketId_clientRequestId: { ticketId: selectedTicketId, clientRequestId: action.clientRequestId } },
      update: {},
      create: {
        ticketId: selectedTicketId,
        workflowCycle: action.workflowCycle,
        clientRequestId: action.clientRequestId,
        createFingerprint: "0".repeat(64),
        description: action.description,
        result: action.result,
        status: action.status,
        recordedById,
        performedById,
        assigneeId,
        followUpRequired: action.followUpRequired,
        followUpNote: action.followUpNote,
        attachmentNotes: action.attachmentNotes,
        createdAt: action.createdAt,
        updatedAt: action.cancelledAt ?? action.completedAt ?? action.inProgressAt ?? action.createdAt,
        completedAt: action.completedAt,
        cancelledAt: action.cancelledAt,
        cancelledById,
        cancellationSource: action.cancellationSource,
        revision: events.length,
      },
    });
    for (const [index, event] of events.entries()) {
      const revision = index + 1;
      await prisma.actionEvent.upsert({
        where: { actionId_revision: { actionId: seededAction.id, revision } },
        update: {},
        create: { actionId: seededAction.id, ...event, revision },
      });
    }
  }

  console.log(
    `Seeded ${categories.length} categories, ${relatedSystems.length} related systems, ${requesters.length} Requesters, ${staffAccounts.length} staff/admin accounts, ${lab4Tickets.length} Lab 4 Tickets and ${lab4Actions.length} Actions. Existing records and credentials are preserved.`,
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
