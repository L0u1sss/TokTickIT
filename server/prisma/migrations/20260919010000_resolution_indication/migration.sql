ALTER TABLE "Ticket" ADD COLUMN "problemAppearsResolvedAt" TIMESTAMP(3), ADD COLUMN "problemAppearsResolvedById" INTEGER;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_problemAppearsResolvedById_fkey" FOREIGN KEY ("problemAppearsResolvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_resolution_pair_check" CHECK (("problemAppearsResolvedAt" IS NULL) = ("problemAppearsResolvedById" IS NULL));
