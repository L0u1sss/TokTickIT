import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AttachmentStorage } from "./attachment-service.js";

function storageDirectory(): string {
  return process.env.ATTACHMENT_STORAGE_DIR?.trim() ||
    path.resolve(process.cwd(), ".attachment-storage");
}

function storagePath(storageKey: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(storageKey)) throw new Error("Invalid storage key");
  return path.join(storageDirectory(), storageKey);
}

export const localAttachmentStorage: AttachmentStorage = {
  async write(bytes) {
    const storageKey = randomUUID();
    await mkdir(storageDirectory(), { recursive: true });
    await writeFile(storagePath(storageKey), bytes, { flag: "wx" });
    return storageKey;
  },
  read(storageKey) {
    return readFile(storagePath(storageKey));
  },
  async delete(storageKey) {
    await rm(storagePath(storageKey), { force: true });
  },
};
