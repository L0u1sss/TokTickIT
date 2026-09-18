-- New tickets must explicitly copy Requested Priority; never silently use MEDIUM.
-- Keep existing values, including priorities subsequently changed by IT Staff.
ALTER TABLE "Ticket" ALTER COLUMN "itPriority" DROP DEFAULT;
