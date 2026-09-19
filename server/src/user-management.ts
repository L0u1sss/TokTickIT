import { Prisma, UserRole, type PrismaClient } from "@prisma/client";
import { Router, type Request, type Response, type NextFunction } from "express";
import { ApiError, validationError } from "./errors.js";
import { hashPassword, normalizeEmail, validateNewPassword, PASSWORD_RULES } from "./password.js";
import { getPrisma } from "./prisma.js";
import { parsePositivePathId } from "./path-contract.js";

export const userSummarySelect = { id: true, displayName: true, email: true, role: true, isActive: true, mustChangePassword: true, createdAt: true, updatedAt: true } as const;
export async function lockUserManagement(tx: Prisma.TransactionClient) {
  // Shared by account changes and ticket assignment. Acquire before reading either.
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(350035)`;
}
function object(body: unknown, fields: string[]) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw validationError([{ field: "form", issue: "Send a JSON object." }]);
  const data = body as Record<string, unknown>;
  if (!Object.keys(data).length || Object.keys(data).some(key => !fields.includes(key))) throw validationError([{ field: "form", issue: "Send only the permitted fields." }]);
  return data;
}
export function initialPassword(body: unknown) {
  const value = object(body, ["initialPassword"]).initialPassword;
  try { validateNewPassword(value); } catch { throw validationError([{ field: "initialPassword", issue: PASSWORD_RULES }]); }
  return value as string;
}
export function parseUserBody(body: unknown, create = false) {
  const fields = ["displayName", "email", "role", "isActive"];
  const input = object(body, create ? [...fields, "initialPassword"] : fields);
  const data: { displayName?: string; email?: string; role?: UserRole; isActive?: boolean } = {};
  for (const field of fields) {
    if (!(field in input) && !create) continue;
    const value = input[field];
    if (field === "displayName") {
      if (typeof value !== "string" || !value.trim() || Array.from(value.trim()).length > 120) throw validationError([{ field, issue: "Enter a name of 1–120 characters." }]);
      data.displayName = value.trim();
    } else if (field === "email") data.email = normalizeEmail(value);
    else if (field === "role") {
      if (typeof value !== "string" || !Object.values(UserRole).includes(value as UserRole)) throw validationError([{ field, issue: "Choose one permitted role." }]);
      data.role = value as UserRole;
    } else {
      if (typeof value !== "boolean") throw validationError([{ field, issue: "Choose an activation state." }]);
      data.isActive = value;
    }
  }
  return data;
}
function duplicate(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ApiError(409, "EMAIL_ALREADY_EXISTS", "This email address is already in use.", [{ field: "email", issue: "Choose a different email address." }]);
  throw error;
}
export async function updateUser(prisma: PrismaClient, actorId: number, id: number, body: unknown, reset = false) {
  const data = reset ? { passwordHash: await hashPassword(initialPassword(body)), mustChangePassword: true } : parseUserBody(body);
  return prisma.$transaction(async tx => {
    await lockUserManagement(tx);
    // Coordinate credential changes with login/change-password, too.
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" IN (${actorId}, ${id}) ORDER BY "id" FOR UPDATE`;
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (!actor?.isActive || actor.role !== "ADMINISTRATOR" || actor.mustChangePassword) throw new ApiError(403, "FORBIDDEN", "Administrator access is required.");
    const target = await tx.user.findUnique({ where: { id } });
    if (!target) throw new ApiError(404, "NOT_FOUND", "User not found.");
    const next = { ...target, ...data };
    if (!next.isActive && id === actorId) throw new ApiError(409, "SELF_DEACTIVATION_NOT_ALLOWED", "You cannot deactivate your own account.");
    if (target.isActive && target.role === "ADMINISTRATOR" && (!next.isActive || next.role !== "ADMINISTRATOR") && await tx.user.count({ where: { isActive: true, role: "ADMINISTRATOR" } }) <= 1) throw new ApiError(409, "LAST_ACTIVE_ADMIN_REQUIRED", "Keep at least one active Administrator.");
    if ((!next.isActive || next.role === "REQUESTER") && await tx.ticket.count({ where: { ownerId: id } })) throw new ApiError(409, "USER_HAS_ASSIGNED_TICKETS", "Reassign or close/cancel assigned Tickets before changing this account.");
    const user = await tx.user.update({ where: { id }, data, select: userSummarySelect });
    if (reset || !next.isActive || target.role !== next.role) await tx.session.deleteMany({ where: { userId: id } });
    return user;
  }).catch(duplicate);
}

export const userManagementRouter = Router();
const route = (handler: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => { void handler(req, res).catch(next); };
userManagementRouter.get("/users", route(async (req, res) => {
  const { search, role } = req.query;
  if (Object.keys(req.query).some(key => !["search", "role"].includes(key)) || (search !== undefined && (typeof search !== "string" || !search.trim() || Array.from(search.trim()).length > 120)) || (role !== undefined && (typeof role !== "string" || !Object.values(UserRole).includes(role as UserRole)))) throw new ApiError(400, "INVALID_QUERY", "Use a name/email search and one valid role.");
  const filters = { ...(search ? { search: (search as string).trim() } : {}), ...(role ? { role: role as UserRole } : {}) };
  const items = await getPrisma().user.findMany({ where: { ...(filters.role ? { role: filters.role } : {}), ...(filters.search ? { OR: [{ displayName: { contains: filters.search, mode: "insensitive" } }, { email: { contains: filters.search, mode: "insensitive" } }] } : {}) }, select: userSummarySelect, orderBy: [{ displayName: "asc" }, { id: "asc" }] });
  res.json({ items, filters });
}));
userManagementRouter.post("/users", route(async (req, res) => {
  const parsed = parseUserBody(req.body, true) as { displayName: string; email: string; role: UserRole; isActive: boolean };
  const passwordHash = await hashPassword(initialPassword({ initialPassword: req.body.initialPassword }));
  const user = await getPrisma().$transaction(async tx => {
    await lockUserManagement(tx);
    const actor = await tx.user.findUnique({ where: { id: res.locals.authenticatedUser.id } });
    if (!actor?.isActive || actor.role !== "ADMINISTRATOR" || actor.mustChangePassword) throw new ApiError(403, "FORBIDDEN", "Administrator access is required.");
    return tx.user.create({ data: { ...parsed, passwordHash, mustChangePassword: true }, select: userSummarySelect });
  }).catch(duplicate);
  res.location(`/api/admin/users/${user.id}`).status(201).json(user);
}));
userManagementRouter.patch("/users/:id", route(async (req, res) => res.json(await updateUser(getPrisma(), res.locals.authenticatedUser.id, parsePositivePathId(req.params.id, "id"), req.body))));
userManagementRouter.post("/users/:id/initial-password", route(async (req, res) => res.json({ user: await updateUser(getPrisma(), res.locals.authenticatedUser.id, parsePositivePathId(req.params.id, "id"), req.body, true) })));
