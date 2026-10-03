import { Prisma, Priority, Status, type PrismaClient } from "@prisma/client";
import { Router } from "express";
import { invalidQueryError, toErrorResponse } from "./errors.js";
import { getPrisma } from "./prisma.js";
import { staffOpenStatuses } from "./staff-queue.js";

const userSummary = { id: true, displayName: true, role: true } as const;
const ticketSummary = {
  id: true,
  ticketNumber: true,
  summary: true,
  status: true,
  itPriority: true,
  owner: { select: userSummary },
  version: true,
  resolvedAt: true,
  updatedAt: true,
} satisfies Prisma.TicketSelect;
const actionSummary = {
  id: true,
  ticketId: true,
  description: true,
  status: true,
  assignee: { select: userSummary },
  revision: true,
  recordedById: true,
  assigneeId: true,
  performedById: true,
  updatedAt: true,
  ticket: { select: { ticketNumber: true, summary: true } },
} satisfies Prisma.ActionTakenSelect;

type TicketRow = Prisma.TicketGetPayload<{ select: typeof ticketSummary }>;
type ActionRow = Prisma.ActionTakenGetPayload<{ select: typeof actionSummary }>;
const serializeTicket = (ticket: TicketRow) => ({ ...ticket, resolvedAt: ticket.resolvedAt?.toISOString() ?? null, updatedAt: ticket.updatedAt.toISOString() });
const serializeAction = (action: ActionRow, currentUserId: number) => ({
  id: action.id,
  ticketId: action.ticketId,
  ticketNumber: action.ticket.ticketNumber,
  ticketSummary: action.ticket.summary,
  description: action.description,
  status: action.status,
  assignee: action.assignee,
  revision: action.revision,
  attribution: [
    ...(action.recordedById === currentUserId ? ["RECORDED"] : []),
    ...(action.assigneeId === currentUserId ? ["ASSIGNED"] : []),
    ...(action.performedById === currentUserId ? ["PERFORMED"] : []),
  ],
  updatedAt: action.updatedAt.toISOString(),
});

export async function getStaffDashboard(prisma: PrismaClient, currentUserId: number) {
  const generatedAt = new Date().toISOString();
  return prisma.$transaction(async transaction => {
    const [unassignedOpenCount, ownedByMeOpenCount, statusGroups, priorityGroups, recentlyUpdated, highPriorityTickets, myActions] = await Promise.all([
      transaction.ticket.count({ where: { ownerId: null, status: { in: staffOpenStatuses } } }),
      transaction.ticket.count({ where: { ownerId: currentUserId, status: { in: staffOpenStatuses } } }),
      transaction.ticket.groupBy({ by: ["status"], _count: { _all: true } }),
      transaction.ticket.groupBy({ by: ["itPriority"], _count: { _all: true } }),
      transaction.ticket.findMany({ where: { status: { in: staffOpenStatuses } }, select: ticketSummary, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 5 }),
      transaction.ticket.findMany({ where: { itPriority: "HIGH" }, select: ticketSummary, orderBy: [{ updatedAt: "asc" }, { id: "asc" }], take: 5 }),
      transaction.actionTaken.findMany({ where: { OR: [{ recordedById: currentUserId }, { assigneeId: currentUserId }, { performedById: currentUserId }] }, select: actionSummary, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 5 }),
    ]);
    const byStatus = Object.fromEntries(Object.values(Status).map(status => [status, 0])) as Record<Status, number>;
    const byItPriority = Object.fromEntries(Object.values(Priority).map(priority => [priority, 0])) as Record<Priority, number>;
    for (const group of statusGroups) byStatus[group.status] = group._count._all;
    for (const group of priorityGroups) byItPriority[group.itPriority] = group._count._all;
    return {
      metrics: { unassignedOpenCount, ownedByMeOpenCount, byStatus, byItPriority },
      myActions: myActions.map(action => serializeAction(action, currentUserId)),
      recentlyUpdated: recentlyUpdated.map(serializeTicket),
      urgentTickets: highPriorityTickets.map(serializeTicket),
      generatedAt,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export const staffDashboardRouter = Router();
staffDashboardRouter.get("/dashboard", async (req, res) => {
  try {
    if (Object.keys(req.query).length) throw invalidQueryError([{ field: "query", issue: "Dashboard does not accept query parameters." }]);
    res.json(await getStaffDashboard(getPrisma(), res.locals.authenticatedUser.id));
  } catch (error) {
    const failure = toErrorResponse(error);
    res.status(failure.status).json(failure.body);
  }
});
