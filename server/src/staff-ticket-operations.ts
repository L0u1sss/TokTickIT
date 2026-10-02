import { Priority, Prisma, Status, type PrismaClient } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { parseContent, listComments, authorSelect, communicationSelect } from "./communications.js";
import { getPrisma } from "./prisma.js";
import { ApiError, toErrorResponse, validationError } from "./errors.js";
import { parsePositivePathId } from "./path-contract.js";
import { localAttachmentStorage } from "./attachment-storage.js";
import { lockUserManagement } from "./user-management.js";

const staffRoles = ["IT_STAFF", "ADMINISTRATOR"] as const;
const userSelect = { id: true, displayName: true, email: true, role: true } as const;
const transitions: Record<Status, readonly Status[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["REOPENED", "CLOSED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CLOSED: ["REOPENED"],
  CANCELLED: ["REOPENED"],
};

export function permittedStatusTransition(current: Status, next: Status) {
  return transitions[current].includes(next);
}

export function permittedNextStatuses(current: Status): readonly Status[] {
  return transitions[current];
}

function bodyObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw validationError([{ field: "body", issue: "Must be an object." }]);
  }
  return body as Record<string, unknown>;
}

function parseEnum<T extends string>(body: Record<string, unknown>, field: string, values: readonly T[]): T {
  const value = body[field];
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw validationError([{ field, issue: `Must be one of ${values.join(", ")}.` }]);
  }
  return value as T;
}


function notFound() {
  return new ApiError(404, "NOT_FOUND", "Ticket not found.");
}

async function requireTicket(prisma: PrismaClient, ticketId: number) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true, status: true, ownerId: true, version: true } });
  if (!ticket) throw notFound();
  return ticket;
}

function expectedVersion(body: Record<string, unknown>) {
  const value = body.expectedTicketVersion;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw validationError([{ field: "expectedTicketVersion", issue: "Must be a positive integer." }]);
  return value;
}
async function lockTicket(tx: Prisma.TransactionClient, ticketId: number) {
  await tx.$queryRaw`SELECT "id" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE`;
  const ticket = await tx.ticket.findUnique({ where: { id: ticketId }, select: { id: true, status: true, ownerId: true, version: true, workflowCycle: true } });
  if (!ticket) throw notFound();
  return ticket;
}
async function writeTicket(tx: Prisma.TransactionClient, ticketId: number, expected: number, data: Record<string, unknown>, now: Date) {
  const result = await tx.ticket.updateMany({ where: { id: ticketId, version: expected }, data: { ...data, version: { increment: 1 }, updatedAt: now } as Prisma.TicketUpdateManyMutationInput });
  if (result.count !== 1) throw new ApiError(409, "STALE_TICKET", "This Ticket changed. Reload it before saving.");
  return expected + 1;
}

async function requireEligibleOwner(prisma: PrismaClient, ownerId: number) {
  const owner = await prisma.user.findFirst({ where: { id: ownerId, isActive: true, role: { in: [...staffRoles] } }, select: userSelect });
  if (!owner) throw new ApiError(409, "INVALID_ASSIGNEE", "The selected owner is not an active IT Staff or Administrator.");
  return owner;
}

export async function claimTicket(prisma: PrismaClient, ticketId: number, actorId: number, expected: number) {
  return prisma.$transaction(async (transaction) => {
    const now = new Date();
    const ticket = await lockTicket(transaction, ticketId);
    if (ticket.version !== expected) throw new ApiError(409, "STALE_TICKET", "This Ticket changed. Reload it before saving.");
    await lockUserManagement(transaction);
    if (ticket.status === "CLOSED" || ticket.status === "CANCELLED") throw new ApiError(409, "TICKET_NOT_ASSIGNABLE", "Closed or cancelled Tickets cannot be assigned.");
    if (ticket.ownerId !== null) throw new ApiError(409, "TICKET_ALREADY_ASSIGNED", "This Ticket already has an owner.");
    await requireEligibleOwner(transaction as unknown as PrismaClient, actorId);
    await writeTicket(transaction, ticketId, expected, { ownerId: actorId }, now);
    const updated = await transaction.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { owner: { select: userSelect }, updatedAt: true } });
    return { owner: updated.owner, version: expected + 1, updatedAt: updated.updatedAt.toISOString() };
  });
}

export async function assignTicket(prisma: PrismaClient, ticketId: number, ownerId: number, expected: number) {
  return prisma.$transaction(async (transaction) => {
    const now = new Date(); const ticket = await lockTicket(transaction, ticketId);
    if (ticket.version !== expected) throw new ApiError(409, "STALE_TICKET", "This Ticket changed. Reload it before saving.");
    await lockUserManagement(transaction);
    const owner = await requireEligibleOwner(transaction as unknown as PrismaClient, ownerId);
    if (ticket.status === "CLOSED" || ticket.status === "CANCELLED") throw new ApiError(409, "TICKET_NOT_ASSIGNABLE", "Closed or cancelled Tickets cannot be assigned.");
    await writeTicket(transaction, ticketId, expected, { ownerId: owner.id }, now);
    const updated = await transaction.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { owner: { select: userSelect }, updatedAt: true } });
    return { owner: updated.owner, version: expected + 1, updatedAt: updated.updatedAt.toISOString() };
  });
}

export async function updateTicketPriority(prisma: PrismaClient, ticketId: number, itPriority: Priority, expected: number) {
  return prisma.$transaction(async tx => {
    const now = new Date(); const ticket = await lockTicket(tx, ticketId);
    if (ticket.version !== expected) throw new ApiError(409, "STALE_TICKET", "This Ticket changed. Reload it before saving.");
    await writeTicket(tx, ticketId, expected, { itPriority }, now);
    const updated = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { itPriority: true, updatedAt: true } });
    return { itPriority: updated.itPriority, version: expected + 1, updatedAt: updated.updatedAt.toISOString() };
  });
}

export async function updateTicketStatus(prisma: PrismaClient, ticketId: number, nextStatus: Status, expected: number, actorId: number) {
  return prisma.$transaction(async (transaction) => {
    const now = new Date(); const ticket = await lockTicket(transaction, ticketId);
    if (ticket.version !== expected) throw new ApiError(409, "STALE_TICKET", "This Ticket changed. Reload it before saving.");
    if (!permittedStatusTransition(ticket.status, nextStatus)) throw new ApiError(409, "INVALID_STATUS_TRANSITION", `Cannot change status from ${ticket.status} to ${nextStatus}.`);
    if (nextStatus === "CLOSED" && ticket.status !== "RESOLVED") throw new ApiError(409, "INVALID_STATUS_TRANSITION", "Only resolved Tickets can be closed.");
    const terminal = nextStatus === "CLOSED" || nextStatus === "CANCELLED";
    if (nextStatus === "CANCELLED") {
      const actions = await transaction.actionTaken.findMany({
        where: { ticketId, workflowCycle: ticket.workflowCycle, status: { in: ["PLANNED", "IN_PROGRESS"] } },
        select: { id: true, status: true, revision: true }, orderBy: { id: "asc" },
      });
      for (const action of actions) {
        const changed = await transaction.actionTaken.updateMany({ where: { id: action.id, revision: action.revision }, data: {
          status: "CANCELLED", cancelledAt: now, cancelledById: actorId,
          cancellationSource: "TICKET_CASCADE", updatedAt: now, revision: { increment: 1 },
        } });
        if (changed.count !== 1) throw new ApiError(409, "STALE_ACTION", "An Action changed while cancelling the Ticket.");
        await transaction.actionEvent.create({ data: {
          actionId: action.id, actorId,
          eventType: "TICKET_CASCADE_CANCELLED", fromStatus: action.status, toStatus: "CANCELLED", revision: action.revision + 1,
          changedFields: { fields: ["status", "cancelledAt", "cancelledById", "cancellationSource"] }, createdAt: now,
        } });
      }
    }
    await writeTicket(transaction, ticketId, expected, { status: nextStatus, ...(nextStatus === "REOPENED" ? { workflowCycle: { increment: 1 }, resolvedAt: null, problemAppearsResolvedAt: null, problemAppearsResolvedById: null } : {}), ...(nextStatus === "RESOLVED" ? { resolvedAt: now } : {}), ...(terminal && ticket.ownerId !== null ? { lastOwnerId: ticket.ownerId, ownerId: null } : {}) }, now);
    const updated = await transaction.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { status: true, updatedAt: true } });
    return { status: updated.status, version: expected + 1, updatedAt: updated.updatedAt.toISOString() };
  });
}

const ticketDetailInclude = {
  requester: { select: userSelect }, category: { select: { id: true, name: true } }, relatedSystem: { select: { id: true, name: true } },
  owner: { select: userSelect }, lastOwner: { select: userSelect },
  attachments: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true, removedAt: true, removalReason: true } },
  publicComments: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: communicationSelect },
  problemAppearsResolvedBy: { select: authorSelect },
} satisfies Prisma.TicketInclude;

export async function getStaffTicketDetail(prisma: PrismaClient, ticketId: number) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: ticketDetailInclude });
  if (!ticket) throw notFound();
  return {
    ...ticket,
    version: ticket.version,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    attachments: ticket.attachments.map(attachment => ({
      id: attachment.id,
      fileName: attachment.originalName,
      mediaType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      uploadedAt: attachment.createdAt.toISOString(),
      isRemoved: attachment.removedAt !== null,
      removedAt: attachment.removedAt?.toISOString() ?? null,
      removalReason: attachment.removalReason,
      downloadable: attachment.removedAt === null,
    })),
    publicComments: ticket.publicComments.map(comment => ({ ...comment, createdAt: comment.createdAt.toISOString() })),

  };
}

async function addCommunication(prisma: PrismaClient, ticketId: number, authorId: number, body: unknown, note: boolean) {
  await requireTicket(prisma, ticketId);
  const data = { ticketId, authorId, content: parseContent(body) };
  return note
    ? prisma.internalNote.create({ data, select: communicationSelect })
    : prisma.publicComment.create({ data, select: communicationSelect });
}

export const staffTicketOperationsRouter = Router();
const route = (handler: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response) => void handler(req, res).catch((error: unknown) => { const result = toErrorResponse(error); res.status(result.status).json(result.body); });

staffTicketOperationsRouter.get("/tickets/:id", route(async (req, res) => res.json(await getStaffTicketDetail(getPrisma(), parsePositivePathId(req.params.id, "id")))));
staffTicketOperationsRouter.get("/tickets/:id/attachments/:attId/download", route(async (req, res) => {
  const ticketId = parsePositivePathId(req.params.id, "id");
  const attachmentId = parsePositivePathId(req.params.attId, "attId");
  const attachment = await getPrisma().attachment.findFirst({ where: { id: attachmentId, ticketId }, select: { originalName: true, mimeType: true, sizeBytes: true, storageKey: true, removedAt: true } });
  if (!attachment || attachment.removedAt) throw new ApiError(404, "NOT_FOUND", "Attachment not found.");
  const bytes = await localAttachmentStorage.read(attachment.storageKey);
    const safeFileName = attachment.originalName.replace(/["\\\r\n]/g, "_");
    res.set({ "Content-Type": attachment.mimeType, "Content-Length": String(attachment.sizeBytes), "Content-Disposition": `attachment; filename="${safeFileName}"`, "X-Content-Type-Options": "nosniff" });
  res.send(bytes);
}));
staffTicketOperationsRouter.post("/tickets/:id/claim", route(async (req, res) => { const body = bodyObject(req.body); res.json(await claimTicket(getPrisma(), parsePositivePathId(req.params.id, "id"), res.locals.authenticatedUser.id, expectedVersion(body))); }));
staffTicketOperationsRouter.patch("/tickets/:id/owner", route(async (req, res) => {
  const body = bodyObject(req.body); const value = body.ownerId; const version = expectedVersion(body);
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw validationError([{ field: "ownerId", issue: "Must be a positive integer." }]);
  res.json(await assignTicket(getPrisma(), parsePositivePathId(req.params.id, "id"), value, version));
}));
staffTicketOperationsRouter.patch("/tickets/:id/it-priority", route(async (req, res) => { const body = bodyObject(req.body); res.json(await updateTicketPriority(getPrisma(), parsePositivePathId(req.params.id, "id"), parseEnum(body, "itPriority", Object.values(Priority)), expectedVersion(body))); }));
staffTicketOperationsRouter.patch("/tickets/:id/status", route(async (req, res) => { const body = bodyObject(req.body); res.json(await updateTicketStatus(getPrisma(), parsePositivePathId(req.params.id, "id"), parseEnum(body, "status", Object.values(Status)), expectedVersion(body), res.locals.authenticatedUser.id)); }));
staffTicketOperationsRouter.get("/tickets/:id/comments", route(async (req, res) => { const id = parsePositivePathId(req.params.id, "id"); await requireTicket(getPrisma(), id); res.json({ items: await listComments(getPrisma(), id) }); }));
staffTicketOperationsRouter.post("/tickets/:id/comments", route(async (req, res) => res.status(201).json(await addCommunication(getPrisma(), parsePositivePathId(req.params.id, "id"), res.locals.authenticatedUser.id, req.body, false))));
staffTicketOperationsRouter.get("/tickets/:id/internal-notes", route(async (req, res) => { const ticketId = parsePositivePathId(req.params.id, "id"); await requireTicket(getPrisma(), ticketId); const items = await getPrisma().internalNote.findMany({ where: { ticketId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: communicationSelect }); res.json({ items: items.map(item => ({ ...item, createdAt: item.createdAt.toISOString() })) }); }));
staffTicketOperationsRouter.post("/tickets/:id/internal-notes", route(async (req, res) => res.status(201).json(await addCommunication(getPrisma(), parsePositivePathId(req.params.id, "id"), res.locals.authenticatedUser.id, req.body, true))));
