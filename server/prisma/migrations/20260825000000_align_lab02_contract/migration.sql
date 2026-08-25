-- Align the Issue #13 foundation with the reviewed Lab 2 persistence contract.
-- This migration preserves supported existing rows and fails rather than silently
-- changing any out-of-scope priority, status, or attachment-removal state.
BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "Ticket"
        WHERE "requestedPriority"::text NOT IN ('LOW', 'MEDIUM', 'HIGH')
    ) THEN
        RAISE EXCEPTION 'Cannot narrow Priority while CRITICAL tickets exist';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "Ticket"
        WHERE "currentStatus"::text <> 'NEW'
    ) THEN
        RAISE EXCEPTION 'Cannot narrow Status while non-NEW tickets exist';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "Attachment"
        WHERE "isRemoved" IS DISTINCT FROM ("removedAt" IS NOT NULL)
    ) THEN
        RAISE EXCEPTION 'Cannot derive removal state from inconsistent Attachment rows';
    END IF;
END $$;

-- Preserve data while adopting the canonical logical field names from Section 7.
ALTER TABLE "RequesterUser" RENAME COLUMN "name" TO "displayName";
ALTER TABLE "Ticket" RENAME COLUMN "currentStatus" TO "status";
ALTER TABLE "Attachment" RENAME COLUMN "fileName" TO "originalName";
ALTER TABLE "Attachment" RENAME COLUMN "fileKey" TO "storageKey";
ALTER TABLE "Attachment" RENAME COLUMN "fileSize" TO "sizeBytes";

ALTER TABLE "RequesterUser"
    RENAME CONSTRAINT "RequesterUser_name_check" TO "RequesterUser_displayName_check";
ALTER INDEX "RequesterUser_isActive_name_idx"
    RENAME TO "RequesterUser_isActive_displayName_idx";

ALTER TABLE "Attachment"
    RENAME CONSTRAINT "Attachment_fileName_check" TO "Attachment_originalName_check";
ALTER TABLE "Attachment"
    RENAME CONSTRAINT "Attachment_fileKey_check" TO "Attachment_storageKey_check";
ALTER TABLE "Attachment"
    RENAME CONSTRAINT "Attachment_fileSize_check" TO "Attachment_sizeBytes_check";
ALTER INDEX "Attachment_fileKey_key" RENAME TO "Attachment_storageKey_key";

-- Add lifecycle metadata that was absent from the first Lab 2 migration.
ALTER TABLE "Category" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "Category" SET "updatedAt" = "createdAt";
ALTER TABLE "Category" ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "RelatedSystem"
    ADD COLUMN "description" VARCHAR(500),
    ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "RelatedSystem" SET "updatedAt" = "createdAt";
ALTER TABLE "RelatedSystem" ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "RelatedSystem"
    ADD CONSTRAINT "RelatedSystem_description_check"
        CHECK (
            "description" IS NULL OR (
                "description" = btrim("description") AND
                char_length("description") BETWEEN 1 AND 500
            )
        );

-- Existing tickets receive deterministic synthetic UUIDs. New tickets must use
-- the client-generated UUID supplied by the create-ticket contract.
ALTER TABLE "Ticket" ADD COLUMN "clientRequestId" UUID;
UPDATE "Ticket"
SET "clientRequestId" =
    ('00000000-0000-0000-0000-' || lpad("id"::text, 12, '0'))::uuid;
ALTER TABLE "Ticket" ALTER COLUMN "clientRequestId" SET NOT NULL;
CREATE UNIQUE INDEX "Ticket_clientRequestId_key"
    ON "Ticket"("clientRequestId");

-- PostgreSQL enum values cannot be removed in place, so replace both types
-- after the preflight checks establish that every row is representable.
DROP INDEX "Ticket_currentStatus_idx";
DROP INDEX "Ticket_requesterId_currentStatus_createdAt_idx";
ALTER TABLE "Ticket" ALTER COLUMN "status" DROP DEFAULT;

ALTER TYPE "Priority" RENAME TO "Priority_legacy";
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
ALTER TABLE "Ticket"
    ALTER COLUMN "requestedPriority" TYPE "Priority"
    USING ("requestedPriority"::text::"Priority");
DROP TYPE "Priority_legacy";

ALTER TYPE "Status" RENAME TO "Status_legacy";
CREATE TYPE "Status" AS ENUM ('NEW');
ALTER TABLE "Ticket"
    ALTER COLUMN "status" TYPE "Status"
    USING ("status"::text::"Status");
ALTER TABLE "Ticket" ALTER COLUMN "status" SET DEFAULT 'NEW';
DROP TYPE "Status_legacy";

ALTER TABLE "Ticket"
    ADD CONSTRAINT "Ticket_status_check" CHECK ("status" = 'NEW');

-- Backfill attachment audit actors from the owning requester. Lab 2 permits
-- attachment operations only for that owner, so this is the lossless legacy map.
ALTER TABLE "Attachment"
    ADD COLUMN "uploadedByRequesterId" INTEGER,
    ADD COLUMN "removedByRequesterId" INTEGER;

UPDATE "Attachment" AS attachment
SET
    "uploadedByRequesterId" = ticket."requesterId",
    "removedByRequesterId" = CASE
        WHEN attachment."removedAt" IS NULL THEN NULL
        ELSE ticket."requesterId"
    END
FROM "Ticket" AS ticket
WHERE ticket."id" = attachment."ticketId";

ALTER TABLE "Attachment"
    ALTER COLUMN "uploadedByRequesterId" SET NOT NULL;

ALTER TABLE "Attachment"
    DROP CONSTRAINT "Attachment_removalState_check";
DROP INDEX "Attachment_isRemoved_idx";
DROP INDEX "Attachment_ticketId_isRemoved_createdAt_idx";
ALTER TABLE "Attachment" DROP COLUMN "isRemoved";

ALTER TABLE "Attachment"
    ADD CONSTRAINT "Attachment_removalState_check"
        CHECK (
            (
                "removedAt" IS NULL AND
                "removalReason" IS NULL AND
                "removedByRequesterId" IS NULL
            ) OR (
                "removedAt" IS NOT NULL AND
                "removalReason" IS NOT NULL AND
                "removalReason" = btrim("removalReason") AND
                char_length("removalReason") BETWEEN 5 AND 500 AND
                "removedByRequesterId" IS NOT NULL
            )
        );

ALTER TABLE "Attachment"
    ADD CONSTRAINT "Attachment_uploadedByRequesterId_fkey"
        FOREIGN KEY ("uploadedByRequesterId") REFERENCES "RequesterUser"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "Attachment_removedByRequesterId_fkey"
        FOREIGN KEY ("removedByRequesterId") REFERENCES "RequesterUser"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;

-- Remove redundant indexes and add every required FK/list/attachment index.
DROP INDEX "Ticket_ticketNumber_idx";
DROP INDEX "Ticket_createdAt_idx";

CREATE INDEX "Ticket_categoryId_idx" ON "Ticket"("categoryId");
CREATE INDEX "Ticket_relatedSystemId_idx" ON "Ticket"("relatedSystemId");
CREATE INDEX "Ticket_requesterId_status_createdAt_idx"
    ON "Ticket"("requesterId", "status", "createdAt" DESC);
CREATE INDEX "Ticket_requesterId_requestedPriority_createdAt_idx"
    ON "Ticket"("requesterId", "requestedPriority", "createdAt" DESC);

CREATE INDEX "Attachment_uploadedByRequesterId_idx"
    ON "Attachment"("uploadedByRequesterId");
CREATE INDEX "Attachment_removedByRequesterId_idx"
    ON "Attachment"("removedByRequesterId");
CREATE INDEX "Attachment_ticketId_removedAt_createdAt_idx"
    ON "Attachment"("ticketId", "removedAt", "createdAt");

-- SERIAL starts above zero, and these checks also reject manually supplied
-- non-positive identifiers. Foreign keys then inherit the same guarantee.
ALTER TABLE "RequesterUser"
    ADD CONSTRAINT "RequesterUser_id_check" CHECK ("id" > 0);
ALTER TABLE "Category"
    ADD CONSTRAINT "Category_id_check" CHECK ("id" > 0);
ALTER TABLE "RelatedSystem"
    ADD CONSTRAINT "RelatedSystem_id_check" CHECK ("id" > 0);
ALTER TABLE "Ticket"
    ADD CONSTRAINT "Ticket_id_check" CHECK ("id" > 0);
ALTER TABLE "Attachment"
    ADD CONSTRAINT "Attachment_id_check" CHECK ("id" > 0);

COMMIT;
