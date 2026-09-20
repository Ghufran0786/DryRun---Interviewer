-- Allow NULL userId until owner backfill runs
ALTER TABLE "Session" ALTER COLUMN "userId" DROP NOT NULL;
