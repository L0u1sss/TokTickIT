# Actions Taken migration and recovery

This migration is additive: it creates two enums and two tables and does not update, backfill, or delete any Lab 1–3 row. Existing Tickets intentionally begin with zero Actions. Existing `RESOLVED` and `CLOSED` Tickets remain valid; only a future transition into `RESOLVED` is subject to the Lab 4 gate.

Before deployment, take and verify a PostgreSQL backup, record counts for `User`, `Ticket`, `Attachment`, `PublicComment`, and `InternalNote`, and run `prisma migrate deploy` first against a populated disposable copy. Compare IDs, counts, foreign keys, and representative rows afterward.

If deployment fails, keep the database unavailable for writes and restore the verified backup or fix forward with a reviewed migration. `rollback-before-use.sql` is provided only when the migration completed but no Action has ever been created. It refuses to run when `ActionTaken` contains any row. Never edit an already-applied migration or use this rollback after real Action history exists.

The Lab 4 migration test exercises populated upgrade, fresh deployment, repeated seed, refusal after Action data exists, pre-use rollback, and forward reapplication in disposable schemas.
