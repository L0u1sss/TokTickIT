import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";
import { ApiError, toErrorResponse } from "./errors.js";
import {
  REQUESTER_HEADER_NAME,
  resolveRequesterContext,
} from "./requester-context.js";
import { parseTicketCreateBody } from "./ticket-contract.js";
import { createTicket } from "./ticket-service.js";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(cors());          // already wired: lets the Vite dev server call this API
app.use(express.json());

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
    console.error("Failed to fetch categories:", err);
    res.status(500).json({ error: "Failed to load categories" });
  }
});

// ---------------------------------------------------------------------------
// Issue 14 — Active requester list
// GET /api/requesters
//   -> only active requesters are selectable
//   -> expose the public requester shape expected by the client
//   -> keep ordering deterministic when requesters share the same name
// ---------------------------------------------------------------------------
app.get("/api/requesters", async (_req: Request, res: Response) => {
  try {
    const requesters = await getPrisma().requesterUser.findMany({
      where: { isActive: true },
      select: { id: true, displayName: true, email: true },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
    });

    res.status(200).json(requesters);
  } catch {
    // Keep database errors out of logs returned by shared/dev environments.
    console.error("Failed to fetch requesters");
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed.",
      },
    });
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
    const requester = await resolveRequesterContext(
      getPrisma(),
      req.get(REQUESTER_HEADER_NAME),
    );
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

    console.error("Unhandled request failure");
    const response = toErrorResponse(error);
    res.status(response.status).json(response.body);
  },
);

export default app;
