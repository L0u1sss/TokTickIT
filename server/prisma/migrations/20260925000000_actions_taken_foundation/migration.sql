CREATE TYPE "ActionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ActionEventType" AS ENUM ('ACTION_CREATED', 'ACTION_UPDATED', 'ACTION_COMPLETED', 'ACTION_CANCELLED', 'TICKET_CASCADE_CANCELLED');
CREATE TYPE "CancellationSource" AS ENUM ('STAFF_ACTION', 'TICKET_CASCADE');

ALTER TABLE "Ticket"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "workflowCycle" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "resolvedAt" TIMESTAMP(3),
  ADD CONSTRAINT "Ticket_version_check" CHECK ("version" >= 1),
  ADD CONSTRAINT "Ticket_workflowCycle_check" CHECK ("workflowCycle" >= 1);

CREATE TABLE "ActionTaken" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "workflowCycle" INTEGER NOT NULL DEFAULT 1,
  "clientRequestId" UUID NOT NULL,
  "description" VARCHAR(2000) NOT NULL,
  "result" VARCHAR(2000),
  "status" "ActionStatus" NOT NULL DEFAULT 'PLANNED',
  "recordedById" INTEGER NOT NULL,
  "performedById" INTEGER,
  "assigneeId" INTEGER NOT NULL,
  "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
  "followUpNote" VARCHAR(1000),
  "attachmentNotes" VARCHAR(1000),
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancelledById" INTEGER,
  "cancellationSource" "CancellationSource",
  CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActionTaken_workflowCycle_check" CHECK ("workflowCycle" >= 1),
  CONSTRAINT "ActionTaken_revision_check" CHECK ("revision" >= 1),
  CONSTRAINT "ActionTaken_description_check" CHECK (length(btrim("description")) > 0),
  CONSTRAINT "ActionTaken_follow_up_check" CHECK (
    ("followUpRequired" = true AND "followUpNote" IS NOT NULL AND length(btrim("followUpNote")) > 0)
    OR ("followUpRequired" = false AND "followUpNote" IS NULL)
  ),
  CONSTRAINT "ActionTaken_completion_check" CHECK (
    ("status" = 'COMPLETED' AND "result" IS NOT NULL AND length(btrim("result")) > 0 AND "completedAt" IS NOT NULL AND "performedById" IS NOT NULL AND "followUpRequired" = false)
    OR ("status" <> 'COMPLETED' AND "completedAt" IS NULL AND "performedById" IS NULL)
  ),
  CONSTRAINT "ActionTaken_cancellation_check" CHECK (
    ("status" = 'CANCELLED' AND "cancelledAt" IS NOT NULL AND "cancelledById" IS NOT NULL AND "cancellationSource" IS NOT NULL)
    OR ("status" <> 'CANCELLED' AND "cancelledAt" IS NULL AND "cancelledById" IS NULL AND "cancellationSource" IS NULL)
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
CREATE INDEX "Ticket_status_resolvedAt_idx" ON "Ticket"("status", "resolvedAt");
CREATE INDEX "ActionTaken_ticketId_workflowCycle_createdAt_id_idx" ON "ActionTaken"("ticketId", "workflowCycle", "createdAt", "id");
CREATE INDEX "ActionTaken_assigneeId_status_updatedAt_id_idx" ON "ActionTaken"("assigneeId", "status", "updatedAt", "id");
CREATE INDEX "ActionTaken_status_updatedAt_id_idx" ON "ActionTaken"("status", "updatedAt", "id");
CREATE INDEX "ActionTaken_recordedById_idx" ON "ActionTaken"("recordedById");
CREATE INDEX "ActionTaken_performedById_idx" ON "ActionTaken"("performedById");
CREATE INDEX "ActionTaken_cancelledById_idx" ON "ActionTaken"("cancelledById");
CREATE UNIQUE INDEX "ActionEvent_actionId_revision_key" ON "ActionEvent"("actionId", "revision");
CREATE INDEX "ActionEvent_actionId_createdAt_id_idx" ON "ActionEvent"("actionId", "createdAt", "id");
CREATE INDEX "ActionEvent_actorId_idx" ON "ActionEvent"("actorId");

ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionEvent" ADD CONSTRAINT "ActionEvent_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ActionTaken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionEvent" ADD CONSTRAINT "ActionEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- This migration is intentionally additive. Existing Tickets receive no fabricated
-- Action Taken or audit history and continue to represent the valid zero-action state.
