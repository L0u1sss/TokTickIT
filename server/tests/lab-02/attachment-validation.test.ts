import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_MAX_BYTES,
  parseRemovalReason,
  validateAttachmentFile,
} from "../../src/attachment-contract.js";

function file(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: "file",
    originalname: "evidence.png",
    encoding: "7bit",
    mimetype: "image/png",
    size: 1,
    buffer: Buffer.from([1]),
    destination: "",
    filename: "",
    path: "",
    stream: null as never,
    ...overrides,
  };
}

describe("Attachment contract", () => {
  it.each([
    ["photo.jpg", "image/jpeg"],
    ["photo.JPEG", "image/jpeg"],
    ["screen.png", "image/png"],
    ["recording.webp", "image/webp"],
    ["report.pdf", "application/pdf"],
  ])("accepts the documented extension/MIME pair %s", (originalname, mimetype) => {
    expect(validateAttachmentFile(file({ originalname, mimetype }))).toMatchObject({
      originalName: originalname,
      mimeType: mimetype,
    });
  });

  it("accepts exactly 5 MiB and rejects empty or one-byte-over files", () => {
    expect(
      validateAttachmentFile(
        file({ size: ATTACHMENT_MAX_BYTES, buffer: Buffer.alloc(ATTACHMENT_MAX_BYTES) }),
      ).sizeBytes,
    ).toBe(5_242_880);
    expect(() => validateAttachmentFile(file({ size: 0, buffer: Buffer.alloc(0) }))).toThrowError(
      expect.objectContaining({ code: "ATTACHMENT_SIZE_INVALID" }),
    );
    expect(() =>
      validateAttachmentFile(
        file({
          size: ATTACHMENT_MAX_BYTES + 1,
          buffer: Buffer.alloc(ATTACHMENT_MAX_BYTES + 1),
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: "ATTACHMENT_SIZE_INVALID" }));
  });

  it("uses a safe basename and rejects unsupported or unsafe filenames", () => {
    expect(
      validateAttachmentFile(file({ originalname: "C:\\fakepath\\proof.png" })).originalName,
    ).toBe("proof.png");
    expect(() =>
      validateAttachmentFile(file({ originalname: "proof.png", mimetype: "application/pdf" })),
    ).toThrowError(expect.objectContaining({ code: "ATTACHMENT_TYPE_NOT_ALLOWED" }));
    expect(() => validateAttachmentFile(file({ originalname: "proof.exe" }))).toThrowError(
      expect.objectContaining({ code: "ATTACHMENT_TYPE_NOT_ALLOWED" }),
    );
    expect(() => validateAttachmentFile(file({ originalname: "bad\nname.png" }))).toThrowError(
      expect.objectContaining({ code: "ATTACHMENT_FILENAME_INVALID" }),
    );
  });

  it("trims removal reasons and enforces 5-500 Unicode characters", () => {
    expect(parseRemovalReason({ reason: "  Replaced by a clearer scan.  " })).toBe(
      "Replaced by a clearer scan.",
    );
    expect(parseRemovalReason({ reason: "😀".repeat(5) })).toBe("😀".repeat(5));
    for (const body of [null, {}, { reason: "four" }, { reason: "x".repeat(501) }, { reason: "valid", extra: true }]) {
      expect(() => parseRemovalReason(body)).toThrowError(
        expect.objectContaining({ code: "VALIDATION_ERROR" }),
      );
    }
  });
});
