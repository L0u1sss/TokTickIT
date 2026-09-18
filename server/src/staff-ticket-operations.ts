import { Priority, Prisma, Status, type PrismaClient } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { getPrisma } from "./prisma.js";
import { ApiError, toErrorResponse, validationError } from "./errors.js";
import { parsePositivePathId } from "./path-contract.js";
import { localAttachmentStorage } from "./attachment-storage.js";

const staffRoles = ["IT_STAFF", "ADMINISTRATOR"] as const;
const userSelect = { id: true, displayName: true, email: true, role: true } as const;
const transitions: Record<Status, readonly Status[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["REOPENED", "CLOSED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CLOSED: [],
  CANCELLED: [],
};

export function permittedStatusTransition(current: Status, next: Status) {
  return transitions[current].includes(next);
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

function parseContent(body: unknown, max: number) {
  const value = bodyObject(body).content;
  if (typeof value !== "string") throw validationError([{ field: "content", issue: "Must be text." }]);
  const content = value.trim();
  if (!content || Array.from(content).length > max) {
    throw validationError([{ field: "content", issue: `Must contain 1-${max} characters.` }]);
  }
  return content;
}

function notFound() {
  return new ApiError(404, "NOT_FOUND", "Ticket not found.");
}

async function requireTicket(prisma: PrismaClient, ticketId: number) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true, status: true, ownerId: true } });
  if (!ticket) throw notFound();
  return ticket;
}

async function requireEligibleOwner(prisma: PrismaClient, ownerId: number) {
  const owner = await prisma.user.findFirst({ where: { id: ownerId, isActive: true, role: { in: [...staffRoles] } }, select: userSelect });
  if (!owner) throw new ApiError(409, "INVALID_ASSIGNEE", "The selected owner is not an active IT Staff or Administrator.");
  return owner;
}

export async function claimTicket(prisma: PrismaClient, ticketId: number, actorId: number) {
  return prisma.$transaction(async (transaction) => {
    const ticket = await transaction.ticket.findUnique({ where: { id: ticketId }, select: { status: true, ownerId: true } });
    if (!ticket) throw notFound();
    if (ticket.status === "CLOSED" || ticket.status === "CANCELLED") throw new ApiError(409, "TICKET_NOT_ASSIGNABLE", "Closed or cancelled Tickets cannot be assigned.");
    if (ticket.ownerId !== null) throw new ApiError(409, "TICKET_ALREADY_ASSIGNED", "This Ticket already has an owner.");
    await requireEligibleOwner(transaction as unknown as PrismaClient, actorId);
    const updated = await transaction.ticket.update({ where: { id: ticketId }, data: { ownerId: actorId }, select: { owner: { select: userSelect }, updatedAt: true } });
    return { owner: updated.owner, updatedAt: updated.updatedAt.toISOString() };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function assignTicket(prisma: PrismaClient, ticketId: number, ownerId: number) {
  const owner = await requireEligibleOwner(prisma, ownerId);
  return prisma.$transaction(async (transaction) => {
    const ticket = await transaction.ticket.findUnique({ where: { id: ticketId }, select: { status: true } });
    if (!ticket) throw notFound();
    if (ticket.status === "CLOSED" || ticket.status === "CANCELLED") throw new ApiError(409, "TICKET_NOT_ASSIGNABLE", "Closed or cancelled Tickets cannot be assigned.");
    const updated = await transaction.ticket.update({ where: { id: ticketId }, data: { ownerId: owner.id }, select: { owner: { select: userSelect }, updatedAt: true } });
    return { owner: updated.owner, updatedAt: updated.updatedAt.toISOString() };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function updateTicketPriority(prisma: PrismaClient, ticketId: number, itPriority: Priority) {
  const updated = await prisma.ticket.update({ where: { id: ticketId }, data: { itPriority }, select: { itPriority: true, updatedAt: true } }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") throw notFound();
    throw error;
  });
  return { itPriority: updated.itPriority, updatedAt: updated.updatedAt.toISOString() };
}

export async function updateTicketStatus(prisma: PrismaClient, ticketId: number, nextStatus: Status) {
  return prisma.$transaction(async (transaction) => {
    const ticket = await transaction.ticket.findUnique({ where: { id: ticketId }, select: { status: true, ownerId: true } });
    if (!ticket) throw notFound();
    if (!permittedStatusTransition(ticket.status, nextStatus)) throw new ApiError(409, "INVALID_STATUS_TRANSITION", `Cannot change status from ${ticket.status} to ${nextStatus}.`);
    const terminal = nextStatus === "CLOSED" || nextStatus === "CANCELLED";
    const updated = await transaction.ticket.update({ where: { id: ticketId }, data: { status: nextStatus, ...(terminal && ticket.ownerId !== null ? { lastOwnerId: ticket.ownerId, ownerId: null } : {}) }, select: { status: true, updatedAt: true } });
    return { status: updated.status, updatedAt: updated.updatedAt.toISOString() };
  });
}

const ticketDetailInclude = {
  requester: { select: userSelect }, category: { select: { id: true, name: true } }, relatedSystem: { select: { id: true, name: true } },
  owner: { select: userSelect }, lastOwner: { select: userSelect },
  attachments: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true, removedAt: true, removalReason: true } },
  publicComments: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { author: { select: userSelect } } },
} satisfies Prisma.TicketInclude;

export async function getStaffTicketDetail(prisma: PrismaClient, ticketId: number) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: ticketDetailInclude });
  if (!ticket) throw notFound();
  return {
    ...ticket,
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

async function addCommunication(prisma: PrismaClient, ticketId: number, authorId: number, content: string, note: boolean) {
  await requireTicket(prisma, ticketId);
  const data = { ticketId, authorId, content };
  const record = note ? await prisma.internalNote.create({ data }) : await prisma.publicComment.create({ data });
  const author = await prisma.user.findUniqueOrThrow({ where: { id: authorId }, select: userSelect });
  return { id: record.id, content: record.content, createdAt: record.createdAt.toISOString(), author };
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
staffTicketOperationsRouter.post("/tickets/:id/claim", route(async (req, res) => res.json(await claimTicket(getPrisma(), parsePositivePathId(req.params.id, "id"), res.locals.authenticatedUser.id))));
staffTicketOperationsRouter.patch("/tickets/:id/owner", route(async (req, res) => {
  const body = bodyObject(req.body); const value = body.ownerId;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw validationError([{ field: "ownerId", issue: "Must be a positive integer." }]);
  res.json(await assignTicket(getPrisma(), parsePositivePathId(req.params.id, "id"), value));
}));
staffTicketOperationsRouter.patch("/tickets/:id/it-priority", route(async (req, res) => res.json(await updateTicketPriority(getPrisma(), parsePositivePathId(req.params.id, "id"), parseEnum(bodyObject(req.body), "itPriority", Object.values(Priority))))));
staffTicketOperationsRouter.patch("/tickets/:id/status", route(async (req, res) => res.json(await updateTicketStatus(getPrisma(), parsePositivePathId(req.params.id, "id"), parseEnum(bodyObject(req.body), "status", Object.values(Status))))));
staffTicketOperationsRouter.get("/tickets/:id/comments", route(async (req, res) => { const ticket = await getStaffTicketDetail(getPrisma(), parsePositivePathId(req.params.id, "id")); res.json({ items: ticket.publicComments }); }));
staffTicketOperationsRouter.post("/tickets/:id/comments", route(async (req, res) => res.status(201).json(await addCommunication(getPrisma(), parsePositivePathId(req.params.id, "id"), res.locals.authenticatedUser.id, parseContent(req.body, 2000), false))));
staffTicketOperationsRouter.get("/tickets/:id/internal-notes", route(async (req, res) => { const ticketId = parsePositivePathId(req.params.id, "id"); await requireTicket(getPrisma(), ticketId); const items = await getPrisma().internalNote.findMany({ where: { ticketId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { author: { select: userSelect } } }); res.json({ items: items.map(item => ({ ...item, createdAt: item.createdAt.toISOString() })) }); }));
staffTicketOperationsRouter.post("/tickets/:id/internal-notes", route(async (req, res) => res.status(201).json(await addCommunication(getPrisma(), parsePositivePathId(req.params.id, "id"), res.locals.authenticatedUser.id, parseContent(req.body, 4000), true))));