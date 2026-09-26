-- EMERGENCY ROLLBACK FOR A DISPOSABLE OR PRE-USE DEPLOYMENT ONLY.
-- Refuse to remove real Action history. For a used environment, restore from a
-- verified backup or ship a reviewed forward corrective migration instead.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ActionTaken" LIMIT 1) THEN
    RAISE EXCEPTION 'Refusing rollback: ActionTaken contains data';
  END IF;
END $$;

DROP TABLE "ActionEvent";
DROP TABLE "ActionTaken";
DROP TYPE "ActionEventType";
DROP TYPE "ActionStatus";
