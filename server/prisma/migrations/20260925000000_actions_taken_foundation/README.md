# Actions Taken migration and recovery

This migration is additive: it adds Ticket version/workflow-cycle/resolution-time columns, creates the Action and cancellation enums, and creates the Action tables. It does not rewrite or delete any Lab 1–3 row. Existing Tickets receive `version=1`, `workflowCycle=1`, and `resolvedAt=NULL`, and intentionally begin with zero Actions. Existing `RESOLVED` and `CLOSED` Tickets remain valid; only a future transition into `RESOLVED` is subject to the Lab 4 gate.

Before deployment, take and verify a PostgreSQL backup, record counts for `User`, `Ticket`, `Attachment`, `PublicComment`, and `InternalNote`, and run `prisma migrate deploy` first against a populated disposable copy. Compare IDs, counts, foreign keys, and representative rows afterward.

Finalize this migration before shared deployment. Never replace a migration file already recorded by an environment; use a reviewed forward corrective migration there. If deployment fails, keep the database unavailable for writes and restore the verified backup or fix forward with a reviewed migration. `rollback-before-use.sql` is provided only for an isolated disposable database or a deployment with no Action ever created. It refuses to run when `ActionTaken` contains any row. Never use this rollback after real Action history exists.

The Lab 4 migration test exercises populated upgrade, fresh deployment, repeated seed, refusal after Action data exists, pre-use rollback, and forward reapplication in disposable schemas.
