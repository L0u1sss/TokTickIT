import { ActionStatus, Prisma, type PrismaClient, type Status } from "@prisma/client";
import { Router, type NextFunction, type Request, type Response } from "express";
import { getPrisma } from "./prisma.js";
import { ApiError, validationError } from "./errors.js";
import { parsePositivePathId } from "./path-contract.js";
import { requireOwnedTicket } from "./attachment-service.js";
import { lockActionAssignee } from "./user-management.js";
import { createHash } from "node:crypto";

const staffRoles = ["IT_STAFF", "ADMINISTRATOR"] as const;
const userSelect = { id: true, displayName: true, role: true } as const;
const actionSelect = {
  id: true,
  ticketId: true,
  clientRequestId: true,
  description: true,
  result: true,
  status: true,
  recordedBy: { select: userSelect },
  performedBy: { select: userSelect },
  assignee: { select: userSelect },
  followUpRequired: true,
  followUpNote: true,
  attachmentNotes: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  cancelledAt: true,
  cancelledBy: { select: userSelect },
  cancellationSource: true,
} satisfies Prisma.ActionTakenSelect;

type ActionDtoSource = Prisma.ActionTakenGetPayload<{ select: typeof actionSelect }>;
type Database = PrismaClient | Prisma.TransactionClient;

const transitions: Record<ActionStatus, readonly ActionStatus[]> = {
  PLANNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};
const actionableStatuses: Status[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];

function dto(action: ActionDtoSource) {
  return {
    ...action,
    createdAt: action.createdAt.toISOString(),
    updatedAt: action.updatedAt.toISOString(),
    completedAt: action.completedAt?.toISOString() ?? null,
    cancelledAt: action.cancelledAt?.toISOString() ?? null,
  };
}

function object(body: unknown, allowed: readonly string[], required: readonly string[] = []) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw validationError([{ field: "body", issue: "Send a JSON object." }]);
  }
  const input = body as Record<string, unknown>;
  const unknown = Object.keys(input).filter(key => !allowed.includes(key));
  const missing = required.filter(key => !(key in input));
  if (unknown.length || missing.length) {
    throw validationError([
      ...unknown.map(field => ({ field, issue: "This field is not accepted." })),
      ...missing.map(field => ({ field, issue: "This field is required." })),
    ]);
  }
  return input;
}

function text(value: unknown, field: string, maximum: number, nullable = false) {
  if (value === null && nullable) return null;
  if (typeof value !== "string" || value.includes("\u0000")) {
    throw validationError([{ field, issue: `Enter 1–${maximum.toLocaleString("en-US")} characters of plain text.` }]);
  }
  const normalized = value.trim();
  if (!normalized || Array.from(normalized).length > maximum) {
    throw validationError([{ field, issue: `Enter 1–${maximum.toLocaleString("en-US")} characters of plain text.` }]);
  }
  return normalized;
}

function optionalText(input: Record<string, unknown>, field: string, maximum: number) {
  return field in input ? text(input[field], field, maximum, true) : undefined;
}

function positiveInteger(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw validationError([{ field, issue: "Must be a positive integer." }]);
  }
  return value;
}

function revision(value: unknown) {
  return positiveInteger(value, "revision");
}

function uuid(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw validationError([{ field: "clientRequestId", issue: "Must be a valid UUID." }]);
  }
  return value.toLowerCase();
}

function nullableBoolean(value: unknown, field: string) {
  if (typeof value !== "boolean") throw validationError([{ field, issue: "Must be true or false." }]);
  return value;
}

function validateFollowUp(required: boolean, note: string | null) {
  if (required && !note) throw validationError([{ field: "followUpNote", issue: "Enter a Follow-up Note when follow-up is required." }]);
  if (!required && note !== null) throw validationError([{ field: "followUpNote", issue: "Remove the Follow-up Note when follow-up is not required." }]);
}

async function requireTicket(db: Database, ticketId: number) {
  const ticket = await db.ticket.findUnique({ where: { id: ticketId }, select: { id: true, status: true, version: true, workflowCycle: true } });
  if (!ticket) throw new ApiError(404, "NOT_FOUND", "Ticket not found.");
  return ticket;
}

async function lockTicket(tx: Prisma.TransactionClient, ticketId: number) {
  await tx.$queryRaw`SELECT "id" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE`;
  return requireTicket(tx, ticketId);
}

function requireActionable(status: Status) {
  if (!actionableStatuses.includes(status)) throw new ApiError(409, "TICKET_NOT_ACTIONABLE", "Actions cannot be changed while the Ticket is resolved, closed, or cancelled.");
}

async function incrementTicketVersion(tx: Prisma.TransactionClient, ticketId: number, expected: number, now: Date) {
  const changed = await tx.ticket.updateMany({ where: { id: ticketId, version: expected }, data: { version: { increment: 1 }, updatedAt: now } });
  if (changed.count !== 1) throw new ApiError(409, "STALE_TICKET", "This Ticket changed. Reload it before saving.");
  return expected + 1;
}

async function requireEligibleAssignee(db: Database, assigneeId: number) {
  const user = await db.user.findFirst({
    where: { id: assigneeId, isActive: true, role: { in: [...staffRoles] } },
    select: userSelect,
  });
  if (!user) throw new ApiError(409, "INVALID_ACTION_ASSIGNEE", "The selected assignee is not an active IT Staff or Administrator.");
  return user;
}

async function findAction(db: Database, ticketId: number, actionId: number) {
  const action = await db.actionTaken.findFirst({ where: { id: actionId, ticketId }, select: actionSelect });
  if (!action) throw new ApiError(404, "NOT_FOUND", "Action not found.");
  return action;
}

async function listActions(db: Database, ticketId: number) {
  await requireTicket(db, ticketId);
  const items = await db.actionTaken.findMany({
    where: { ticketId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: actionSelect,
  });
  return items.map(dto);
}

type CreateInput = {
  clientRequestId: string;
  description: string;
  result: string | null;
  assigneeId: number;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  expectedTicketVersion: number;
};

function parseCreate(body: unknown): CreateInput {
  const input = object(body,
    ["clientRequestId", "expectedTicketVersion", "description", "result", "assigneeId", "followUpRequired", "followUpNote", "attachmentNotes"],
    ["clientRequestId", "expectedTicketVersion", "description", "assigneeId", "followUpRequired"]);
  const parsed = {
    clientRequestId: uuid(input.clientRequestId),
    expectedTicketVersion: positiveInteger(input.expectedTicketVersion, "expectedTicketVersion"),
    description: text(input.description, "description", 2000)!,
    result: optionalText(input, "result", 2000) ?? null,
    assigneeId: positiveInteger(input.assigneeId, "assigneeId"),
    followUpRequired: nullableBoolean(input.followUpRequired, "followUpRequired"),
    followUpNote: optionalText(input, "followUpNote", 1000) ?? null,
    attachmentNotes: optionalText(input, "attachmentNotes", 1000) ?? null,
  };
  validateFollowUp(parsed.followUpRequired, parsed.followUpNote);
  return parsed;
}

function createFingerprint(input: CreateInput, actorId: number) {
  const { expectedTicketVersion: _version, ...intent } = input;
  void _version;
  return createHash("sha256").update(JSON.stringify({ actorId, ...intent })).digest("hex");
}

function sameCreate(action: ActionDtoSource, input: CreateInput, actorId: number) {
  return (action as ActionDtoSource & { createFingerprint?: string }).createFingerprint === createFingerprint(input, actorId)
    && action.recordedBy.id === actorId;
}

async function existingCreate(prisma: PrismaClient, ticketId: number, input: CreateInput, actorId: number) {
  const existing = await prisma.actionTaken.findUnique({
    where: { ticketId_clientRequestId: { ticketId, clientRequestId: input.clientRequestId } },
    select: { ...actionSelect, createFingerprint: true },
  });
  if (!existing) return null;
  if (!sameCreate(existing, input, actorId)) {
    throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "clientRequestId was already used for different Action data.");
  }
  return { action: dto(existing), replayed: true as const };
}

async function createAction(prisma: PrismaClient, ticketId: number, actorId: number, body: unknown) {
  const input = parseCreate(body);
  const replay = await existingCreate(prisma, ticketId, input, actorId);
  if (replay) return { ...replay, ticketVersion: (await requireTicket(prisma, ticketId)).version };
  try {
    const created = await prisma.$transaction(async tx => {
      const now = new Date();
      const ticket = await lockTicket(tx, ticketId);
      requireActionable(ticket.status);
      const existingLocked = await tx.actionTaken.findUnique({ where: { ticketId_clientRequestId: { ticketId, clientRequestId: input.clientRequestId } }, select: { id: true } });
      if (existingLocked) {
        const replayResult = await tx.actionTaken.findUniqueOrThrow({
          where: { ticketId_clientRequestId: { ticketId, clientRequestId: input.clientRequestId } },
          select: { ...actionSelect, createFingerprint: true },
        });
        if (sameCreate(replayResult, input, actorId)) return { action: dto(replayResult), ticketVersion: ticket.version, replayed: true as const };
        throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "clientRequestId was already used for different Action data.");
      }
      if (ticket.version !== input.expectedTicketVersion) throw new ApiError(409, "STALE_TICKET", "This Ticket changed. Reload it before saving.");
      await lockActionAssignee(tx, input.assigneeId);
      await requireEligibleAssignee(tx, input.assigneeId);
      const { expectedTicketVersion: _version, ...createData } = input;
      void _version;
      const action = await tx.actionTaken.create({
        data: { ticketId, workflowCycle: ticket.workflowCycle, recordedById: actorId, createFingerprint: createFingerprint(input, actorId), status: "PLANNED", ...createData },
        select: actionSelect,
      });
      const ticketVersion = await incrementTicketVersion(tx, ticketId, input.expectedTicketVersion, now);
      await tx.actionEvent.create({
        data: {
          actionId: action.id, actorId, eventType: "ACTION_CREATED", fromStatus: null, toStatus: "PLANNED", revision: 1,
          changedFields: { fields: ["description", "result", "assigneeId", "followUpRequired", "followUpNote", "attachmentNotes", "status"] },
        },
      });
      return { action: dto(action), ticketVersion, replayed: false as const };
    });
    return created;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const concurrentReplay = await existingCreate(prisma, ticketId, input, actorId);
      if (concurrentReplay) return { ...concurrentReplay, ticketVersion: (await requireTicket(prisma, ticketId)).version };
    }
    throw error;
  }
}

const editableFields = ["description", "result", "assigneeId", "followUpRequired", "followUpNote", "attachmentNotes"] as const;
type EditableField = typeof editableFields[number];

async function updateAction(prisma: PrismaClient, ticketId: number, actionId: number, actorId: number, body: unknown) {
  const input = object(body, ["expectedTicketVersion", "revision", ...editableFields], ["expectedTicketVersion", "revision"]);
  const expectedTicketVersion = positiveInteger(input.expectedTicketVersion, "expectedTicketVersion");
  if (!editableFields.some(field => field in input)) throw validationError([{ field: "body", issue: "Send at least one editable field." }]);
  const expectedRevision = revision(input.revision);
  return prisma.$transaction(async tx => {
    const now = new Date();
    const ticket = await lockTicket(tx, ticketId);
    requireActionable(ticket.status);
    if (ticket.version !== expectedTicketVersion) throw new ApiError(409, "STALE_TICKET", "This Ticket changed. Reload it before saving.");
    await tx.$queryRaw`SELECT "id" FROM "ActionTaken" WHERE "id" = ${actionId} AND "ticketId" = ${ticketId} FOR UPDATE`;
    const current = await findAction(tx, ticketId, actionId);
    if (current.revision !== expectedRevision) throw new ApiError(409, "STALE_ACTION", "This Action changed. Reload it before saving.");
    if (current.status === "COMPLETED" || current.status === "CANCELLED") throw new ApiError(409, "INVALID_ACTION_TRANSITION", "Terminal Actions cannot be edited.");
    const next = {
      description: "description" in input ? text(input.description, "description", 2000)! : current.description,
      result: "result" in input ? text(input.result, "result", 2000, true) : current.result,
      assigneeId: "assigneeId" in input ? positiveInteger(input.assigneeId, "assigneeId") : current.assignee.id,
      followUpRequired: "followUpRequired" in input ? nullableBoolean(input.followUpRequired, "followUpRequired") : current.followUpRequired,
      followUpNote: "followUpNote" in input ? text(input.followUpNote, "followUpNote", 1000, true) : current.followUpNote,
      attachmentNotes: "attachmentNotes" in input ? text(input.attachmentNotes, "attachmentNotes", 1000, true) : current.attachmentNotes,
    };
    if (!next.followUpRequired && !("followUpNote" in input)) next.followUpNote = null;
    validateFollowUp(next.followUpRequired, next.followUpNote);
    const changedFields = editableFields.filter(field => {
      const oldValue = field === "assigneeId" ? current.assignee.id : current[field as Exclude<EditableField, "assigneeId">];
      return oldValue !== next[field];
    });
    if (!changedFields.length) return { action: dto(current), ticketVersion: ticket.version };
    await lockActionAssignee(tx, next.assigneeId);
    await requireEligibleAssignee(tx, next.assigneeId);
    const changed = await tx.actionTaken.updateMany({
      where: { id: actionId, ticketId, revision: expectedRevision },
      data: { ...next, revision: { increment: 1 } },
    });
    if (changed.count !== 1) throw new ApiError(409, "STALE_ACTION", "This Action changed. Reload it before saving.");
    const ticketVersion = await incrementTicketVersion(tx, ticketId, expectedTicketVersion, now);
    const newRevision = expectedRevision + 1;
    await tx.actionEvent.create({
      data: {
        actionId, actorId, eventType: "ACTION_UPDATED",
        fromStatus: current.status, toStatus: current.status, changedFields: { fields: changedFields }, revision: newRevision,
      },
    });
    return { action: dto(await tx.actionTaken.findUniqueOrThrow({ where: { id: actionId }, select: actionSelect })), ticketVersion };
  });
}

async function transitionAction(prisma: PrismaClient, ticketId: number, actionId: number, actorId: number, body: unknown) {
  const input = object(body, ["expectedTicketVersion", "status", "revision", "result"], ["expectedTicketVersion", "status", "revision"]);
  const expectedTicketVersion = positiveInteger(input.expectedTicketVersion, "expectedTicketVersion");
  if (typeof input.status !== "string" || !Object.values(ActionStatus).includes(input.status as ActionStatus)) {
    throw validationError([{ field: "status", issue: `Must be one of ${Object.values(ActionStatus).join(", ")}.` }]);
  }
  const nextStatus = input.status as ActionStatus;
  if ("result" in input && nextStatus !== "COMPLETED") throw validationError([{ field: "result", issue: "Result can be supplied here only when completing an Action." }]);
  const expectedRevision = revision(input.revision);
  return prisma.$transaction(async tx => {
    const now = new Date();
    const ticket = await lockTicket(tx, ticketId);
    requireActionable(ticket.status);
    if (ticket.version !== expectedTicketVersion) throw new ApiError(409, "STALE_TICKET", "This Ticket changed. Reload it before saving.");
    await tx.$queryRaw`SELECT "id" FROM "ActionTaken" WHERE "id" = ${actionId} AND "ticketId" = ${ticketId} FOR UPDATE`;
    const current = await findAction(tx, ticketId, actionId);
    if (current.revision !== expectedRevision) throw new ApiError(409, "STALE_ACTION", "This Action changed. Reload it before saving.");
    if (!transitions[current.status].includes(nextStatus)) {
      throw new ApiError(409, "INVALID_ACTION_TRANSITION", `Cannot change Action status from ${current.status} to ${nextStatus}.`);
    }
    const result = nextStatus === "COMPLETED"
      ? ("result" in input ? text(input.result, "result", 2000)! : current.result)
      : current.result;
    if (nextStatus === "COMPLETED" && !result) throw validationError([{ field: "result", issue: "Completed Actions require a Result." }]);
    if ((nextStatus === "COMPLETED" || nextStatus === "CANCELLED") && current.followUpRequired) throw validationError([{ field: "followUpRequired", issue: "Clear follow-up before completing or cancelling an Action." }]);
    if (nextStatus === "COMPLETED" && current.assignee.id !== actorId) throw new ApiError(403, "ACTION_ASSIGNEE_REQUIRED", "Only the current Action assignee may complete it.");
    if (nextStatus === "COMPLETED") {
      await lockActionAssignee(tx, current.assignee.id);
      await requireEligibleAssignee(tx, current.assignee.id);
    }
    const completedAt = nextStatus === "COMPLETED" ? now : null;
    const cancellation = nextStatus === "CANCELLED" ? { cancelledAt: now, cancelledById: actorId, cancellationSource: "STAFF_ACTION" as const } : { cancelledAt: null, cancelledById: null, cancellationSource: null };
    const changed = await tx.actionTaken.updateMany({
      where: { id: actionId, ticketId, revision: expectedRevision },
      data: { status: nextStatus, result, completedAt, performedById: nextStatus === "COMPLETED" ? current.assignee.id : null, ...cancellation, revision: { increment: 1 }, updatedAt: now },
    });
    if (changed.count !== 1) throw new ApiError(409, "STALE_ACTION", "This Action changed. Reload it before saving.");
    const ticketVersion = await incrementTicketVersion(tx, ticketId, expectedTicketVersion, now);
    await tx.actionEvent.create({
      data: {
        actionId, actorId, eventType: nextStatus === "COMPLETED" ? "ACTION_COMPLETED" : nextStatus === "CANCELLED" ? "ACTION_CANCELLED" : "ACTION_UPDATED", fromStatus: current.status, toStatus: nextStatus,
        changedFields: { fields: nextStatus === "COMPLETED" ? ["status", ...(result !== current.result ? ["result"] : []), "completedAt", "performedById"] : nextStatus === "CANCELLED" ? ["status", "cancelledAt", "cancelledById", "cancellationSource"] : ["status"] },
        revision: expectedRevision + 1,
      },
    });
    return { action: dto(await tx.actionTaken.findUniqueOrThrow({ where: { id: actionId }, select: actionSelect })), ticketVersion };
  });
}

const route = (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { void handler(req, res).catch(next); };

export const staffActionsRouter = Router();
staffActionsRouter.get("/tickets/:ticketId/actions", route(async (req, res) => {
  const ticketId = parsePositivePathId(req.params.ticketId, "ticketId");
  res.json({ items: await listActions(getPrisma(), ticketId) });
}));
staffActionsRouter.get("/tickets/:ticketId/actions/:actionId", route(async (req, res) => {
  const ticketId = parsePositivePathId(req.params.ticketId, "ticketId");
  const actionId = parsePositivePathId(req.params.actionId, "actionId");
  res.json(dto(await findAction(getPrisma(), ticketId, actionId)));
}));
staffActionsRouter.post("/tickets/:ticketId/actions", route(async (req, res) => {
  const ticketId = parsePositivePathId(req.params.ticketId, "ticketId");
  const result = await createAction(getPrisma(), ticketId, res.locals.authenticatedUser.id, req.body);
  if (!result.replayed && result.action) res.location(`/api/staff/tickets/${ticketId}/actions/${result.action.id}`);
  res.status(result.replayed ? 200 : 201).json(result);
}));
staffActionsRouter.patch("/tickets/:ticketId/actions/:actionId", route(async (req, res) => {
  res.json(await updateAction(getPrisma(), parsePositivePathId(req.params.ticketId, "ticketId"), parsePositivePathId(req.params.actionId, "actionId"), res.locals.authenticatedUser.id, req.body));
}));
staffActionsRouter.patch("/tickets/:ticketId/actions/:actionId/status", route(async (req, res) => {
  res.json(await transitionAction(getPrisma(), parsePositivePathId(req.params.ticketId, "ticketId"), parsePositivePathId(req.params.actionId, "actionId"), res.locals.authenticatedUser.id, req.body));
}));
staffActionsRouter.get("/tickets/:ticketId/actions/:actionId/events", route(async (req, res) => {
  const ticketId = parsePositivePathId(req.params.ticketId, "ticketId");
  const actionId = parsePositivePathId(req.params.actionId, "actionId");
  await findAction(getPrisma(), ticketId, actionId);
  const items = await getPrisma().actionEvent.findMany({
    where: { actionId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, eventType: true, fromStatus: true, toStatus: true, changedFields: true, revision: true, createdAt: true, actor: { select: userSelect } },
  });
  res.json({ items: items.map(event => ({ ...event, createdAt: event.createdAt.toISOString() })) });
}));

export const requesterActionsRouter = Router();
requesterActionsRouter.get("/:ticketId/actions", route(async (req, res) => {
  const ticketId = parsePositivePathId(req.params.ticketId, "ticketId");
  await requireOwnedTicket(getPrisma(), res.locals.authenticatedUser, ticketId);
  res.json({ items: await listActions(getPrisma(), ticketId) });
}));
requesterActionsRouter.get("/:ticketId/actions/:actionId", route(async (req, res) => {
  const ticketId = parsePositivePathId(req.params.ticketId, "ticketId");
  await requireOwnedTicket(getPrisma(), res.locals.authenticatedUser, ticketId);
  res.json(dto(await findAction(getPrisma(), ticketId, parsePositivePathId(req.params.actionId, "actionId"))));
}));
