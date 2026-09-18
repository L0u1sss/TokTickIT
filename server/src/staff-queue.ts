import { Router } from "express";
import { Prisma, Priority, Status } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { ApiError, invalidQueryError, toErrorResponse } from "./errors.js";
import { parsePositivePathId } from "./path-contract.js";

const sorts = ["updatedAt", "createdAt", "ticketNumber", "itPriority", "status"];
const allowed = new Set(["search", "status", "requestedPriority", "itPriority", "ownerId", "sortBy", "sortOrder", "page", "pageSize"]);
export function parseStaffQuery(raw: Record<string, unknown>) {
  const fail = (field: string): never => { throw invalidQueryError([{ field, issue: "Unsupported or invalid query value." }]); };
  for (const [key, value] of Object.entries(raw)) if (!allowed.has(key) || typeof value !== "string") fail(key);
  const q = raw as Record<string, string>;
  const search = q.search?.trim() ?? null;
  if (search !== null && (!search || Array.from(search).length > 120)) fail("search");
  for (const key of ["requestedPriority", "itPriority"]) if (q[key] !== undefined && !Object.values(Priority).includes(q[key] as Priority)) fail(key);
  if (q.status !== undefined && !Object.values(Status).includes(q.status as Status)) fail("status");
  const integer = (key: string, fallback: number, max: number) => {
    if (q[key] === undefined) return fallback;
    if (!/^[1-9]\d*$/.test(q[key]) || !Number.isSafeInteger(Number(q[key])) || Number(q[key]) > max) fail(key);
    return Number(q[key]);
  };
  const ownerId = q.ownerId ?? null;
  if (ownerId !== null && !["me", "unassigned"].includes(ownerId)) integer("ownerId", 0, 2147483647);
  const sortBy = q.sortBy ?? "updatedAt", sortOrder = q.sortOrder ?? "desc";
  if (!sorts.includes(sortBy)) fail("sortBy");
  if (!["asc", "desc"].includes(sortOrder)) fail("sortOrder");
  return { search, status: (q.status as Status) ?? null, requestedPriority: (q.requestedPriority as Priority) ?? null,
    itPriority: (q.itPriority as Priority) ?? null, ownerId, sortBy, sortOrder: sortOrder as "asc" | "desc",
    page: integer("page", 1, 21474836), pageSize: integer("pageSize", 20, 100) };
}
const userSelect = { id: true, displayName: true, email: true } as const;
const select = { id: true, ticketNumber: true, summary: true, createdAt: true, updatedAt: true,
  category: { select: { id: true, name: true } }, requester: { select: userSelect },
  owner: { select: userSelect }, requestedPriority: true, itPriority: true, status: true } as const;
const eligible = { isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] as ("IT_STAFF" | "ADMINISTRATOR")[] } };
export const staffQueueRouter = Router();
staffQueueRouter.get("/assignees", async (_req, res) => {
  try { res.json({ items: await getPrisma().user.findMany({ where: eligible, select: userSelect, orderBy: [{ displayName: "asc" }, { id: "asc" }] }) }); }
  catch (error) { const result = toErrorResponse(error); res.status(result.status).json(result.body); }
});
staffQueueRouter.get("/tickets", async (req, res) => {
  try {
    const q = parseStaffQuery(req.query), db = getPrisma();
    if (q.ownerId && !["me", "unassigned"].includes(q.ownerId) && !await db.user.findFirst({ where: { ...eligible, id: Number(q.ownerId) }, select: { id: true } })) {
      throw invalidQueryError([{ field: "ownerId", issue: "Choose an active IT Staff or Administrator." }]);
    }
    const where: Prisma.TicketWhereInput = {
      ...(q.search ? { OR: [ { ticketNumber: { contains: q.search, mode: "insensitive" } }, { summary: { contains: q.search, mode: "insensitive" } },
        { requester: { displayName: { contains: q.search, mode: "insensitive" } } }, { requester: { email: { contains: q.search, mode: "insensitive" } } } ] } : {}),
      ...(q.status ? { status: q.status } : {}), ...(q.requestedPriority ? { requestedPriority: q.requestedPriority } : {}),
      ...(q.itPriority ? { itPriority: q.itPriority } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId === "unassigned" ? null : q.ownerId === "me" ? res.locals.authenticatedUser.id : Number(q.ownerId) } : {}),
    };
    const [items, totalItems] = await db.$transaction([
      db.ticket.findMany({ where, select, orderBy: [{ [q.sortBy]: q.sortOrder }, { id: q.sortOrder }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      db.ticket.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    const { page, pageSize, ...filters } = q;
    res.json({ items, pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) }, filters });
  } catch (error) { const result = toErrorResponse(error); res.status(result.status).json(result.body); }
});
// Read-only queue drill-down. Operational controls are delivered by issue #33.
staffQueueRouter.get("/tickets/:id", async (req, res) => {
  try {
    const id = parsePositivePathId(req.params.id, "id");
    const ticket = await getPrisma().ticket.findUnique({ where: { id }, select: { ...select, description: true, relatedSystem: { select: { id: true, name: true } } } });
    if (!ticket) throw new ApiError(404, "NOT_FOUND", "Ticket not found.");
    res.json(ticket);
  } catch (error) { const result = toErrorResponse(error); res.status(result.status).json(result.body); }
});
