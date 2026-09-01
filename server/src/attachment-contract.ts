import path from "node:path";
import { ApiError, validationError } from "./errors.js";

export const ATTACHMENT_MAX_BYTES = 5_242_880;
export const ATTACHMENT_MAX_ACTIVE = 5;

const allowedMimeByExtension = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".pdf", "application/pdf"],
]);

export interface ValidatedAttachmentFile {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  bytes: Buffer;
}

function unicodeLength(value: string): number {
  return Array.from(value).length;
}

function safeBasename(value: string): string {
  return path.posix.basename(value.replaceAll("\\", "/"));
}

export function normalizeMultipartFilename(value: string): string {
  if (Array.from(value).some((character) => (character.codePointAt(0) ?? 0) > 255)) {
    return value;
  }
  const bytes = Buffer.from(value, "latin1");
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return Buffer.from(decoded, "utf8").equals(bytes) ? decoded : value;
  } catch {
    return value;
  }
}

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
}

export function validateAttachmentFile(
  file: Express.Multer.File | undefined,
): ValidatedAttachmentFile {
  if (!file) {
    throw new ApiError(400, "INVALID_MULTIPART", "Attach exactly one file named file.");
  }

  const originalName = safeBasename(normalizeMultipartFilename(file.originalname));
  if (
    unicodeLength(originalName) < 1 ||
    unicodeLength(originalName) > 255 ||
    containsControlCharacter(originalName)
  ) {
    throw new ApiError(
      400,
      "ATTACHMENT_FILENAME_INVALID",
      "The attachment filename is invalid.",
    );
  }

  const extension = path.extname(originalName).toLowerCase();
  if (allowedMimeByExtension.get(extension) !== file.mimetype.toLowerCase()) {
    throw new ApiError(
      400,
      "ATTACHMENT_TYPE_NOT_ALLOWED",
      "Choose a JPG, PNG, WEBP, or PDF file.",
    );
  }

  if (file.size < 1 || file.size > ATTACHMENT_MAX_BYTES) {
    throw new ApiError(
      400,
      "ATTACHMENT_SIZE_INVALID",
      "File must be 5 MB or smaller.",
    );
  }

  return {
    originalName,
    mimeType: file.mimetype.toLowerCase(),
    sizeBytes: file.size,
    bytes: file.buffer,
  };
}

export function parseRemovalReason(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw validationError([{ field: "body", issue: "Must be a JSON object." }]);
  }
  const record = body as Record<string, unknown>;
  const details = [] as Array<{ field: string; issue: string }>;
  for (const field of Object.keys(record)) {
    if (field !== "reason") details.push({ field, issue: "Unknown fields are not allowed." });
  }
  if (typeof record.reason !== "string") {
    details.push({ field: "reason", issue: "Removal reason is required." });
  } else {
    const reason = record.reason.trim();
    const length = unicodeLength(reason);
    if (length < 5 || length > 500) {
      details.push({ field: "reason", issue: "Must contain 5-500 characters." });
    }
    if (details.length === 0) return reason;
  }
  throw validationError(details);
}
