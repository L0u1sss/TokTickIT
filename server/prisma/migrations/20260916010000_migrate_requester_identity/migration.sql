-- LOCAL LAB ONLY. Initial password: Lab3-Initial-password1!
-- Every migrated account must change it before accessing protected operations.
BEGIN;
LOCK TABLE "RequesterUser", "User", "Ticket", "Attachment" IN ACCESS EXCLUSIVE MODE;
ALTER TABLE "User" ADD CONSTRAINT "User_id_check" CHECK ("id" > 0);
ALTER TABLE "User" ADD CONSTRAINT "User_displayName_check" CHECK (char_length("displayName") BETWEEN 1 AND 120 AND "displayName" = btrim("displayName"));
ALTER TABLE "User" ADD CONSTRAINT "User_email_check" CHECK ("email" = lower(btrim("email")) AND "email" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');
CREATE INDEX "User_isActive_displayName_idx" ON "User"("isActive", "displayName");
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "RequesterUser" GROUP BY lower(btrim("email")) HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM "RequesterUser" r JOIN "User" u ON u.id = r.id OR u.email = lower(btrim(r.email))) THEN
    RAISE EXCEPTION 'Requester migration identity collision: reconcile IDs/emails before retrying; no identities were merged';
  END IF;
END $$;
INSERT INTO "User" ("id", "displayName", "email", "passwordHash", "role", "isActive", "mustChangePassword", "createdAt", "updatedAt")
SELECT "id", "displayName", lower(btrim("email")),
  '$argon2id$v=19$m=19456,p=1,t=2$oejNISJ8VvCBYtuZyqDKZw$gNQzn7bjNJFgH+so6hC9fYs6csnfUoSmaYAR8YxJIpA',
  'REQUESTER'::"UserRole", "isActive", true, "createdAt", "updatedAt"
FROM "RequesterUser";
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_requesterId_fkey";
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_uploadedByRequesterId_fkey";
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_removedByRequesterId_fkey";
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedByRequesterId_fkey" FOREIGN KEY ("uploadedByRequesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_removedByRequesterId_fkey" FOREIGN KEY ("removedByRequesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Inserting all rows and validating the new restrictive FKs precedes retirement.
DROP TABLE "RequesterUser";
SELECT setval(pg_get_serial_sequence('"User"', 'id'), COALESCE((SELECT max(id) FROM "User"), 1), EXISTS(SELECT 1 FROM "User"));
COMMIT;
