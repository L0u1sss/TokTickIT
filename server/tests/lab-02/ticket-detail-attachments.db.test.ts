import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const fixture = {
  requesterEmail: "issue17.detail@test.local",
  otherRequesterEmail: "issue17.detail-other@test.local",
  categoryName: "Issue 17 Hardware",
  systemName: "Issue 17 Workstation",
};

let requesterId: number;
let otherRequesterId: number;
let ticketId: number;
let limitTicketId: number;
let foreignTicketId: number;
let uploadedAttachmentId: number;
let storageDirectory = "";

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
  await prisma.ticket.deleteMany({ where: { id: { in: tickets.map(({ id }) => id) } } });
  await prisma.requesterUser.deleteMany({ where: { id: { in: requesterIds } } });
  await prisma.category.deleteMany({ where: { name: fixture.categoryName } });
  await prisma.relatedSystem.deleteMany({ where: { name: fixture.systemName } });
}

describe("Ticket Detail and attachment PostgreSQL integration", () => {
  beforeAll(async () => {
    const prisma = getPrisma();
    await removeFixture();
    storageDirectory = await mkdtemp(path.join(tmpdir(), "toktickit-issue17-"));
    process.env.ATTACHMENT_STORAGE_DIR = storageDirectory;

    const [requester, otherRequester, category, relatedSystem] = await prisma.$transaction([
      prisma.requesterUser.create({
        data: { displayName: "Issue 17 Requester", email: fixture.requesterEmail },
      }),
      prisma.requesterUser.create({
        data: { displayName: "Issue 17 Other", email: fixture.otherRequesterEmail },
      }),
      prisma.category.create({ data: { name: fixture.categoryName } }),
      prisma.relatedSystem.create({ data: { name: fixture.systemName } }),
    ]);
    requesterId = requester.id;
    otherRequesterId = otherRequester.id;

    const tickets = await prisma.$transaction([
      prisma.ticket.create({
        data: {
          ticketNumber: "TKT-2097-970001",
          clientRequestId: "17000000-0000-4000-8000-000000000001",
          summary: "Owned monitor detail",
          description: "Line one\nLine two stays intact.",
          requestedPriority: "HIGH",
          requesterId,
          categoryId: category.id,
          relatedSystemId: relatedSystem.id,
        },
      }),
      prisma.ticket.create({
        data: {
          ticketNumber: "TKT-2097-970002",
          clientRequestId: "17000000-0000-4000-8000-000000000002",
          summary: "Attachment limit fixture",
          description: "Own ticket with five active attachment rows.",
          requestedPriority: "MEDIUM",
          requesterId,
          categoryId: category.id,
          relatedSystemId: relatedSystem.id,
        },
      }),
      prisma.ticket.create({
        data: {
          ticketNumber: "TKT-2097-970003",
          clientRequestId: "17000000-0000-4000-8000-000000000003",
          summary: "Foreign protected detail",
          description: "Must never be disclosed to the first requester.",
          requestedPriority: "LOW",
          requesterId: otherRequester.id,
          categoryId: category.id,
          relatedSystemId: relatedSystem.id,
        },
      }),
    ]);
    [ticketId, limitTicketId, foreignTicketId] = tickets.map(({ id }) => id);

    await prisma.attachment.createMany({
      data: Array.from({ length: 5 }, (_, index) => ({
        ticketId: limitTicketId,
        originalName: `limit-${index + 1}.pdf`,
        storageKey: `17000000-0000-4000-8000-00000000000${index + 4}`,
        mimeType: "application/pdf",
        sizeBytes: 1,
        uploadedByRequesterId: requesterId,
      })),
    });
  });

  afterAll(async () => {
    await removeFixture();
    delete process.env.ATTACHMENT_STORAGE_DIR;
    if (storageDirectory) await rm(storageDirectory, { recursive: true, force: true });
  });

  it("returns only the complete owned detail and attachment metadata", async () => {
    const response = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set("x-requester-id", String(requesterId));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: ticketId,
      ticketNumber: "TKT-2097-970001",
      summary: "Owned monitor detail",
      description: "Line one\nLine two stays intact.",
      requestedPriority: "HIGH",
      status: "New",
      requester: { id: requesterId, displayName: "Issue 17 Requester" },
      category: { name: fixture.categoryName },
      relatedSystem: { name: fixture.systemName },
      activeAttachmentCount: 0,
      attachments: [],
    });
    expect(response.text).not.toContain("clientRequestId");
    expect(response.text).not.toContain("storageKey");
  });

  it("stores private bytes and serves an active attachment through the owned route", async () => {
    const bytes = Buffer.from("issue-17-private-pdf");
    const upload = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set("x-requester-id", String(requesterId))
      .attach("file", bytes, { filename: "diagnostic-report.pdf", contentType: "application/pdf" });

    expect(upload.status).toBe(201);
    expect(upload.body).toMatchObject({
      fileName: "diagnostic-report.pdf",
      mediaType: "application/pdf",
      sizeBytes: bytes.length,
      isRemoved: false,
      downloadable: true,
    });
    uploadedAttachmentId = upload.body.id;

    const stored = await getPrisma().attachment.findUniqueOrThrow({
      where: { id: uploadedAttachmentId },
    });
    expect(stored).toMatchObject({
      ticketId,
      originalName: "diagnostic-report.pdf",
      uploadedByRequesterId: requesterId,
      removedAt: null,
    });
    expect(stored.storageKey).not.toContain(stored.originalName);
    expect(await readFile(path.join(storageDirectory, stored.storageKey))).toEqual(bytes);

    const download = await request(app)
      .get(`/api/tickets/${ticketId}/attachments/${uploadedAttachmentId}/download`)
      .set("x-requester-id", String(requesterId));
    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toBe("application/pdf");
    expect(download.headers["content-disposition"]).toContain('filename="diagnostic-report.pdf"');
    expect(download.body).toEqual(bytes);
  });

  it("enforces requester ownership and the five-active-attachment limit", async () => {
    const forbiddenDetail = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set("x-requester-id", String(otherRequesterId));
    expect(forbiddenDetail.status).toBe(403);
    expect(forbiddenDetail.text).not.toContain("Owned monitor detail");
    expect(forbiddenDetail.text).not.toContain("diagnostic-report.pdf");

    const forbiddenDownload = await request(app)
      .get(`/api/tickets/${ticketId}/attachments/${uploadedAttachmentId}/download`)
      .set("x-requester-id", String(otherRequesterId));
    expect(forbiddenDownload.status).toBe(403);
    expect(forbiddenDownload.body.error.code).toBe("TICKET_FORBIDDEN");

    const rejectedSixth = await request(app)
      .post(`/api/tickets/${limitTicketId}/attachments`)
      .set("x-requester-id", String(requesterId))
      .attach("file", Buffer.from("x"), { filename: "sixth.png", contentType: "image/png" });
    expect(rejectedSixth.status).toBe(400);
    expect(rejectedSixth.body.error.code).toBe("ATTACHMENT_LIMIT_REACHED");
    expect(await getPrisma().attachment.count({
      where: { ticketId: limitTicketId, removedAt: null },
    })).toBe(5);

    const wrongParentAttachment = await request(app)
      .get(`/api/tickets/${ticketId}/attachments/${(
        await getPrisma().attachment.findFirstOrThrow({ where: { ticketId: limitTicketId } })
      ).id}/download`)
      .set("x-requester-id", String(requesterId));
    expect(wrongParentAttachment.status).toBe(404);
    expect(wrongParentAttachment.body.error.code).toBe("ATTACHMENT_NOT_FOUND");

    const forbiddenUpload = await request(app)
      .post(`/api/tickets/${foreignTicketId}/attachments`)
      .set("x-requester-id", String(requesterId))
      .attach("file", Buffer.from("private"), { filename: "foreign.pdf", contentType: "application/pdf" });
    expect(forbiddenUpload.status).toBe(403);
    expect(await getPrisma().attachment.count({ where: { ticketId: foreignTicketId } })).toBe(0);
  });

  it("soft-removes once with audit fields and blocks all later active operations", async () => {
    const invalid = await request(app)
      .patch(`/api/tickets/${ticketId}/attachments/${uploadedAttachmentId}/remove`)
      .set("x-requester-id", String(requesterId))
      .send({ reason: "no" });
    expect(invalid.status).toBe(400);
    expect((await getPrisma().attachment.findUniqueOrThrow({
      where: { id: uploadedAttachmentId },
    })).removedAt).toBeNull();

    const reason = "Uploaded a clearer diagnostic report.";
    const removed = await request(app)
      .patch(`/api/tickets/${ticketId}/attachments/${uploadedAttachmentId}/remove`)
      .set("x-requester-id", String(requesterId))
      .send({ reason: `  ${reason}  ` });
    expect(removed.status).toBe(200);
    expect(removed.body).toMatchObject({
      id: uploadedAttachmentId,
      isRemoved: true,
      removalReason: reason,
      downloadable: false,
    });
    expect(removed.body.removedAt).toEqual(expect.any(String));

    const stored = await getPrisma().attachment.findUniqueOrThrow({
      where: { id: uploadedAttachmentId },
    });
    expect(stored).toMatchObject({
      removalReason: reason,
      removedByRequesterId: requesterId,
    });
    expect(stored.removedAt).not.toBeNull();

    const detail = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set("x-requester-id", String(requesterId));
    expect(detail.body.activeAttachmentCount).toBe(0);
    expect(detail.body.attachments).toEqual([
      expect.objectContaining({
        id: uploadedAttachmentId,
        isRemoved: true,
        removalReason: reason,
        downloadable: false,
      }),
    ]);
    expect(detail.text).not.toContain("storageKey");

    const download = await request(app)
      .get(`/api/tickets/${ticketId}/attachments/${uploadedAttachmentId}/download`)
      .set("x-requester-id", String(requesterId));
    expect(download.status).toBe(404);
    expect(download.body.error.code).toBe("ATTACHMENT_NOT_AVAILABLE");

    const repeatedRemoval = await request(app)
      .patch(`/api/tickets/${ticketId}/attachments/${uploadedAttachmentId}/remove`)
      .set("x-requester-id", String(requesterId))
      .send({ reason: "Attempt to overwrite the original audit reason." });
    expect(repeatedRemoval.status).toBe(404);
    const unchanged = await getPrisma().attachment.findUniqueOrThrow({
      where: { id: uploadedAttachmentId },
    });
    expect(unchanged.removalReason).toBe(reason);
    expect(unchanged.removedAt).toEqual(stored.removedAt);
  });
});
