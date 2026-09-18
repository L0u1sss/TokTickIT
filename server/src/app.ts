import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { createAuthRouter, requireAuthentication } from "./auth-routes.js";
import multer from "multer";
import { getPrisma } from "./prisma.js";
import { ApiError, toErrorResponse } from "./errors.js";
import type { RequesterContext } from "./requester-context.js";
import { requireApprovedOrigin, requireRole } from "./authorization.js";
import { randomUUID } from "node:crypto";
import { parseTicketCreateBody } from "./ticket-contract.js";
import { createTicket } from "./ticket-service.js";
import { parseTicketListQuery } from "./ticket-query.js";
import { listTickets } from "./ticket-list-service.js";
import { staffQueueRouter } from "./staff-queue.js";
import { parsePositivePathId } from "./path-contract.js";
import { getOwnedTicketDetail } from "./ticket-detail-service.js";
import {
  downloadOwnedAttachment,
  removeOwnedAttachment,
  requireOwnedTicket,
  uploadOwnedAttachment,
} from "./attachment-service.js";
import {
  ATTACHMENT_MAX_BYTES,
  normalizeMultipartFilename,
  parseRemovalReason,
} from "./attachment-contract.js";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

function sessionRequester(res: Response): RequesterContext {
  const { id, displayName, email } = res.locals.authenticatedUser;
  return { id, displayName, email };
}

const upload = multer({
  storage: multer.memoryStorage(),
  // Busboy raises LIMIT_PART_COUNT when the configured count is reached, so
  // two keeps one file part valid while files/fields enforce the exact shape.
  limits: { fileSize: ATTACHMENT_MAX_BYTES, files: 1, fields: 0, parts: 2 },
});

// Auth router checks Origin before JSON parsing, including unauthenticated Login.
app.use("/api/auth", createAuthRouter(getPrisma));
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173", credentials: true, exposedHeaders: ["Content-Disposition"] }));
app.use("/api", (req, res, next) => {
  if (req.path === "/health") { next(); return; }
  res.set("Cache-Control", "no-store");
  res.locals.requestId = randomUUID();
  res.set("X-Request-ID", res.locals.requestId);
  const sendJson = res.json.bind(res);
  res.json = (body) => {
    if (body?.error && typeof body.error === "object") {
      const error = body.error;
      if (res.statusCode >= 500) console.error("Request failed", res.locals.requestId);
      return sendJson({ ...body, error: { ...error, requestId: res.locals.requestId,
        ...(Array.isArray(error.details) ? { fieldErrors: Object.fromEntries(error.details.map((detail: { field: string; issue: string }) => [detail.field, detail.issue])) } : {}),
      } });
    }
    return sendJson(body);
  };
  requireAuthentication(getPrisma)(req, res, next);
});
app.use("/api", requireApprovedOrigin);
app.use("/api/tickets", requireRole("REQUESTER"));
app.use("/api/metadata", requireRole("REQUESTER"));
app.use("/api/staff", requireRole("IT_STAFF", "ADMINISTRATOR"));
app.use("/api/admin", requireRole("ADMINISTRATOR"));
app.use(express.json());
app.use("/api/staff", staffQueueRouter);

// ---------------------------------------------------------------------------
// Issue 2 — API health check
// Make the test in tests/lab-01/health.test.ts pass.
// It must return HTTP 200 with JSON: { status: "ok", service: "TokTickIT API" }
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

// ---------------------------------------------------------------------------
// Issue 4 — Category list
// GET /api/categories
//   -> read categories from PostgreSQL via Prisma
//   -> return each { id, name } in predictable (id) order
//   -> on failure, respond 500 with a safe message (no internal details)
// ---------------------------------------------------------------------------
app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await getPrisma().category.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });
    res.status(200).json(categories);
  } catch (err) {
    const failure = toErrorResponse(err);
    res.status(failure.status).json(failure.body);
  }
});

// ---------------------------------------------------------------------------
// Issue 15 — Active Create Ticket reference data
// ---------------------------------------------------------------------------
app.get("/api/metadata", async (_req: Request, res: Response) => {
  try {
    const [categories, relatedSystems] = await Promise.all([
      getPrisma().category.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      getPrisma().relatedSystem.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
    ]);

    res.status(200).json({ categories, relatedSystems });
  } catch {
    console.error("Failed to fetch ticket metadata");
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed.",
      },
    });
  }
});

// ---------------------------------------------------------------------------
// Issue 15 — Requester-scoped, idempotent Ticket creation
// ---------------------------------------------------------------------------
app.post("/api/tickets", async (req: Request, res: Response) => {
  try {
    const requester = sessionRequester(res);
    const input = parseTicketCreateBody(req.body);
    const result = await createTicket(getPrisma(), requester, input);

    res.location(`/api/tickets/${result.ticket.id}`);
    res.status(result.status).json({
      ticket: result.ticket,
      replayed: result.replayed,
    });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error("Failed to create ticket");
    }
    const response = toErrorResponse(error);
    res.status(response.status).json(response.body);
  }
});

// ---------------------------------------------------------------------------
// Issue 16 — Requester-scoped My Tickets list
// ---------------------------------------------------------------------------
app.get("/api/tickets", async (req: Request, res: Response) => {
  try {
    const requester = sessionRequester(res);
    const query = parseTicketListQuery(req.query);
    const result = await listTickets(getPrisma(), requester, query);
    res.status(200).json(result);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error("Failed to list tickets");
    }
    const response = toErrorResponse(error);
    res.status(response.status).json(response.body);
  }
});

// ---------------------------------------------------------------------------
// Issue 17 — Requester-owned Ticket Detail and Attachment metadata
// ---------------------------------------------------------------------------
app.get("/api/tickets/:id", async (req: Request, res: Response) => {
  try {
    const requester = sessionRequester(res);
    const ticketId = parsePositivePathId(req.params.id, "id");
    const ticket = await getOwnedTicketDetail(getPrisma(), requester, ticketId);
    res.status(200).json(ticket);
  } catch (error) {
    if (!(error instanceof ApiError)) console.error("Failed to load ticket detail");
    const response = toErrorResponse(error);
    res.status(response.status).json(response.body);
  }
});

type OwnedAttachmentRequest = Request & {
  ownedRequester?: RequesterContext;
  ownedTicketId?: number;
};

async function prepareOwnedAttachmentRequest(
  req: OwnedAttachmentRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const requester = sessionRequester(res);
    const ticketId = parsePositivePathId(req.params.id, "id");
    await requireOwnedTicket(getPrisma(), requester, ticketId);
    req.ownedRequester = requester;
    req.ownedTicketId = ticketId;
    next();
  } catch (error) {
    const response = toErrorResponse(error);
    res.status(response.status).json(response.body);
  }
}

function attachmentDisposition(fileName: string): string {
  const fallback = fileName.replace(/[^\x20-\x7e]|["\\]/gu, "_");
  const encoded = encodeURIComponent(fileName).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

app.post(
  "/api/tickets/:id/attachments",
  prepareOwnedAttachmentRequest,
  upload.single("file"),
  async (req: OwnedAttachmentRequest, res: Response) => {
    try {
      if (
        !req.ownedRequester ||
        !req.ownedTicketId ||
        !req.file ||
        !req.body ||
        Object.keys(req.body).length > 0
      ) {
        throw new ApiError(400, "INVALID_MULTIPART", "Attach exactly one file named file.");
      }
      const attachment = await uploadOwnedAttachment(
        getPrisma(),
        req.ownedRequester,
        req.ownedTicketId,
        { ...req.file, originalname: normalizeMultipartFilename(req.file.originalname) },
      );
      res.status(201).json(attachment);
    } catch (error) {
      if (!(error instanceof ApiError)) console.error("Failed to upload attachment");
      const response = toErrorResponse(error);
      res.status(response.status).json(response.body);
    }
  },
);

app.get(
  "/api/tickets/:id/attachments/:attId/download",
  async (req: Request, res: Response) => {
    try {
      const requester = sessionRequester(res);
      const ticketId = parsePositivePathId(req.params.id, "id");
      const attachmentId = parsePositivePathId(req.params.attId, "attId");
      const download = await downloadOwnedAttachment(
        getPrisma(), requester, ticketId, attachmentId,
      );
      res.set({
        "Content-Type": download.mediaType,
        "Content-Length": String(download.bytes.length),
        "Content-Disposition": attachmentDisposition(download.fileName),
      });
      res.status(200).send(download.bytes);
    } catch (error) {
      if (!(error instanceof ApiError)) console.error("Failed to download attachment");
      const response = toErrorResponse(error);
      res.status(response.status).json(response.body);
    }
  },
);

app.patch(
  "/api/tickets/:id/attachments/:attId/remove",
  async (req: Request, res: Response) => {
    try {
      const requester = sessionRequester(res);
      const ticketId = parsePositivePathId(req.params.id, "id");
      const attachmentId = parsePositivePathId(req.params.attId, "attId");
      await requireOwnedTicket(getPrisma(), requester, ticketId);
      const reason = parseRemovalReason(req.body);
      const attachment = await removeOwnedAttachment(
        getPrisma(), requester, ticketId, attachmentId, reason,
      );
      res.status(200).json(attachment);
    } catch (error) {
      if (!(error instanceof ApiError)) console.error("Failed to remove attachment");
      const response = toErrorResponse(error);
      res.status(response.status).json(response.body);
    }
  },
);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "The requested resource was not found." } });
});

// Keep malformed JSON and unexpected middleware errors inside the documented
// JSON envelope instead of Express's default HTML error response.
app.use(
  (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    void _next;
    const parserError =
      error && typeof error === "object"
        ? (error as { type?: string })
        : undefined;

    if (parserError?.type === "entity.parse.failed") {
      res.status(400).json({
        error: {
          code: "INVALID_JSON",
          message: "The request body must contain valid JSON.",
        },
      });
      return;
    }

    if (error instanceof multer.MulterError) {
      const response = error.code === "LIMIT_FILE_SIZE"
        ? new ApiError(400, "ATTACHMENT_SIZE_INVALID", "File must be 5 MB or smaller.")
        : new ApiError(400, "INVALID_MULTIPART", "Attach exactly one file named file.");
      const envelope = toErrorResponse(response);
      res.status(envelope.status).json(envelope.body);
      return;
    }

    console.error("Unhandled request failure");
    const response = toErrorResponse(error);
    res.status(response.status).json(response.body);
  },
);

export default app;
