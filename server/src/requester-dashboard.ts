import { Prisma, type PrismaClient } from "@prisma/client";
import { Router } from "express";
import { getPrisma } from "./prisma.js";
import { invalidQueryError, toErrorResponse } from "./errors.js";
import { openTicketStatuses } from "./ticket-query.js";
import { serializeTicketSummary, ticketSummarySelection } from "./ticket-list-service.js";

export async function getRequesterDashboard(prisma: PrismaClient, requesterId: number) {
  const owned = { requesterId } as const;
  const [openCount, waitingForRequesterCount, recentlyUpdated, recentlyResolved] = await prisma.$transaction([
    prisma.ticket.count({ where: { ...owned, status: { in: openTicketStatuses } } }),
    prisma.ticket.count({ where: { ...owned, status: "WAITING_FOR_REQUESTER" } }),
    prisma.ticket.findMany({ where: owned, select: ticketSummarySelection, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 5 }),
    prisma.ticket.findMany({ where: { ...owned, status: { in: ["RESOLVED", "CLOSED"] } }, select: ticketSummarySelection, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 5 }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  return {
    metrics: { openCount, waitingForRequesterCount },
    recentlyUpdated: recentlyUpdated.map(serializeTicketSummary),
    recentlyResolved: recentlyResolved.map(serializeTicketSummary),
    generatedAt: new Date().toISOString(),
  };
}

export const requesterDashboardRouter = Router();
requesterDashboardRouter.get("/requester", async (req, res) => {
  try {
    if (Object.keys(req.query).length) throw invalidQueryError([{ field: "query", issue: "Dashboard does not accept query parameters." }]);
    res.json(await getRequesterDashboard(getPrisma(), res.locals.authenticatedUser.id));
  } catch (error) { const failure = toErrorResponse(error); res.status(failure.status).json(failure.body); }
});
