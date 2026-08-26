-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('NEW', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "name" SET DATA TYPE VARCHAR(120);

-- CreateTable
CREATE TABLE "RequesterUser" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequesterUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelatedSystem" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RelatedSystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" SERIAL NOT NULL,
    "ticketNumber" VARCHAR(15) NOT NULL,
    "summary" VARCHAR(120) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "requestedPriority" "Priority" NOT NULL,
    "currentStatus" "Status" NOT NULL DEFAULT 'NEW',
    "requesterId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "relatedSystemId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "isRemoved" BOOLEAN NOT NULL DEFAULT false,
    "removedAt" TIMESTAMP(3),
    "removalReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraints
ALTER TABLE "RequesterUser"
    ADD CONSTRAINT "RequesterUser_name_check"
        CHECK ("name" = btrim("name") AND char_length("name") BETWEEN 1 AND 120),
    ADD CONSTRAINT "RequesterUser_email_check"
        CHECK ("email" = lower(btrim("email")) AND char_length("email") BETWEEN 3 AND 254);

ALTER TABLE "Category"
    ADD CONSTRAINT "Category_name_check"
        CHECK ("name" = btrim("name") AND char_length("name") BETWEEN 1 AND 120);

ALTER TABLE "RelatedSystem"
    ADD CONSTRAINT "RelatedSystem_name_check"
        CHECK ("name" = btrim("name") AND char_length("name") BETWEEN 1 AND 120);

ALTER TABLE "Ticket"
    ADD CONSTRAINT "Ticket_ticketNumber_check"
        CHECK ("ticketNumber" ~ '^TKT-[0-9]{4}-[0-9]{6}$'),
    ADD CONSTRAINT "Ticket_summary_check"
        CHECK ("summary" = btrim("summary") AND char_length("summary") BETWEEN 5 AND 120),
    ADD CONSTRAINT "Ticket_description_check"
        CHECK ("description" = btrim("description") AND char_length("description") BETWEEN 10 AND 2000);

ALTER TABLE "Attachment"
    ADD CONSTRAINT "Attachment_fileName_check"
        CHECK ("fileName" = btrim("fileName") AND char_length("fileName") BETWEEN 1 AND 255),
    ADD CONSTRAINT "Attachment_fileKey_check"
        CHECK (char_length(btrim("fileKey")) > 0),
    ADD CONSTRAINT "Attachment_fileSize_check"
        CHECK ("fileSize" BETWEEN 1 AND 5242880),
    ADD CONSTRAINT "Attachment_type_check"
        CHECK (
            (lower("fileName") ~ '\.(jpg|jpeg)$' AND "mimeType" = 'image/jpeg') OR
            (lower("fileName") ~ '\.png$' AND "mimeType" = 'image/png') OR
            (lower("fileName") ~ '\.webp$' AND "mimeType" = 'image/webp') OR
            (lower("fileName") ~ '\.pdf$' AND "mimeType" = 'application/pdf')
        ),
    ADD CONSTRAINT "Attachment_removalState_check"
        CHECK (
            (
                "isRemoved" = false AND
                "removedAt" IS NULL AND
                "removalReason" IS NULL
            ) OR (
                "isRemoved" = true AND
                "removedAt" IS NOT NULL AND
                "removalReason" IS NOT NULL AND
                "removalReason" = btrim("removalReason") AND
                char_length("removalReason") BETWEEN 5 AND 500
            )
        );

-- CreateIndex
CREATE UNIQUE INDEX "RequesterUser_email_key" ON "RequesterUser"("email");

-- CreateIndex
CREATE INDEX "RequesterUser_isActive_name_idx" ON "RequesterUser"("isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "RelatedSystem_name_key" ON "RelatedSystem"("name");

-- CreateIndex
CREATE INDEX "RelatedSystem_isActive_name_idx" ON "RelatedSystem"("isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_ticketNumber_key" ON "Ticket"("ticketNumber");

-- CreateIndex
CREATE INDEX "Ticket_requesterId_idx" ON "Ticket"("requesterId");

-- CreateIndex
CREATE INDEX "Ticket_ticketNumber_idx" ON "Ticket"("ticketNumber");

-- CreateIndex
CREATE INDEX "Ticket_currentStatus_idx" ON "Ticket"("currentStatus");

-- CreateIndex
CREATE INDEX "Ticket_createdAt_idx" ON "Ticket"("createdAt");

-- CreateIndex
CREATE INDEX "Ticket_requesterId_createdAt_idx" ON "Ticket"("requesterId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Ticket_requesterId_currentStatus_createdAt_idx" ON "Ticket"("requesterId", "currentStatus", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Ticket_requesterId_categoryId_createdAt_idx" ON "Ticket"("requesterId", "categoryId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Ticket_requesterId_relatedSystemId_createdAt_idx" ON "Ticket"("requesterId", "relatedSystemId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_fileKey_key" ON "Attachment"("fileKey");

-- CreateIndex
CREATE INDEX "Attachment_ticketId_idx" ON "Attachment"("ticketId");

-- CreateIndex
CREATE INDEX "Attachment_isRemoved_idx" ON "Attachment"("isRemoved");

-- CreateIndex
CREATE INDEX "Attachment_ticketId_isRemoved_createdAt_idx" ON "Attachment"("ticketId", "isRemoved", "createdAt");

-- CreateIndex
CREATE INDEX "Category_isActive_name_idx" ON "Category"("isActive", "name");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "RequesterUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_relatedSystemId_fkey" FOREIGN KEY ("relatedSystemId") REFERENCES "RelatedSystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
