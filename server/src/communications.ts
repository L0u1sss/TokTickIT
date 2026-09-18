import { Router } from "express";
import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { ApiError, toErrorResponse, validationError } from "./errors.js";
import { parsePositivePathId } from "./path-contract.js";
import { requireOwnedTicket } from "./attachment-service.js";

export const authorSelect = { id: true, displayName: true, role: true } as const;
export function parseContent(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => key !== "content")) {
    throw validationError([{ field: "body", issue: "Only content is accepted." }]);
  }
  const value = (body as { content?: unknown }).content;
  if (typeof value !== "string" || !value.trim() || Array.from(value.trim()).length > 2000 || value.includes("\u0000")) {
    throw validationError([{ field: "content", issue: "Enter 1–2,000 characters of plain text." }]);
  }
  return value.trim();
}
export async function listComments(prisma: PrismaClient, ticketId: number) {
  return prisma.publicComment.findMany({ where: { ticketId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, content: true, createdAt: true, author: { select: authorSelect } } });
}
export const requesterCommunicationsRouter = Router();
requesterCommunicationsRouter.route("/:id/comments").get(async (req, res, next) => {
  try {
    const id = parsePositivePathId(req.params.id, "id");
    await requireOwnedTicket(getPrisma(), res.locals.authenticatedUser, id);
    res.json({ items: await listComments(getPrisma(), id) });
  } catch (error) { next(error); }
}).post(async (req, res, next) => {
  try {
    const id = parsePositivePathId(req.params.id, "id");
    await requireOwnedTicket(getPrisma(), res.locals.authenticatedUser, id);
    const content = parseContent(req.body);
    res.status(201).json(await getPrisma().publicComment.create({ data: { ticketId: id, authorId: res.locals.authenticatedUser.id, content }, select: { id: true, content: true, createdAt: true, author: { select: authorSelect } } }));
  } catch (error) { next(error); }
});
requesterCommunicationsRouter.post("/:id/problem-appears-resolved", async (req, res) => {
  try {
    const id = parsePositivePathId(req.params.id, "id");
    if (req.body != null && (typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).length)) throw validationError([{ field: "body", issue: "No fields are accepted." }]);
    const result = await getPrisma().$transaction(async tx => {
      const ticket = await tx.ticket.findFirst({ where: { id, requesterId: res.locals.authenticatedUser.id } });
      if (!ticket) throw new ApiError(404, "NOT_FOUND", "Ticket not found.");
      if (["RESOLVED", "CLOSED", "CANCELLED"].includes(ticket.status)) throw new ApiError(409, "RESOLUTION_INDICATION_NOT_ALLOWED", "This Ticket cannot receive a resolution indication in its current status.");
      const select = { problemAppearsResolvedAt: true, problemAppearsResolvedBy: { select: authorSelect } } as const;
      if (ticket.problemAppearsResolvedAt) return tx.ticket.findUniqueOrThrow({ where: { id }, select });
      return tx.ticket.update({ where: { id }, data: { problemAppearsResolvedAt: new Date(), problemAppearsResolvedById: res.locals.authenticatedUser.id }, select });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.json(result);
  } catch (error) {
    const failure = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034"
      ? toErrorResponse(new ApiError(409, "CONFLICT", "Ticket changed. Please retry.")) : toErrorResponse(error);
    res.status(failure.status).json(failure.body);
  }
});
