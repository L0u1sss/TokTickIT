import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const fixture = {
  requesterEmail: "issue15.create-ticket@test.local",
  categoryName: "Issue 15 Test Category",
  systemName: "Issue 15 Test System",
};

let requesterId: number;
let categoryId: number;
let relatedSystemId: number;

async function removeFixture() {
  const prisma = getPrisma();
  const requester = await prisma.requesterUser.findUnique({
    where: { email: fixture.requesterEmail },
    select: { id: true },
  });
  if (requester) {
    await prisma.ticket.deleteMany({ where: { requesterId: requester.id } });
  }
  await prisma.requesterUser.deleteMany({
    where: { email: fixture.requesterEmail },
  });
  await prisma.category.deleteMany({ where: { name: fixture.categoryName } });
  await prisma.relatedSystem.deleteMany({ where: { name: fixture.systemName } });
}

describe("Create Ticket PostgreSQL integration", () => {
  beforeAll(async () => {
    const prisma = getPrisma();
    await removeFixture();
    const [requester, category, relatedSystem] = await prisma.$transaction([
      prisma.requesterUser.create({
        data: {
          displayName: "Issue 15 Requester",
          email: fixture.requesterEmail,
          isActive: true,
        },
      }),
      prisma.category.create({
        data: { name: fixture.categoryName, isActive: true },
      }),
      prisma.relatedSystem.create({
        data: { name: fixture.systemName, isActive: true },
      }),
    ]);
    requesterId = requester.id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
  });

  afterAll(async () => {
    await removeFixture();
  });

  const body = () => ({
    clientRequestId: "1469ed6d-33fa-4a7f-8a93-bb33473539fa",
    categoryId,
    relatedSystemId,
    summary: "  Database-backed creation  ",
    requestedPriority: "MEDIUM",
    description: "  This Ticket verifies the real PostgreSQL transaction.  ",
  });

  it("persists one requester-owned Ticket with authoritative fields", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("x-requester-id", String(requesterId))
      .send(body());

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe(`/api/tickets/${response.body.ticket.id}`);
    expect(response.body).toMatchObject({
      replayed: false,
      ticket: {
        ticketNumber: expect.stringMatching(/^TKT-[0-9]{4}-[0-9]{6}$/),
        summary: "Database-backed creation",
        description: "This Ticket verifies the real PostgreSQL transaction.",
        requestedPriority: "MEDIUM",
        status: "New",
        requester: { id: requesterId },
        category: { id: categoryId, name: fixture.categoryName },
        relatedSystem: { id: relatedSystemId, name: fixture.systemName },
        activeAttachmentCount: 0,
        attachments: [],
      },
    });

    const stored = await getPrisma().ticket.findUnique({
      where: { clientRequestId: body().clientRequestId },
    });
    expect(stored).toMatchObject({
      requesterId,
      categoryId,
      relatedSystemId,
      summary: "Database-backed creation",
      requestedPriority: "MEDIUM",
      status: "NEW",
    });
  });

  it("replays the original Ticket and rejects conflicting key reuse", async () => {
    const original = await getPrisma().ticket.findUniqueOrThrow({
      where: { clientRequestId: body().clientRequestId },
    });
    const replay = await request(app)
      .post("/api/tickets")
      .set("x-requester-id", String(requesterId))
      .send(body());
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({
      replayed: true,
      ticket: { id: original.id, ticketNumber: original.ticketNumber },
    });

    const conflict = await request(app)
      .post("/api/tickets")
      .set("x-requester-id", String(requesterId))
      .send({ ...body(), summary: "Different logical payload" });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("DUPLICATE_REQUEST_CONFLICT");
    expect(conflict.text).not.toContain(original.ticketNumber);
    expect(
      await getPrisma().ticket.count({ where: { requesterId } }),
    ).toBe(1);
  });

  it("rejects inactive reference data without a partial Ticket", async () => {
    await getPrisma().category.update({
      where: { id: categoryId },
      data: { isActive: false },
    });
    const response = await request(app)
      .post("/api/tickets")
      .set("x-requester-id", String(requesterId))
      .send({
        ...body(),
        clientRequestId: "869769e9-266d-4cf2-9e40-23276d9672e0",
      });
    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: "INVALID_REFERENCE",
      details: [expect.objectContaining({ field: "categoryId" })],
    });
    expect(
      await getPrisma().ticket.count({ where: { requesterId } }),
    ).toBe(1);
    await getPrisma().category.update({
      where: { id: categoryId },
      data: { isActive: true },
    });
  });

  it("allocates the next six-digit sequence for another logical request", async () => {
    const first = await getPrisma().ticket.findUniqueOrThrow({
      where: { clientRequestId: body().clientRequestId },
    });
    const response = await request(app)
      .post("/api/tickets")
      .set("x-requester-id", String(requesterId))
      .send({
        ...body(),
        clientRequestId: "6e354095-a37c-4f83-ab94-626d746fbdb1",
        summary: "Second database-backed Ticket",
      });
    expect(response.status).toBe(201);
    const firstSequence = Number(first.ticketNumber.slice(-6));
    const secondSequence = Number(response.body.ticket.ticketNumber.slice(-6));
    expect(secondSequence).toBe(firstSequence + 1);
    expect(
      await getPrisma().ticket.count({ where: { requesterId } }),
    ).toBe(2);
  });
});
