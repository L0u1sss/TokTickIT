import type { PrismaClient, Priority } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { ApiError } from "../../src/errors.js";
import type { TicketCreateInput } from "../../src/ticket-contract.js";
import { createTicket } from "../../src/ticket-service.js";

type StoredTicket = {
  id: number;
  ticketNumber: string;
  clientRequestId: string;
  summary: string;
  description: string;
  requestedPriority: Priority;
  status: "NEW";
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  createdAt: Date;
  updatedAt: Date;
  requester: { id: number; displayName: string; email: string };
  category: { id: number; name: string };
  relatedSystem: { id: number; name: string };
  attachments: [];
};

const requester = {
  id: 12,
  displayName: "Mali Chantarangsu",
  email: "mali@example.com",
};

const input: TicketCreateInput = {
  clientRequestId: "c5404d4c-0b9b-4c52-9f3a-24872db6996f",
  categoryId: 3,
  relatedSystemId: 8,
  summary: "External monitor flickers",
  requestedPriority: "HIGH",
  description: "The external monitor flickers after waking from sleep.",
};

function createFakePrisma(options: { categoryActive?: boolean; systemActive?: boolean } = {}) {
  const tickets: StoredTicket[] = [];
  const category = { id: 3, name: "Hardware" };
  const relatedSystem = { id: 8, name: "Office Workstation" };

  const ticketDelegate = {
    findUnique: async ({ where }: { where: { clientRequestId: string } }) =>
      tickets.find((ticket) => ticket.clientRequestId === where.clientRequestId) ??
      null,
    findFirst: async ({ where }: { where: { ticketNumber: { startsWith: string } } }) => {
      const matching = tickets
        .filter((ticket) =>
          ticket.ticketNumber.startsWith(where.ticketNumber.startsWith),
        )
        .sort((left, right) =>
          right.ticketNumber.localeCompare(left.ticketNumber),
        );
      return matching[0]
        ? { ticketNumber: matching[0].ticketNumber }
        : null;
    },
    create: async ({ data }: { data: Omit<StoredTicket, "id" | "updatedAt" | "requester" | "category" | "relatedSystem" | "attachments"> }) => {
      const stored: StoredTicket = {
        ...data,
        id: tickets.length + 1,
        updatedAt: data.createdAt,
        requester,
        category,
        relatedSystem,
        attachments: [],
      };
      tickets.push(stored);
      return stored;
    },
  };

  const transaction = {
    ticket: ticketDelegate,
    category: {
      findFirst: async () =>
        options.categoryActive === false ? null : { id: category.id },
    },
    relatedSystem: {
      findFirst: async () =>
        options.systemActive === false ? null : { id: relatedSystem.id },
    },
  };

  const prisma = {
    ticket: ticketDelegate,
    $transaction: async (operation: (client: typeof transaction) => unknown) =>
      operation(transaction),
  } as unknown as PrismaClient;

  return { prisma, tickets };
}

describe("Ticket creation service", () => {
  const now = () => new Date("2026-08-20T07:15:30.000Z");

  it("creates exactly one server-owned Ticket with its related response", async () => {
    const { prisma, tickets } = createFakePrisma();
    const result = await createTicket(prisma, requester, input, now);

    expect(result).toMatchObject({
      status: 201,
      replayed: false,
      ticket: {
        id: 1,
        ticketNumber: "TKT-2026-000001",
        status: "New",
        requestedPriority: "HIGH",
        activeAttachmentCount: 0,
        attachments: [],
        requester,
      },
    });
    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toMatchObject({
      requesterId: 12,
      status: "NEW",
      summary: input.summary,
    });
  });

  it("returns the unchanged original Ticket for an identical replay", async () => {
    const { prisma, tickets } = createFakePrisma();
    const first = await createTicket(prisma, requester, input, now);
    const replay = await createTicket(prisma, requester, input, () =>
      new Date("2026-08-21T08:00:00.000Z"),
    );

    expect(replay).toEqual({ ...first, status: 200, replayed: true });
    expect(tickets).toHaveLength(1);
  });

  it("rejects conflicting requester or normalized content without another row", async () => {
    const { prisma, tickets } = createFakePrisma();
    await createTicket(prisma, requester, input, now);

    await expect(
      createTicket(prisma, requester, { ...input, summary: "Changed summary" }, now),
    ).rejects.toMatchObject({
      status: 409,
      code: "DUPLICATE_REQUEST_CONFLICT",
    });
    await expect(
      createTicket(prisma, { ...requester, id: 13 }, input, now),
    ).rejects.toMatchObject({
      status: 409,
      code: "DUPLICATE_REQUEST_CONFLICT",
    });
    expect(tickets).toHaveLength(1);
  });

  it("rejects unavailable reference data before writing", async () => {
    const { prisma, tickets } = createFakePrisma({ categoryActive: false });
    try {
      await createTicket(prisma, requester, input, now);
      throw new Error("Expected invalid reference failure");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status: 400, code: "INVALID_REFERENCE" });
      expect((error as ApiError).details).toEqual([
        expect.objectContaining({ field: "categoryId" }),
      ]);
    }
    expect(tickets).toHaveLength(0);
  });

  it("allocates the next sequence within the same UTC year", async () => {
    const { prisma } = createFakePrisma();
    const first = await createTicket(prisma, requester, input, now);
    const second = await createTicket(
      prisma,
      requester,
      { ...input, clientRequestId: "8700c10b-5385-4dc1-a946-6515ca0013cb" },
      now,
    );
    expect(first.ticket.ticketNumber).toBe("TKT-2026-000001");
    expect(second.ticket.ticketNumber).toBe("TKT-2026-000002");
  });
});
