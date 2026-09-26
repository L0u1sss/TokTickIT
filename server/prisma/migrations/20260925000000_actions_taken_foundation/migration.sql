CREATE TYPE "ActionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ActionEventType" AS ENUM ('CREATED', 'CONTENT_UPDATED', 'ASSIGNED', 'STATUS_CHANGED');

CREATE TABLE "ActionTaken" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "clientRequestId" UUID NOT NULL,
  "description" VARCHAR(2000) NOT NULL,
  "result" VARCHAR(2000),
  "status" "ActionStatus" NOT NULL DEFAULT 'PLANNED',
  "performedById" INTEGER NOT NULL,
  "assigneeId" INTEGER NOT NULL,
  "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
  "followUpNote" VARCHAR(1000),
  "attachmentNotes" VARCHAR(1000),
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActionTaken_revision_check" CHECK ("revision" >= 1),
  CONSTRAINT "ActionTaken_description_check" CHECK (length(btrim("description")) > 0),
  CONSTRAINT "ActionTaken_follow_up_check" CHECK (
    ("followUpRequired" = true AND "followUpNote" IS NOT NULL AND length(btrim("followUpNote")) > 0)
    OR ("followUpRequired" = false AND "followUpNote" IS NULL)
  ),
  CONSTRAINT "ActionTaken_completion_check" CHECK (
    ("status" = 'COMPLETED' AND "result" IS NOT NULL AND length(btrim("result")) > 0 AND "completedAt" IS NOT NULL)
    OR ("status" <> 'COMPLETED' AND "completedAt" IS NULL)
  )
);

CREATE TABLE "ActionEvent" (
  "id" SERIAL NOT NULL,
  "actionId" INTEGER NOT NULL,
  "actorId" INTEGER NOT NULL,
  "eventType" "ActionEventType" NOT NULL,
  "fromStatus" "ActionStatus",
  "toStatus" "ActionStatus",
  "changedFields" JSONB NOT NULL,
  "revision" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActionEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActionEvent_revision_check" CHECK ("revision" >= 1)
);

CREATE UNIQUE INDEX "ActionTaken_ticketId_clientRequestId_key" ON "ActionTaken"("ticketId", "clientRequestId");
CREATE INDEX "ActionTaken_ticketId_createdAt_id_idx" ON "ActionTaken"("ticketId", "createdAt", "id");
CREATE INDEX "ActionTaken_assigneeId_status_updatedAt_id_idx" ON "ActionTaken"("assigneeId", "status", "updatedAt", "id");
CREATE INDEX "ActionTaken_status_updatedAt_id_idx" ON "ActionTaken"("status", "updatedAt", "id");
CREATE INDEX "ActionTaken_performedById_idx" ON "ActionTaken"("performedById");
CREATE UNIQUE INDEX "ActionEvent_actionId_revision_key" ON "ActionEvent"("actionId", "revision");
CREATE INDEX "ActionEvent_actionId_createdAt_id_idx" ON "ActionEvent"("actionId", "createdAt", "id");
CREATE INDEX "ActionEvent_actorId_idx" ON "ActionEvent"("actorId");

ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionEvent" ADD CONSTRAINT "ActionEvent_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ActionTaken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionEvent" ADD CONSTRAINT "ActionEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- This migration is intentionally additive. Existing Tickets receive no fabricated
-- Action Taken or audit history and continue to represent the valid zero-action state.
