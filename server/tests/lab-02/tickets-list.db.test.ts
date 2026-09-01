import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const fixture = {
  requesterEmail: "issue16.ticket-list@test.local",
  otherRequesterEmail: "issue16.ticket-list-other@test.local",
  categoryName: "Issue 16 Hardware",
  otherCategoryName: "Issue 16 Network",
  systemName: "Issue 16 Workstation",
  otherSystemName: "Issue 16 VPN",
};

let requesterId: number;
let categoryId: number;
let relatedSystemId: number;

async function removeFixture() {
  const prisma = getPrisma();
  const requesters = await prisma.requesterUser.findMany({
    where: { email: { in: [fixture.requesterEmail, fixture.otherRequesterEmail] } },
    select: { id: true },
  });
  const requesterIds = requesters.map(({ id }) => id);
  const tickets = await prisma.ticket.findMany({
    where: { requesterId: { in: requesterIds } },
    select: { id: true },
  });
  await prisma.attachment.deleteMany({
    where: { ticketId: { in: tickets.map(({ id }) => id) } },
  });
  await prisma.ticket.deleteMany({ where: { requesterId: { in: requesterIds } } });
  await prisma.requesterUser.deleteMany({ where: { id: { in: requesterIds } } });
  await prisma.category.deleteMany({
    where: { name: { in: [fixture.categoryName, fixture.otherCategoryName] } },
  });
  await prisma.relatedSystem.deleteMany({
    where: { name: { in: [fixture.systemName, fixture.otherSystemName] } },
  });
}

describe("My Tickets PostgreSQL integration", () => {
  beforeAll(async () => {
    const prisma = getPrisma();
    await removeFixture();
    const [requester, otherRequester, category, otherCategory, system, otherSystem] =
      await prisma.$transaction([
        prisma.requesterUser.create({
          data: {
            displayName: "Issue 16 Requester",
            email: fixture.requesterEmail,
          },
        }),
        prisma.requesterUser.create({
          data: {
            displayName: "Issue 16 Other Requester",
            email: fixture.otherRequesterEmail,
          },
        }),
        prisma.category.create({ data: { name: fixture.categoryName } }),
        prisma.category.create({ data: { name: fixture.otherCategoryName } }),
        prisma.relatedSystem.create({ data: { name: fixture.systemName } }),
        prisma.relatedSystem.create({ data: { name: fixture.otherSystemName } }),
      ]);
    requesterId = requester.id;
    categoryId = category.id;
    relatedSystemId = system.id;
    const tieDate = new Date("2026-08-28T10:00:00.000Z");
    const newestDate = new Date("2026-08-29T10:00:00.000Z");
    const [first, second] = await prisma.$transaction([
      prisma.ticket.create({
        data: {
          ticketNumber: "TKT-2099-900001",
          clientRequestId: "16000000-0000-4000-8000-000000000001",
          summary: "Alpha printer issue",
          description: "First owned fixture ticket.",
          requestedPriority: "HIGH",
          requesterId: requester.id,
          categoryId: category.id,
          relatedSystemId: system.id,
          createdAt: tieDate,
          updatedAt: tieDate,
        },
      }),
      prisma.ticket.create({
        data: {
          ticketNumber: "TKT-2099-900002",
          clientRequestId: "16000000-0000-4000-8000-000000000002",
          summary: "Monitor issue",
          description: "Second owned fixture ticket.",
          requestedPriority: "HIGH",
          requesterId: requester.id,
          categoryId: category.id,
          relatedSystemId: system.id,
          createdAt: tieDate,
          updatedAt: tieDate,
        },
      }),
      prisma.ticket.create({
        data: {
          ticketNumber: "TKT-2099-900003",
          clientRequestId: "16000000-0000-4000-8000-000000000003",
          summary: "VPN access",
          description: "Newest owned fixture ticket.",
          requestedPriority: "LOW",
          requesterId: requester.id,
          categoryId: otherCategory.id,
          relatedSystemId: otherSystem.id,
          createdAt: newestDate,
          updatedAt: newestDate,
        },
      }),
      prisma.ticket.create({
        data: {
          ticketNumber: "TKT-2099-900004",
          clientRequestId: "16000000-0000-4000-8000-000000000004",
          summary: "Monitor issue owned by someone else",
          description: "Must never cross the requester boundary.",
          requestedPriority: "HIGH",
          requesterId: otherRequester.id,
          categoryId: category.id,
          relatedSystemId: system.id,
          createdAt: newestDate,
          updatedAt: newestDate,
        },
      }),
    ]);
    await prisma.attachment.createMany({
      data: [
        {
          ticketId: second.id,
          originalName: "active.pdf",
          storageKey: `issue16/${second.id}/active.pdf`,
          sizeBytes: 10,
          mimeType: "application/pdf",
          uploadedByRequesterId: requester.id,
        },
        {
          ticketId: second.id,
          originalName: "removed.png",
          storageKey: `issue16/${second.id}/removed.png`,
          sizeBytes: 12,
          mimeType: "image/png",
          uploadedByRequesterId: requester.id,
          removedAt: newestDate,
          removalReason: "Duplicate fixture",
          removedByRequesterId: requester.id,
        },
      ],
    });
    expect(first.id).toBeLessThan(second.id);
  });

  afterAll(removeFixture);

  it("scopes before pagination and applies the stable default ordering", async () => {
    const firstPage = await request(app)
      .get("/api/tickets?page=1&pageSize=10&sortBy=createdAt&sortOrder=desc")
      .set("x-requester-id", String(requesterId));

    expect(firstPage.status).toBe(200);
    expect(firstPage.body.pagination).toEqual({
      page: 1,
      pageSize: 10,
      totalItems: 3,
      totalPages: 1,
    });
    expect(firstPage.body.items.map((ticket: { ticketNumber: string }) => ticket.ticketNumber))
      .toEqual(["TKT-2099-900003", "TKT-2099-900002", "TKT-2099-900001"]);
    expect(firstPage.text).not.toContain("TKT-2099-900004");
    expect(firstPage.text).not.toContain("description");
    expect(firstPage.text).not.toContain("clientRequestId");
    expect(firstPage.body.items[1]).toMatchObject({
      summary: "Monitor issue",
      status: "New",
      activeAttachmentCount: 1,
    });
  });

  it("combines case-insensitive search and all supported filters", async () => {
    const response = await request(app)
      .get(
        `/api/tickets?search=MONITOR&status=New&requestedPriority=HIGH&categoryId=${categoryId}&relatedSystemId=${relatedSystemId}&sortBy=summary&sortOrder=asc&page=1&pageSize=20`,
      )
      .set("x-requester-id", String(requesterId));

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      ticketNumber: "TKT-2099-900002",
      summary: "Monitor issue",
      requestedPriority: "HIGH",
      category: { id: categoryId, name: fixture.categoryName },
      relatedSystem: { id: relatedSystemId, name: fixture.systemName },
    });
    expect(response.body.filters).toEqual({
      search: "MONITOR",
      status: "New",
      requestedPriority: "HIGH",
      categoryId,
      relatedSystemId,
    });
  });

  it("returns an empty page beyond the last page with accurate totals", async () => {
    const response = await request(app)
      .get("/api/tickets?page=9&pageSize=10")
      .set("x-requester-id", String(requesterId));

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(response.body.pagination).toEqual({
      page: 9,
      pageSize: 10,
      totalItems: 3,
      totalPages: 1,
    });
  });
});
