import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../src/errors.js";

const mocks = vi.hoisted(() => ({
  requesterFindFirst: vi.fn(),
  requireOwnedTicket: vi.fn(),
  uploadOwnedAttachment: vi.fn(),
  downloadOwnedAttachment: vi.fn(),
  removeOwnedAttachment: vi.fn(),
}));

vi.mock("../../src/prisma.js", () => ({
  getPrisma: () => ({ requesterUser: { findFirst: mocks.requesterFindFirst } }),
}));
vi.mock("../../src/attachment-service.js", () => ({
  requireOwnedTicket: mocks.requireOwnedTicket,
  uploadOwnedAttachment: mocks.uploadOwnedAttachment,
  downloadOwnedAttachment: mocks.downloadOwnedAttachment,
  removeOwnedAttachment: mocks.removeOwnedAttachment,
}));

import { app } from "../../src/app.js";

const requester = { id: 12, displayName: "Mali", email: "mali@example.com" };
const attachment = {
  id: 51,
  fileName: "proof.png",
  mediaType: "image/png",
  sizeBytes: 3,
  uploadedAt: "2026-08-20T07:16:00.000Z",
  isRemoved: false,
  removedAt: null,
  removalReason: null,
  downloadable: true,
};

describe("Attachment HTTP lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requesterFindFirst.mockResolvedValue(requester);
    mocks.requireOwnedTicket.mockResolvedValue({ id: 145, requesterId: 12 });
    mocks.uploadOwnedAttachment.mockResolvedValue(attachment);
    mocks.downloadOwnedAttachment.mockResolvedValue({
      fileName: "proof.png",
      mediaType: "image/png",
      sizeBytes: 3,
      bytes: Buffer.from("png"),
    });
    mocks.removeOwnedAttachment.mockResolvedValue({
      ...attachment,
      isRemoved: true,
      removedAt: "2026-08-20T08:00:00.000Z",
      removalReason: "Uploaded a clearer image.",
      downloadable: false,
    });
  });

  it("uploads exactly one owned multipart file", async () => {
    const response = await request(app)
      .post("/api/tickets/145/attachments")
      .set("x-requester-id", "12")
      .attach("file", Buffer.from("png"), { filename: "proof.png", contentType: "image/png" });
    expect(response.status).toBe(201);
    expect(response.body).toEqual(attachment);
    expect(mocks.uploadOwnedAttachment).toHaveBeenCalledWith(
      expect.anything(),
      requester,
      145,
      expect.objectContaining({ originalname: "proof.png", mimetype: "image/png" }),
    );
  });

  it("accepts the exact 5 MiB multipart boundary", async () => {
    const response = await request(app)
      .post("/api/tickets/145/attachments")
      .set("x-requester-id", "12")
      .attach("file", Buffer.alloc(5_242_880), {
        filename: "boundary.pdf",
        contentType: "application/pdf",
      });
    expect(response.status).toBe(201);
    expect(mocks.uploadOwnedAttachment).toHaveBeenCalledWith(
      expect.anything(),
      requester,
      145,
      expect.objectContaining({ size: 5_242_880 }),
    );
  });

  it("preserves a Unicode display filename through multipart parsing", async () => {
    const response = await request(app)
      .post("/api/tickets/145/attachments")
      .set("x-requester-id", "12")
      .attach("file", Buffer.from("pdf"), {
        filename: "หลักฐาน.pdf",
        contentType: "application/pdf",
      });
    expect(response.status).toBe(201);
    expect(mocks.uploadOwnedAttachment).toHaveBeenCalledWith(
      expect.anything(),
      requester,
      145,
      expect.objectContaining({ originalname: "หลักฐาน.pdf" }),
    );
  });

  it("rejects missing, unexpected, multiple, and oversized file parts safely", async () => {
    await request(app)
      .post("/api/tickets/145/attachments")
      .set("x-requester-id", "12")
      .send({})
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("INVALID_MULTIPART"));
    await request(app)
      .post("/api/tickets/145/attachments")
      .set("x-requester-id", "12")
      .field("note", "not allowed")
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("INVALID_MULTIPART"));
    await request(app)
      .post("/api/tickets/145/attachments")
      .set("x-requester-id", "12")
      .attach("other", Buffer.from("x"), "other.png")
      .expect(400);
    await request(app)
      .post("/api/tickets/145/attachments")
      .set("x-requester-id", "12")
      .attach("file", Buffer.alloc(5_242_881), { filename: "large.pdf", contentType: "application/pdf" })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("ATTACHMENT_SIZE_INVALID"));
    expect(mocks.uploadOwnedAttachment).not.toHaveBeenCalled();
  });

  it("downloads bytes with safe content headers", async () => {
    const response = await request(app)
      .get("/api/tickets/145/attachments/51/download")
      .set("x-requester-id", "12");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("image/png");
    expect(response.headers["content-length"]).toBe("3");
    expect(response.headers["content-disposition"]).toContain('filename="proof.png"');
    expect(response.body).toEqual(Buffer.from("png"));
  });

  it("validates and soft-removes with the trimmed reason", async () => {
    const response = await request(app)
      .patch("/api/tickets/145/attachments/51/remove")
      .set("x-requester-id", "12")
      .send({ reason: "  Uploaded a clearer image.  " });
    expect(response.status).toBe(200);
    expect(mocks.removeOwnedAttachment).toHaveBeenCalledWith(
      expect.anything(), requester, 145, 51, "Uploaded a clearer image.",
    );
    expect(response.body.downloadable).toBe(false);
  });

  it("rejects malformed and invalid removal bodies before mutation", async () => {
    const invalidBodies = [
      {},
      { reason: "four" },
      { reason: "Valid reason", extra: true },
    ];
    for (const body of invalidBodies) {
      const response = await request(app)
        .patch("/api/tickets/145/attachments/51/remove")
        .set("x-requester-id", "12")
        .send(body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }
    const malformed = await request(app)
      .patch("/api/tickets/145/attachments/51/remove")
      .set("x-requester-id", "12")
      .set("content-type", "application/json")
      .send("{");
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe("INVALID_JSON");
    expect(mocks.removeOwnedAttachment).not.toHaveBeenCalled();
  });

  it("validates ticket and attachment path parameters", async () => {
    const badUpload = await request(app)
      .post("/api/tickets/not-an-id/attachments")
      .set("x-requester-id", "12")
      .attach("file", Buffer.from("png"), { filename: "proof.png", contentType: "image/png" });
    expect(badUpload.status).toBe(400);
    expect(badUpload.body.error.code).toBe("INVALID_PATH_PARAMETER");

    const badDownload = await request(app)
      .get("/api/tickets/145/attachments/0/download")
      .set("x-requester-id", "12");
    expect(badDownload.status).toBe(400);
    expect(badDownload.body.error).toMatchObject({
      code: "INVALID_PATH_PARAMETER",
      details: [expect.objectContaining({ field: "attId" })],
    });

    const badRemove = await request(app)
      .patch("/api/tickets/145/attachments/1.5/remove")
      .set("x-requester-id", "12")
      .send({ reason: "No longer required." });
    expect(badRemove.status).toBe(400);
    expect(badRemove.body.error.code).toBe("INVALID_PATH_PARAMETER");
    expect(mocks.uploadOwnedAttachment).not.toHaveBeenCalled();
    expect(mocks.downloadOwnedAttachment).not.toHaveBeenCalled();
    expect(mocks.removeOwnedAttachment).not.toHaveBeenCalled();
  });

  it("checks a foreign parent before accepting upload bytes", async () => {
    mocks.requireOwnedTicket.mockRejectedValue(
      new ApiError(403, "TICKET_FORBIDDEN", "You do not have access to this ticket."),
    );
    const response = await request(app)
      .post("/api/tickets/145/attachments")
      .set("x-requester-id", "12")
      .attach("file", Buffer.from("secret"), { filename: "proof.png", contentType: "image/png" });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("TICKET_FORBIDDEN");
    expect(mocks.uploadOwnedAttachment).not.toHaveBeenCalled();
  });

  it("checks a foreign parent before validating a removal body", async () => {
    mocks.requireOwnedTicket.mockRejectedValue(
      new ApiError(403, "TICKET_FORBIDDEN", "You do not have access to this ticket."),
    );
    const response = await request(app)
      .patch("/api/tickets/145/attachments/51/remove")
      .set("x-requester-id", "12")
      .send({ reason: "no" });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("TICKET_FORBIDDEN");
    expect(mocks.removeOwnedAttachment).not.toHaveBeenCalled();
  });

  it("returns the safe error envelope for unexpected lifecycle failures", async () => {
    mocks.uploadOwnedAttachment.mockRejectedValueOnce(new Error("storage path C:/secret"));
    const uploadResponse = await request(app)
      .post("/api/tickets/145/attachments")
      .set("x-requester-id", "12")
      .attach("file", Buffer.from("png"), { filename: "proof.png", contentType: "image/png" });
    expect(uploadResponse.status).toBe(500);
    expect(uploadResponse.body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "The request could not be completed." },
    });
    expect(uploadResponse.text).not.toContain("C:/secret");

    mocks.downloadOwnedAttachment.mockRejectedValueOnce(new Error("opaque-storage-key"));
    const downloadResponse = await request(app)
      .get("/api/tickets/145/attachments/51/download")
      .set("x-requester-id", "12");
    expect(downloadResponse.status).toBe(500);
    expect(downloadResponse.body.error.code).toBe("INTERNAL_ERROR");
    expect(downloadResponse.text).not.toContain("opaque-storage-key");

    mocks.removeOwnedAttachment.mockRejectedValueOnce(new Error("database detail"));
    const removeResponse = await request(app)
      .patch("/api/tickets/145/attachments/51/remove")
      .set("x-requester-id", "12")
      .send({ reason: "Uploaded a clearer image." });
    expect(removeResponse.status).toBe(500);
    expect(removeResponse.body.error.code).toBe("INTERNAL_ERROR");
    expect(removeResponse.text).not.toContain("database detail");
  });
});
