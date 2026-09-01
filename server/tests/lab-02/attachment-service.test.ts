import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  downloadOwnedAttachment,
  removeOwnedAttachment,
  uploadOwnedAttachment,
  type AttachmentStorage,
} from "../../src/attachment-service.js";

const requester = { id: 12, displayName: "Mali", email: "mali@example.com" };
const activeRow = {
  id: 51,
  ticketId: 145,
  originalName: "proof.png",
  storageKey: "opaque-key",
  mimeType: "image/png",
  sizeBytes: 3,
  uploadedByRequesterId: 12,
  createdAt: new Date("2026-08-20T07:16:00.000Z"),
  removedAt: null,
  removalReason: null,
  removedByRequesterId: null,
};

const ticketFindUnique = vi.fn();
const attachmentCount = vi.fn();
const attachmentCreate = vi.fn();
const attachmentFindFirst = vi.fn();
const attachmentUpdate = vi.fn();
const prisma = {
  ticket: { findUnique: ticketFindUnique },
  attachment: {
    count: attachmentCount,
    create: attachmentCreate,
    findFirst: attachmentFindFirst,
    update: attachmentUpdate,
  },
} as unknown as PrismaClient;
const storage: AttachmentStorage = {
  write: vi.fn(),
  read: vi.fn(),
  delete: vi.fn(),
};

function uploadFile(): Express.Multer.File {
  return {
    fieldname: "file",
    originalname: "proof.png",
    encoding: "7bit",
    mimetype: "image/png",
    size: 3,
    buffer: Buffer.from("png"),
    destination: "",
    filename: "",
    path: "",
    stream: null as never,
  };
}

describe("Attachment service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ticketFindUnique.mockResolvedValue({ id: 145, requesterId: 12 });
    attachmentCount.mockResolvedValue(0);
    vi.mocked(storage.write).mockResolvedValue("opaque-key");
    vi.mocked(storage.delete).mockResolvedValue(undefined);
    attachmentCreate.mockResolvedValue(activeRow);
    attachmentFindFirst.mockResolvedValue(activeRow);
    attachmentUpdate.mockImplementation(({ data }) => ({ ...activeRow, ...data }));
    vi.mocked(storage.read).mockResolvedValue(Buffer.from("png"));
  });

  it("stores one validated owned attachment and returns public metadata", async () => {
    const result = await uploadOwnedAttachment(prisma, requester, 145, uploadFile(), storage);
    expect(storage.write).toHaveBeenCalledWith(Buffer.from("png"));
    expect(attachmentCreate).toHaveBeenCalledWith({
      data: {
        ticketId: 145,
        originalName: "proof.png",
        storageKey: "opaque-key",
        mimeType: "image/png",
        sizeBytes: 3,
        uploadedByRequesterId: 12,
      },
    });
    expect(result).toMatchObject({
      id: 51,
      fileName: "proof.png",
      mediaType: "image/png",
      isRemoved: false,
      downloadable: true,
    });
    expect(result).not.toHaveProperty("storageKey");
  });

  it("rejects the sixth active file before writing bytes", async () => {
    attachmentCount.mockResolvedValue(5);
    await expect(
      uploadOwnedAttachment(prisma, requester, 145, uploadFile(), storage),
    ).rejects.toMatchObject({ status: 400, code: "ATTACHMENT_LIMIT_REACHED" });
    expect(storage.write).not.toHaveBeenCalled();
    expect(attachmentCreate).not.toHaveBeenCalled();
  });

  it("cleans up stored bytes when metadata persistence fails", async () => {
    attachmentCreate.mockRejectedValue(new Error("database unavailable"));
    await expect(
      uploadOwnedAttachment(prisma, requester, 145, uploadFile(), storage),
    ).rejects.toThrow("database unavailable");
    expect(storage.delete).toHaveBeenCalledWith("opaque-key");
  });

  it("downloads only an active nested attachment after parent ownership", async () => {
    const result = await downloadOwnedAttachment(prisma, requester, 145, 51, storage);
    expect(result).toMatchObject({ fileName: "proof.png", mediaType: "image/png" });
    expect(result.bytes).toEqual(Buffer.from("png"));
    attachmentFindFirst.mockResolvedValue({ ...activeRow, removedAt: new Date() });
    await expect(
      downloadOwnedAttachment(prisma, requester, 145, 51, storage),
    ).rejects.toMatchObject({ status: 404, code: "ATTACHMENT_NOT_AVAILABLE" });
    expect(storage.read).toHaveBeenCalledTimes(1);
  });

  it("soft-removes atomically with the requester audit actor and preserves metadata", async () => {
    const result = await removeOwnedAttachment(
      prisma,
      requester,
      145,
      51,
      "Uploaded a clearer image.",
    );
    expect(attachmentUpdate).toHaveBeenCalledWith({
      where: { id: 51 },
      data: {
        removedAt: expect.any(Date),
        removalReason: "Uploaded a clearer image.",
        removedByRequesterId: 12,
      },
    });
    expect(result).toMatchObject({
      fileName: "proof.png",
      isRemoved: true,
      removalReason: "Uploaded a clearer image.",
      downloadable: false,
    });
  });

  it("uses 403 for a foreign parent and 404 for missing/wrong-ticket children", async () => {
    ticketFindUnique.mockResolvedValueOnce({ id: 145, requesterId: 27 });
    await expect(
      downloadOwnedAttachment(prisma, requester, 145, 51, storage),
    ).rejects.toMatchObject({ status: 403, code: "TICKET_FORBIDDEN" });
    attachmentFindFirst.mockResolvedValueOnce(null);
    await expect(
      removeOwnedAttachment(prisma, requester, 145, 99, "No longer required."),
    ).rejects.toMatchObject({ status: 404, code: "ATTACHMENT_NOT_FOUND" });
  });
});
